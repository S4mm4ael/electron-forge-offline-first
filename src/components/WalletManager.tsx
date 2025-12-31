import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';

export const WalletManager: React.FC = () => {
  const { address, hasWallet, isEncryptionAvailable, isLoading, isCreating, error, createWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  const formatAddress = (addr: string | null): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isEncryptionAvailable) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        color: '#fff',
      }}>
        <h3 style={{ color: '#fff', marginBottom: '15px' }}>Wallet Manager</h3>
        <div style={{
          padding: '15px',
          backgroundColor: '#ff4444',
          borderRadius: '4px',
          color: '#fff',
        }}>
          <strong>Encryption Not Available</strong>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
            Wallet encryption is not available on this system. Please ensure you are running on macOS with Keychain access or Windows with DPAPI support.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        color: '#fff',
      }}>
        <h3 style={{ color: '#fff', marginBottom: '15px' }}>Wallet Manager</h3>
        <div style={{ color: '#999' }}>Loading wallet...</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1e1e1e',
      borderRadius: '8px',
      color: '#fff',
    }}>
      <h3 style={{ color: '#fff', marginBottom: '15px' }}>Wallet Manager</h3>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ff4444',
          borderRadius: '4px',
          marginBottom: '15px',
          color: '#fff',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {hasWallet && address ? (
        <div>
          <div style={{
            padding: '15px',
            backgroundColor: '#2a2a2a',
            borderRadius: '4px',
            marginBottom: '15px',
          }}>
            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#999' }}>
              Wallet Address
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'monospace',
              fontSize: '16px',
              wordBreak: 'break-all',
            }}>
              <span style={{ color: '#4CAF50' }}>{address}</span>
              <button
                onClick={handleCopyAddress}
                style={{
                  padding: '5px 10px',
                  backgroundColor: copied ? '#4CAF50' : '#333',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{
              marginTop: '10px',
              fontSize: '12px',
              color: '#666',
            }}>
              {formatAddress(address)}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: '15px', color: '#999' }}>
            No wallet found. Create a new wallet to get started.
          </p>
          <button
            onClick={createWallet}
            disabled={isCreating}
            style={{
              padding: '10px 20px',
              backgroundColor: isCreating ? '#666' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
          </button>
        </div>
      )}
    </div>
  );
};

