import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const AVAILABLE_MODELS = [
  { name: 'Llama 3 8B', alias: 'llama-3-8b' },
  { name: 'Phi-3', alias: 'phi-3' },
];

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [modelPath, setModelPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingMessageRef = useRef<Message | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if @electron/llm is loaded
  useEffect(() => {
    if ((window as any).electronAi) {
      console.log('@electron/llm is available');
    } else {
      console.warn('@electron/llm not available yet');
    }
  }, []);

  const handleSelectFile = async () => {
    try {
      const selectedPath = await window.electronAPI.selectGGUFFile();
      if (selectedPath) {
        setModelPath(selectedPath);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const handleInitialize = async () => {
    if (!modelPath.trim()) {
      setError('Please provide a model path');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Use @electron/llm's window.electronAi API directly
      const electronAi = (window as any).electronAi;
      if (!electronAi) {
        throw new Error('@electron/llm not loaded. Please restart the app.');
      }
      
      // Register the model path with the main process
      await window.electronAPI.llmRegisterModelPath(selectedModel.alias, modelPath);
      
      // Create the model using the alias
      // @electron/llm will use getModelPath to resolve the alias to the actual file path
      await electronAi.create({
        modelAlias: selectedModel.alias,
        systemPrompt: 'You are a helpful AI assistant.',
      });
      
      setIsInitialized(true);
      setIsInitializing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize model');
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !isInitialized) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsGenerating(true);
    streamingMessageRef.current = assistantMessage;

    try {
      // Use @electron/llm's streaming API
      const electronAi = (window as any).electronAi;
      if (!electronAi) {
        throw new Error('@electron/llm not available');
      }

      // Use promptStreaming for real-time streaming
      const stream = await electronAi.promptStreaming(userMessage.content);
      
      // Stream the response
      for await (const chunk of stream) {
        if (streamingMessageRef.current) {
          const currentId = streamingMessageRef.current.id;
          setMessages((prev) =>
            prev
              .filter((msg) => msg !== null && msg !== undefined)
              .map((msg) =>
                msg.id === currentId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
          );
        }
      }

      // Generation complete
      setIsGenerating(false);
      if (streamingMessageRef.current) {
        const currentId = streamingMessageRef.current.id;
        setMessages((prev) =>
          prev
            .filter((msg) => msg !== null && msg !== undefined)
            .map((msg) =>
              msg.id === currentId
                ? { ...msg, isStreaming: false }
                : msg
            )
        );
        streamingMessageRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate response');
      setIsGenerating(false);
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id));
      streamingMessageRef.current = null;
    }
  };

  const handleCancel = () => {
    // @electron/llm doesn't have a direct cancel method in the current API
    // We'll just stop the generation state
    setIsGenerating(false);
    setCurrentRequestId(null);
    if (streamingMessageRef.current) {
      const currentId = streamingMessageRef.current.id;
      setMessages((prev) =>
        prev
          .filter((msg) => msg !== null && msg !== undefined) // Filter out null/undefined messages
          .map((msg) =>
            msg.id === currentId
              ? { ...msg, isStreaming: false, content: msg.content + '\n\n[Generation cancelled]' }
              : msg
          )
      );
      streamingMessageRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px', display: 'flex', flexDirection: 'column', height: '600px' }}>
      <h3 style={{ color: '#fff', marginBottom: '15px' }}>AI Chat (Local LLM)</h3>

      {/* Model Selection and Initialization */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedModel.alias}
          onChange={(e) => {
            const model = AVAILABLE_MODELS.find((m) => m.alias === e.target.value);
            if (model) setSelectedModel(model);
          }}
          disabled={isInitialized || isInitializing}
          style={{
            padding: '8px 12px',
            backgroundColor: '#2d2d2d',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: isInitialized || isInitializing ? 'not-allowed' : 'pointer',
          }}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.alias} value={model.alias}>
              {model.name}
            </option>
          ))}
        </select>

        <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={modelPath}
          onChange={(e) => setModelPath(e.target.value)}
          placeholder="Model alias (e.g., llama-3-8b) or full path..."
          disabled={isInitialized || isInitializing}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: '#2d2d2d',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        />
          <button
            onClick={handleSelectFile}
            disabled={isInitialized || isInitializing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#64B5F6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isInitialized || isInitializing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              opacity: isInitialized || isInitializing ? 0.6 : 1,
            }}
            title="Browse for GGUF file"
          >
            Browse
          </button>
        </div>

        <button
          onClick={handleInitialize}
          disabled={isInitialized || isInitializing || !modelPath.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: isInitialized ? '#4CAF50' : '#64B5F6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isInitialized || isInitializing || !modelPath.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            opacity: isInitialized || isInitializing || !modelPath.trim() ? 0.6 : 1,
          }}
        >
          {isInitialized ? '✓ Initialized' : isInitializing ? 'Initializing...' : 'Initialize Model'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#ff4444', marginBottom: '15px', padding: '10px', backgroundColor: '#3a1a1a', borderRadius: '4px', fontSize: '14px' }}>
          Error: {error}
        </div>
      )}

      {/* Messages Area */}
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
                  <span style={{ display: 'inline-block', width: '8px', height: '14px', backgroundColor: '#fff', marginLeft: '4px', animation: 'blink 1s infinite' }} />
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

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
            onClick={handleCancel}
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
            onClick={handleSend}
            disabled={!isInitialized || isGenerating || !input.trim()}
            style={{
              padding: '12px 20px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: !isInitialized || isGenerating || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: !isInitialized || isGenerating || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};

