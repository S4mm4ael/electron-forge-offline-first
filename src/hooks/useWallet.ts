import { useState, useEffect, useCallback } from 'react';

interface WalletState {
  address: string | null;
  hasWallet: boolean;
  isEncryptionAvailable: boolean;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
}

export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    address: null,
    hasWallet: false,
    isEncryptionAvailable: false,
    isLoading: true,
    isCreating: false,
    error: null,
  });

  const checkEncryption = useCallback(async () => {
    try {
      const available = await window.electronAPI.walletIsEncryptionAvailable();
      setState((prev) => ({ ...prev, isEncryptionAvailable: available }));
    } catch (error) {
      console.error('Error checking encryption availability:', error);
    }
  }, []);

  const checkWallet = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      
      const hasWallet = await window.electronAPI.walletHasWallet();
      let address: string | null = null;
      
      if (hasWallet) {
        address = await window.electronAPI.walletGetAddress();
      }
      
      setState((prev) => ({
        ...prev,
        hasWallet,
        address,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check wallet',
      }));
    }
  }, []);

  const createWallet = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isCreating: true, error: null }));
      
      const result = await window.electronAPI.walletCreate();
      
      setState((prev) => ({
        ...prev,
        address: result.address,
        hasWallet: true,
        isCreating: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isCreating: false,
        error: error instanceof Error ? error.message : 'Failed to create wallet',
      }));
    }
  }, []);

  // Check encryption and wallet on mount
  useEffect(() => {
    checkEncryption();
    checkWallet();
  }, [checkEncryption, checkWallet]);

  return {
    ...state,
    createWallet,
    refresh: checkWallet,
  };
};

