import { createRoot } from 'react-dom/client';
import React from 'react';
import { SystemHealth } from './components/SystemHealth';
import { RAMChart } from './components/RAMChart';
import { FileBrowser } from './components/FileBrowser';
import { ChatInterface } from './components/ChatInterface';
import './index.css';

const App: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#121212',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header with System Health Ticker */}
      <header style={{
        backgroundColor: '#1e1e1e',
        padding: '15px 20px',
        borderBottom: '2px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#4CAF50' }}>
          Electron Sandbox Breakout Demo
        </h1>
        <SystemHealth />
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <RAMChart />
          <FileBrowser />
        </div>
        <ChatInterface />
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