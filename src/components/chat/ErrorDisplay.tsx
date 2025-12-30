import React from 'react';

interface ErrorDisplayProps {
  error: string | null;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  if (!error) return null;

  return (
    <div style={{
      color: '#ff4444',
      marginBottom: '15px',
      padding: '10px',
      backgroundColor: '#3a1a1a',
      borderRadius: '4px',
      fontSize: '14px'
    }}>
      Error: {error}
    </div>
  );
};

