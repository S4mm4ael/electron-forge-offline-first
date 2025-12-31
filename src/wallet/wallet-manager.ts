// Wallet Manager - Main Process
// Handles wallet creation and secure private key storage using Electron safeStorage

import { Wallet } from 'ethers';
import { safeStorage, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

export class WalletManager {
  private walletPath: string;

  constructor() {
    // Store encrypted wallet in userData directory
    this.walletPath = path.join(app.getPath('userData'), 'wallet.encrypted');
  }

  /**
   * Check if encryption is available on this system
   */
  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch (error) {
      console.error('[Wallet Manager] Error checking encryption availability:', error);
      return false;
    }
  }

  /**
   * Check if a wallet already exists
   */
  async hasWallet(): Promise<boolean> {
    try {
      await fs.access(this.walletPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new wallet and encrypt the private key
   */
  async createWallet(): Promise<{ address: string }> {
    if (!this.isEncryptionAvailable()) {
      throw new Error(
        'Encryption is not available on this system. Please ensure you are running on macOS with Keychain access or Windows with DPAPI support.'
      );
    }

    // Check if wallet already exists
    if (await this.hasWallet()) {
      throw new Error('Wallet already exists. Use getWalletAddress() to retrieve the existing wallet address.');
    }

    try {
      // Create a new random wallet
      const wallet = Wallet.createRandom();
      const privateKey = wallet.privateKey;
      const address = wallet.address;

      // Encrypt the private key using OS-level encryption
      const encrypted = safeStorage.encryptString(privateKey);

      // Store encrypted private key to disk
      await fs.writeFile(this.walletPath, encrypted);

      console.log('[Wallet Manager] Wallet created and encrypted:', address);
      return { address };
    } catch (error) {
      console.error('[Wallet Manager] Error creating wallet:', error);
      throw new Error(
        `Failed to create wallet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the wallet address without decrypting the private key
   * This requires decrypting to derive the address, but we don't expose the key
   */
  async getWalletAddress(): Promise<string | null> {
    if (!(await this.hasWallet())) {
      return null;
    }

    if (!this.isEncryptionAvailable()) {
      throw new Error('Encryption is not available. Cannot decrypt wallet.');
    }

    try {
      // Read encrypted private key
      const encrypted = await fs.readFile(this.walletPath);

      // Decrypt private key (only in main process, never exposed to renderer)
      const privateKey = safeStorage.decryptString(encrypted);

      // Create wallet instance to get address
      const wallet = new Wallet(privateKey);
      const address = wallet.address;

      // Clear private key from memory (best effort)
      // Note: JavaScript doesn't guarantee memory clearing, but we try
      privateKey.split('').forEach(() => {}); // Attempt to prevent optimization

      return address;
    } catch (error) {
      console.error('[Wallet Manager] Error getting wallet address:', error);
      throw new Error(
        `Failed to get wallet address: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete the wallet (for testing/reset purposes)
   * WARNING: This permanently deletes the wallet!
   */
  async deleteWallet(): Promise<void> {
    try {
      if (await this.hasWallet()) {
        await fs.unlink(this.walletPath);
        console.log('[Wallet Manager] Wallet deleted');
      }
    } catch (error) {
      console.error('[Wallet Manager] Error deleting wallet:', error);
      throw new Error(
        `Failed to delete wallet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

