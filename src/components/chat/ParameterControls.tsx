import React from 'react';

interface ParameterControlsProps {
  temperature: number;
  topK: number;
  onTemperatureChange: (value: number) => void;
  onTopKChange: (value: number) => void;
}

export const ParameterControls: React.FC<ParameterControlsProps> = ({
  temperature,
  topK,
  onTemperatureChange,
  onTopKChange,
}) => {
  return (
    <div style={{
      marginBottom: '10px',
      padding: '10px',
      backgroundColor: '#2d2d2d',
      borderRadius: '4px',
      display: 'flex',
      gap: '15px',
      flexWrap: 'wrap',
      fontSize: '12px'
    }}>
      <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Temperature: {temperature.toFixed(1)}
        <input
          type="range"
          min="0.1"
          max="1.5"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          style={{ width: '100px' }}
        />
      </label>
      <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        TopK: {topK}
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={topK}
          onChange={(e) => onTopKChange(parseInt(e.target.value))}
          style={{ width: '100px' }}
        />
      </label>
    </div>
  );
};

