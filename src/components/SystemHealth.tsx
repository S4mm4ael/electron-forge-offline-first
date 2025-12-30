import React, { useEffect, useState } from 'react';

interface SystemStats {
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
}

const formatBytes = (bytes: number): string => {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
};

export const SystemHealth: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const updateStats = async () => {
      try {
        const data = await window.electronAPI.getSystemStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to get system stats:', error);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return <div>Loading system stats...</div>;
  }

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '14px' }}>
      <div>
        <strong>RAM:</strong> {formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)} 
        <span style={{ marginLeft: '8px', color: stats.memory.usagePercent > 80 ? '#ff4444' : '#44ff44' }}>
          ({stats.memory.usagePercent.toFixed(1)}%)
        </span>
      </div>
      <div>
        <strong>CPU:</strong> {stats.cpu.model.split(' ')[0]} ({stats.cpu.cores} cores) 
        <span style={{ marginLeft: '8px', color: stats.cpu.loadPercent > 80 ? '#ff4444' : '#44ff44' }}>
          {stats.cpu.loadPercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

