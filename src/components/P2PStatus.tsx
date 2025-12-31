import React from 'react';
import { useP2P } from '../hooks/useP2P';

export const P2PStatus: React.FC = () => {
  const { peerCount, isConnected, isLoading, error } = useP2P();

  if (error) {
    return (
      <div style={{
        padding: '5px 10px',
        backgroundColor: '#ff4444',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#fff',
      }}>
        P2P Error
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        padding: '5px 10px',
        backgroundColor: '#666',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#fff',
      }}>
        P2P Loading...
      </div>
    );
  }

  return (
    <div style={{
      padding: '5px 10px',
      backgroundColor: isConnected ? '#4CAF50' : '#ff9800',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    }}>
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: isConnected ? '#fff' : '#fff',
        opacity: isConnected ? 1 : 0.5,
        animation: isConnected ? 'pulse 2s infinite' : 'none',
      }} />
      <span>Peers Online: {peerCount}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

