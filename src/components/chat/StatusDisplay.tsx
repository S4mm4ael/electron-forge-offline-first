import React from 'react';

interface StatusDisplayProps {
  status: string | null;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ status }) => {
  if (!status) return null;

  return (
    <div style={{
      marginTop: '8px',
      color: '#888',
      fontSize: '12px',
      fontStyle: 'italic',
      paddingLeft: '4px'
    }}>
      {status}
    </div>
  );
};

