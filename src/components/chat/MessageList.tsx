import React from 'react';
import { Message } from '../../hooks/useChatMessages';

interface MessageListProps {
  messages: Message[];
  isInitialized: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isInitialized,
  messagesEndRef,
}) => {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#2d2d2d',
        borderRadius: '4px',
        padding: '15px',
        marginBottom: '15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        minHeight: 0,
        maxHeight: '100%',
      }}
    >
      {messages.length === 0 ? (
        <div style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
          {isInitialized
            ? 'Start a conversation with the AI...'
            : 'Please initialize a model first to start chatting'}
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 16px',
                backgroundColor: message.role === 'user' ? '#4CAF50' : '#3a3a3a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content || (message.isStreaming ? '...' : '')}
              {message.isStreaming && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '14px',
                    backgroundColor: '#fff',
                    marginLeft: '4px',
                    animation: 'blink 1s infinite',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

