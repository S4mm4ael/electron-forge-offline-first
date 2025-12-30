import React, { useEffect, useState, useRef } from 'react';

interface DataPoint {
  time: number;
  usage: number;
}

export const RAMChart: React.FC = () => {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 200 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxPoints = 60; // Show last 60 seconds

  // Update canvas size based on container width
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const padding = 40; // Account for padding
        const width = containerWidth - padding;
        setCanvasSize({ width: Math.max(width, 300), height: 200 });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const updateStats = async () => {
      try {
        const stats = await window.electronAPI.getSystemStats();
        const now = Date.now();
        
        setDataPoints(prev => {
          const newPoints = [...prev, { time: now, usage: stats.memory.usagePercent }];
          // Keep only the last maxPoints
          return newPoints.slice(-maxPoints);
        });
      } catch (error) {
        console.error('Failed to get system stats:', error);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match the size state
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (dataPoints.length === 0) return;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw chart
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const minTime = dataPoints[0]?.time || Date.now();
    const maxTime = dataPoints[dataPoints.length - 1]?.time || Date.now();
    const timeRange = maxTime - minTime || 1;

    dataPoints.forEach((point, index) => {
      const x = (index / (dataPoints.length - 1 || 1)) * width;
      const y = height - (point.usage / 100) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under curve
    ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Draw current value
    if (dataPoints.length > 0) {
      const lastPoint = dataPoints[dataPoints.length - 1];
      const x = width;
      const y = height - (lastPoint.usage / 100) * height;

      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lastPoint.usage.toFixed(1)}%`, width - 10, y - 10);
    }
  }, [dataPoints, canvasSize]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        padding: '20px', 
        backgroundColor: '#1e1e1e', 
        borderRadius: '8px', 
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <h3 style={{ color: '#fff', marginBottom: '10px' }}>RAM Usage (Real-time)</h3>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ 
          backgroundColor: '#2d2d2d', 
          borderRadius: '4px',
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
      <div style={{ marginTop: '10px', color: '#aaa', fontSize: '12px' }}>
        Showing last {dataPoints.length} seconds
      </div>
    </div>
  );
};

