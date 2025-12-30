import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
