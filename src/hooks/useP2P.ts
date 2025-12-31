import { useState, useEffect, useCallback } from 'react';

interface P2PState {
  peerCount: number;
  peers: string[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useP2P = () => {
  const [state, setState] = useState<P2PState>({
    peerCount: 0,
    peers: [],
    isConnected: false,
    isLoading: true,
    error: null,
  });

  const fetchPeerCount = useCallback(async () => {
    try {
      const count = await window.electronAPI.p2pGetPeerCount();
      const peers = await window.electronAPI.p2pGetPeers();
      
      setState((prev) => ({
        ...prev,
        peerCount: count,
        peers,
        isConnected: true,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch peer count',
      }));
    }
  }, []);

  const start = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await window.electronAPI.p2pStart();
      await fetchPeerCount();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start P2P node',
      }));
    }
  }, [fetchPeerCount]);

  const stop = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await window.electronAPI.p2pStop();
      setState((prev) => ({
        ...prev,
        peerCount: 0,
        peers: [],
        isConnected: false,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to stop P2P node',
      }));
    }
  }, []);

  // Fetch peer count on mount and set up polling
  useEffect(() => {
    fetchPeerCount();

    // Poll for peer count updates every 3 seconds
    const interval = setInterval(() => {
      fetchPeerCount();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchPeerCount]);

  return {
    ...state,
    start,
    stop,
    refresh: fetchPeerCount,
  };
};

