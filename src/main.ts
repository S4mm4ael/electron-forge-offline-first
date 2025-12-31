import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { loadElectronLlm } from '@electron/llm';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import { P2PManager } from './p2p/p2p-manager';
import { WalletManager } from './wallet/wallet-manager';

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

// LLM Setup - @electron/llm handles utility process internally
let llmInitialized = false;
const modelPathMap = new Map<string, string>(); // Map modelAlias to actual file path

// P2P Manager
const p2pManager = new P2PManager();

// Wallet Manager
const walletManager = new WalletManager();

async function initializeLLM() {
  try {
    // Load @electron/llm - this sets up the utility process automatically
    // Disable automatic preload injection since we expose electronAi in our own preload.ts
    await loadElectronLlm({
      isAutomaticPreloadDisabled: true, // Disable @electron/llm's preload, we handle it in preload.ts
      getModelPath: (modelAlias: string) => {
        // Return the mapped path if it exists, otherwise use default location
        const mappedPath = modelPathMap.get(modelAlias);
        if (mappedPath) {
          console.log(`[LLM] Using mapped path for ${modelAlias}: ${mappedPath}`);
          return mappedPath;
        }
        // Default: look in userData/models directory
        return path.join(app.getPath('userData'), 'models', `${modelAlias}.gguf`);
      },
    });
    llmInitialized = true;
    console.log('@electron/llm loaded successfully');
  } catch (error) {
    console.error('Failed to load @electron/llm:', error);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await initializeLLM();
  
  // Initialize P2P manager
  try {
    await p2pManager.start();
    await p2pManager.startP2PNode();
    console.log('[Main] P2P manager initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize P2P manager:', error);
  }
  
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  // Cleanup P2P manager
  try {
    await p2pManager.stop();
  } catch (error) {
    console.error('[Main] Error stopping P2P manager:', error);
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Ensure P2P manager is stopped before quit
  try {
    await p2pManager.stop();
  } catch (error) {
    console.error('[Main] Error stopping P2P manager:', error);
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

// LLM IPC Handlers - Store model path mapping
ipcMain.handle('llm-register-model-path', async (event, modelAlias: string, modelPath: string) => {
  if (!llmInitialized) {
    throw new Error('@electron/llm not loaded');
  }
  
  // Store the mapping so getModelPath can return it
  modelPathMap.set(modelAlias, modelPath);
  console.log(`Registered model path: ${modelAlias} -> ${modelPath}`);
  return { success: true };
});

// P2P IPC Handlers
ipcMain.handle('p2p-get-peer-count', async () => {
  try {
    return p2pManager.getCurrentPeerCount();
  } catch (error) {
    console.error('[Main] Error getting peer count:', error);
    return 0;
  }
});

ipcMain.handle('p2p-get-peers', async () => {
  try {
    return p2pManager.getCurrentPeers();
  } catch (error) {
    console.error('[Main] Error getting peers:', error);
    return [];
  }
});

ipcMain.handle('p2p-start', async () => {
  try {
    await p2pManager.startP2PNode();
    return { success: true };
  } catch (error) {
    console.error('[Main] Error starting P2P node:', error);
    throw error;
  }
});

ipcMain.handle('p2p-stop', async () => {
  try {
    await p2pManager.stopP2PNode();
    return { success: true };
  } catch (error) {
    console.error('[Main] Error stopping P2P node:', error);
    throw error;
  }
});

// Wallet IPC Handlers
ipcMain.handle('wallet-create', async () => {
  try {
    const result = await walletManager.createWallet();
    return result;
  } catch (error) {
    console.error('[Main] Error creating wallet:', error);
    throw error;
  }
});

ipcMain.handle('wallet-get-address', async () => {
  try {
    const address = await walletManager.getWalletAddress();
    return address;
  } catch (error) {
    console.error('[Main] Error getting wallet address:', error);
    throw error;
  }
});

ipcMain.handle('wallet-has-wallet', async () => {
  try {
    return await walletManager.hasWallet();
  } catch (error) {
    console.error('[Main] Error checking wallet:', error);
    return false;
  }
});

ipcMain.handle('wallet-is-encryption-available', async () => {
  try {
    return walletManager.isEncryptionAvailable();
  } catch (error) {
    console.error('[Main] Error checking encryption availability:', error);
    return false;
  }
});
