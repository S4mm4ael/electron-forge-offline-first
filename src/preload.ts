import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // LLM methods
  llmInitialize: (modelPath: string) => ipcRenderer.invoke('llm-initialize', modelPath),
  llmGenerate: (prompt: string) => ipcRenderer.invoke('llm-generate', prompt),
  llmCancel: () => ipcRenderer.invoke('llm-cancel'),
  
  // LLM event listeners for streaming
  llmOnChunk: (callback: (chunk: { token: string; text: string; requestId?: string }) => void) => {
    ipcRenderer.on('llm-chunk', (event, data) => callback(data.payload));
  },
  llmOnResponse: (callback: (response: { type: string; payload?: any; requestId?: string }) => void) => {
    ipcRenderer.on('llm-response', (event, data) => callback(data));
  },
  llmRemoveListeners: () => {
    ipcRenderer.removeAllListeners('llm-chunk');
    ipcRenderer.removeAllListeners('llm-response');
  },
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
  llmInitialize: (modelPath: string) => Promise<any>;
  llmGenerate: (prompt: string) => Promise<{ requestId: string }>;
  llmCancel: () => Promise<void>;
  llmOnChunk: (callback: (chunk: { token: string; text: string; requestId?: string }) => void) => void;
  llmOnResponse: (callback: (response: { type: string; payload?: any; requestId?: string }) => void) => void;
  llmRemoveListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
