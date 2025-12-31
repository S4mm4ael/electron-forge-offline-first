// P2P Manager - Main Process
// Manages the P2P utility process and provides IPC interface

import { utilityProcess } from 'electron';
import path from 'node:path';
import type { UtilityProcess } from 'electron';

interface P2PMessage {
  type: 'start' | 'stop' | 'get-peer-count' | 'get-peers' | 'ping';
  payload?: any;
  requestId?: string;
}

interface P2PResponse {
  type: 'started' | 'stopped' | 'peer-count' | 'peers' | 'error' | 'pong' | 'peer-updated';
  payload?: any;
  requestId?: string;
}

export class P2PManager {
  private utilityProcess: UtilityProcess | null = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private peerCount: number = 0;
  private peerIds: string[] = [];
  private peerUpdateListeners: Array<(count: number, peers: string[]) => void> = [];

  async start(): Promise<void> {
    if (this.utilityProcess && !this.utilityProcess.killed) {
      console.log('[P2P Manager] Utility process already running');
      return;
    }

    try {
      console.log('[P2P Manager] Spawning P2P utility process...');

      // Spawn utility process
      // The built file will be in the same directory as main.js
      // Using .mjs extension for ESM support
      const processPath = path.join(__dirname, 'p2p-process.mjs');

      this.utilityProcess = utilityProcess.fork(processPath, [], {
        serviceName: 'p2p-process',
        stdio: 'pipe',
      });

      // Set up message handling from utility process
      this.utilityProcess.on('message', (message: P2PResponse) => {
        this.handleMessage(message);
      });

      // Handle utility process events
      this.utilityProcess.on('exit', (code) => {
        console.log(`[P2P Manager] Utility process exited with code ${code}`);
        this.utilityProcess = null;
        this.peerCount = 0;
        this.peerIds = [];
      });

      this.utilityProcess.stdout?.on('data', (data) => {
        console.log(`[P2P Process] ${data.toString()}`);
      });

      this.utilityProcess.stderr?.on('data', (data) => {
        console.error(`[P2P Process Error] ${data.toString()}`);
      });

      // Wait for ready signal
      await this.waitForReady();

      console.log('[P2P Manager] P2P utility process started successfully');
    } catch (error) {
      console.error('[P2P Manager] Failed to start utility process:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.utilityProcess && !this.utilityProcess.killed) {
      try {
        await this.sendMessage({ type: 'stop' });
        this.utilityProcess.kill();
      } catch (error) {
        console.error('[P2P Manager] Error stopping utility process:', error);
      }
    }
    this.utilityProcess = null;
    this.peerCount = 0;
    this.peerIds = [];
  }

  async startP2PNode(): Promise<void> {
    await this.sendMessage({ type: 'start' });
  }

  async stopP2PNode(): Promise<void> {
    await this.sendMessage({ type: 'stop' });
  }

  async getPeerCount(): Promise<number> {
    const response = await this.sendMessage({ type: 'get-peer-count' });
    return response.count || 0;
  }

  async getPeers(): Promise<string[]> {
    const response = await this.sendMessage({ type: 'get-peers' });
    return response.peers || [];
  }

  getCurrentPeerCount(): number {
    return this.peerCount;
  }

  getCurrentPeers(): string[] {
    return [...this.peerIds];
  }

  onPeerUpdate(listener: (count: number, peers: string[]) => void): () => void {
    this.peerUpdateListeners.push(listener);
    return () => {
      const index = this.peerUpdateListeners.indexOf(listener);
      if (index > -1) {
        this.peerUpdateListeners.splice(index, 1);
      }
    };
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('P2P utility process did not respond with ready signal'));
      }, 10000);

      const messageHandler = (message: P2PResponse) => {
        if (message.type === 'pong') {
          clearTimeout(timeout);
          this.utilityProcess?.off('message', messageHandler);
          resolve();
        }
      };

      this.utilityProcess?.on('message', messageHandler);
    });
  }

  private async sendMessage(message: P2PMessage): Promise<any> {
    if (!this.utilityProcess || this.utilityProcess.killed) {
      throw new Error('P2P utility process not initialized');
    }

    const requestId = `${Date.now()}-${Math.random()}`;
    message.requestId = requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      const messageHandler = (response: P2PResponse) => {
        if (response.requestId === requestId) {
          clearTimeout(timeout);
          this.utilityProcess?.off('message', messageHandler);
          this.pendingRequests.delete(requestId);

          if (response.type === 'error') {
            reject(new Error(response.payload?.error || 'Unknown error'));
          } else {
            resolve(response.payload || {});
          }
        }
      };

      this.utilityProcess?.on('message', messageHandler);
      this.utilityProcess.postMessage(message);
    });
  }

  private handleMessage(data: P2PResponse): void {
    // Handle peer updates
    if (data.type === 'peer-updated') {
      this.peerCount = data.payload?.peerCount || 0;
      this.peerIds = data.payload?.peers || [];
      
      // Notify listeners
      this.peerUpdateListeners.forEach((listener) => {
        listener(this.peerCount, this.peerIds);
      });
    }

    // Handle pending requests
    if (data.requestId) {
      const pending = this.pendingRequests.get(data.requestId);
      if (pending) {
        if (data.type === 'error') {
          pending.reject(new Error(data.payload?.error || 'Unknown error'));
        } else {
          pending.resolve(data.payload || {});
        }
      }
    }
  }
}

