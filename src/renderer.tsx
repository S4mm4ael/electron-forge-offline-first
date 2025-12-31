import { createRoot } from 'react-dom/client';
import React, { useState, useEffect } from 'react';
import { SystemHealth } from './components/SystemHealth';
import { ChatInterface } from './components/ChatInterface';
import { P2PStatus } from './components/P2PStatus';
import { WalletManager } from './components/WalletManager';
import './index.css';

const App: React.FC = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for Electron window resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isSmallScreen = windowSize.width < 768;
  const isMediumScreen = windowSize.width >= 768 && windowSize.width < 1024;

  return (
    <div style={{ 
      width: '100vw',
      height: '100vh',
      backgroundColor: '#121212',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Header with System Health Ticker */}
      <header style={{
        backgroundColor: '#1e1e1e',
        padding: isSmallScreen ? '10px 15px' : '15px 20px',
        borderBottom: '2px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: isSmallScreen ? 'wrap' : 'nowrap',
        gap: isSmallScreen ? '10px' : '0',
        minHeight: isSmallScreen ? 'auto' : '60px',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isSmallScreen ? '16px' : isMediumScreen ? '18px' : '20px', 
          color: '#4CAF50',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          Electron Sandbox Breakout Demo
        </h1>
        <div style={{ 
          flexShrink: 0,
          width: isSmallScreen ? '100%' : 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <P2PStatus />
          <SystemHealth />
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: isSmallScreen ? '10px' : '20px',
        display: 'flex',
        flexDirection: isSmallScreen ? 'column' : 'row',
        gap: isSmallScreen ? '10px' : '20px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        minHeight: 0, // Important for flex children to shrink
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
        }}>
          <ChatInterface />
        </div>
        <div style={{
          width: isSmallScreen ? '100%' : '350px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: 0,
          overflowY: 'auto',
        }}>
          <WalletManager />
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);