import { contextBridge, ipcRenderer } from 'electron';

// Manually expose @electron/llm's electronAi API
// This is needed because @electron/llm's auto-injected preload looks for a file that doesn't exist in our build structure
const electronAi = {
  create: async (options: any) => {
    if (!options || typeof options.modelAlias !== 'string') {
      throw new TypeError('modelAlias is required and must be a string');
    }
    return ipcRenderer.invoke('ELECTRON_LLM_CREATE', options);
  },
  destroy: async () => ipcRenderer.invoke('ELECTRON_LLM_DESTROY'),
  prompt: async (input: string = '', options?: any) => {
    return ipcRenderer.invoke('ELECTRON_LLM_PROMPT', input, options);
  },
  promptStreaming: async (input: string = '', options?: any) => {
    // Create a promise that will resolve with the port from main process
    return new Promise((resolve) => {
      ipcRenderer.once('ELECTRON_LLM_PROMPT_STREAMING_PORT', (event: any) => {
        // Access the port from the event's ports array
        const [port] = event.ports;
        // Start the port to receive messages
        port.start();
        const iterator = {
          async next() {
            const message = await new Promise((resolve, reject) => {
              port.onmessage = (event: any) => {
                if (event.data.type === 'error') {
                  reject(new Error(event.data.error));
                } else if (event.data.type === 'done') {
                  resolve({ done: true, value: undefined });
                } else {
                  resolve({ value: event.data.chunk, done: false });
                }
              };
            });
            return message;
          },
          async return() {
            port.close();
            return { done: true, value: undefined };
          },
          async throw(error: any) {
            port.close();
            throw error;
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };
        resolve(iterator);
      });
      // Request streaming from main process
      ipcRenderer.send('ELECTRON_LLM_PROMPT_STREAMING_REQUEST', input, options);
    });
  },
  abortRequest: (requestUUID: string) => {
    return ipcRenderer.invoke('ELECTRON_LLM_ABORT_REQUEST', { requestUUID });
  },
};

// Expose electronAi to window
contextBridge.exposeInMainWorld('electronAi', electronAi);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectGGUFFile: () => ipcRenderer.invoke('select-gguf-file'),
  
  // LLM methods - @electron/llm provides window.electronAi directly
  // We just need to register the model path
  llmRegisterModelPath: (modelAlias: string, modelPath: string) => ipcRenderer.invoke('llm-register-model-path', modelAlias, modelPath),
  
  // P2P methods
  p2pGetPeerCount: () => ipcRenderer.invoke('p2p-get-peer-count'),
  p2pGetPeers: () => ipcRenderer.invoke('p2p-get-peers'),
  p2pStart: () => ipcRenderer.invoke('p2p-start'),
  p2pStop: () => ipcRenderer.invoke('p2p-stop'),
  
  // Wallet methods
  walletCreate: () => ipcRenderer.invoke('wallet-create'),
  walletGetAddress: () => ipcRenderer.invoke('wallet-get-address'),
  walletHasWallet: () => ipcRenderer.invoke('wallet-has-wallet'),
  walletIsEncryptionAvailable: () => ipcRenderer.invoke('wallet-is-encryption-available'),
});

// TypeScript type definitions for the exposed API
export interface ElectronAPI {
  getSystemStats: () => Promise<{
    memory: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    cpu: {
      model: string;
      cores: number;
      loadPercent: number;
    };
  }>;
  selectFolder: () => Promise<{
    folderPath: string;
    files: Array<{
      name: string;
      isDirectory: boolean;
      path: string;
    }>;
  } | null>;
  selectGGUFFile: () => Promise<string | null>;
  llmRegisterModelPath: (modelAlias: string, modelPath: string) => Promise<{ success: boolean }>;
  
  // P2P methods
  p2pGetPeerCount: () => Promise<number>;
  p2pGetPeers: () => Promise<string[]>;
  p2pStart: () => Promise<{ success: boolean }>;
  p2pStop: () => Promise<{ success: boolean }>;
  
  // Wallet methods
  walletCreate: () => Promise<{ address: string }>;
  walletGetAddress: () => Promise<string | null>;
  walletHasWallet: () => Promise<boolean>;
  walletIsEncryptionAvailable: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
