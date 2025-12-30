import { app, BrowserWindow, ipcMain, dialog, utilityProcess, MessageChannelMain } from 'electron';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// LLM Utility Process Setup
let llmProcess: utilityProcess.UtilityProcess | null = null;
let llmMessagePort: MessageChannelMain['port1'] | null = null;
let llmMessagePort2: MessageChannelMain['port2'] | null = null;

function spawnLLMProcess() {
  try {
    // Determine the path to the utility process script
    const llmProcessPath = path.join(__dirname, 'llm-process.js');
    
    // Spawn the utility process
    llmProcess = utilityProcess.fork(llmProcessPath);
    
    // Create MessageChannel for communication
    const { port1, port2 } = new MessageChannelMain();
    llmMessagePort = port1;
    llmMessagePort2 = port2;
    
    // Send the port to the utility process
    llmProcess.postMessage('init', [port2]);
    
    // Set up message handler for utility process
    port1.on('message', (event) => {
      const response = event.data;
      
      // Forward streaming chunks to renderer via IPC
      if (response.type === 'chunk') {
        // Emit to all renderers listening for LLM chunks
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('llm-chunk', response);
        });
      } else if (response.type === 'complete' || response.type === 'error' || response.type === 'initialized') {
        // Forward completion/error/initialization messages
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('llm-response', response);
        });
      }
    });
    
    port1.start();
    
    // Handle utility process events
    llmProcess.on('exit', (code) => {
      console.log(`LLM utility process exited with code ${code}`);
      llmProcess = null;
      llmMessagePort = null;
      llmMessagePort2 = null;
    });
    
    llmProcess.stderr?.on('data', (data) => {
      console.error('LLM process stderr:', data.toString());
    });
    
    llmProcess.stdout?.on('data', (data) => {
      console.log('LLM process stdout:', data.toString());
    });
    
    console.log('LLM utility process spawned successfully');
  } catch (error) {
    console.error('Failed to spawn LLM utility process:', error);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  spawnLLMProcess();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// System Health: Get RAM and CPU stats
ipcMain.handle('get-system-stats', () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;
  
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown';
  const cpuCount = cpus.length;
  
  // Calculate CPU load (simplified - average of all cores)
  const cpuLoad = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    const idle = cpu.times.idle;
    return acc + (1 - idle / total);
  }, 0) / cpuCount * 100;

  return {
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usagePercent: memoryUsagePercent,
    },
    cpu: {
      model: cpuModel,
      cores: cpuCount,
      loadPercent: cpuLoad,
    },
  };
});

// File System: Select folder and list files
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    return null;
  }

  const folderPath = result.filePaths[0];
  
  try {
    const files = await readdir(folderPath, { withFileTypes: true });
    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(folderPath, file.name),
    }));

    return {
      folderPath,
      files: fileList,
    };
  } catch (error) {
    throw new Error(`Failed to read directory: ${error}`);
  }
});

// File System: Select GGUF model file
ipcMain.handle('select-gguf-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'GGUF Files', extensions: ['gguf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    title: 'Select GGUF Model File',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// LLM IPC Handlers - Bridge between renderer and utility process

ipcMain.handle('llm-initialize', async (event, modelPath: string) => {
  if (!llmMessagePort || !llmProcess) {
    throw new Error('LLM utility process not available');
  }
  
  const requestId = `init-${Date.now()}-${Math.random()}`;
  
  return new Promise((resolve, reject) => {
    let resolved = false;
    const webContents = event.sender;
    
    // Set up listener for initialization response
    const responseHandler = (_event: any, response: any) => {
      // Match by requestId or check if it's an initialization response without requestId
      if (response.type === 'initialized' && (!response.requestId || response.requestId === requestId)) {
        if (!resolved) {
          resolved = true;
          webContents.removeListener('llm-response', responseHandler);
          resolve(response.payload);
        }
      } else if (response.type === 'error' && (!response.requestId || response.requestId === requestId)) {
        if (!resolved) {
          resolved = true;
          webContents.removeListener('llm-response', responseHandler);
          reject(new Error(response.payload?.error || 'Initialization failed'));
        }
      }
    };
    
    webContents.on('llm-response', responseHandler);
    
    // Send initialization message to utility process
    llmMessagePort.postMessage({
      type: 'initialize',
      payload: { modelPath },
      requestId,
    });
    
    // Timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        webContents.removeListener('llm-response', responseHandler);
        reject(new Error('Initialization timeout'));
      }
    }, 60000);
  });
});

ipcMain.handle('llm-generate', async (event, prompt: string) => {
  if (!llmMessagePort || !llmProcess) {
    throw new Error('LLM utility process not available');
  }
  
  const requestId = `gen-${Date.now()}`;
  
  // Send generation request to utility process
  llmMessagePort.postMessage({
    type: 'generate',
    payload: { prompt },
    requestId,
  });
  
  // Return requestId so renderer can listen for chunks
  return { requestId };
});

ipcMain.handle('llm-cancel', async () => {
  if (!llmMessagePort || !llmProcess) {
    return;
  }
  
  llmMessagePort.postMessage({
    type: 'cancel',
  });
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (llmProcess) {
    llmProcess.kill();
  }
});
