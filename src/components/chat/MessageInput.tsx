import React from 'react';

interface MessageInputProps {
  value: string;
  isInitialized: boolean;
  isGenerating: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  isInitialized,
  isGenerating,
  onChange,
  onSend,
  onCancel,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={isInitialized ? 'Type your message... (Press Enter to send)' : 'Initialize a model first...'}
        disabled={!isInitialized || isGenerating}
        style={{
          flex: 1,
          padding: '12px',
          backgroundColor: '#2d2d2d',
          color: '#fff',
          border: '1px solid #444',
          borderRadius: '4px',
          fontSize: '14px',
          resize: 'vertical',
          minHeight: '60px',
          maxHeight: '120px',
          fontFamily: 'inherit',
          cursor: !isInitialized || isGenerating ? 'not-allowed' : 'text',
        }}
      />
      {isGenerating ? (
        <button
          onClick={onCancel}
          style={{
            padding: '12px 20px',
            backgroundColor: '#ff4444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Cancel
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!isInitialized || isGenerating || !value.trim()}
          style={{
            padding: '12px 20px',
            backgroundColor: '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: !isInitialized || isGenerating || !value.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: !isInitialized || isGenerating || !value.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      )}
    </div>
  );
};

