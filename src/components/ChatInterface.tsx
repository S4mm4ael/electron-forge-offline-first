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
  const [temperature, setTemperature] = useState(0.4); // Lower default for less repetition
  const [topK, setTopK] = useState(30);
  const [status, setStatus] = useState<string | null>(null);
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
        systemPrompt: 'You are a helpful AI assistant. Provide clear, concise answers. Do not repeat yourself. Each response should be unique and relevant to the conversation.',
        temperature: temperature,
        topK: topK,
      });
      
      setIsInitialized(true);
      setIsInitializing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize model');
      setIsInitializing(false);
    }
  };

  // Helper function to detect repetition - more aggressive detection
  const detectRepetition = (text: string, previousMessages: Message[] = [], threshold: number = 1): boolean => {
    if (text.length < 30) return false; // Too short to detect repetition
    
    const textLower = text.toLowerCase();
    
    // Check if the response contains "User:" or "Assistant:" patterns (indicates it's repeating conversation)
    if (textLower.includes('user:') || textLower.includes('assistant:')) {
      // Count how many times these patterns appear
      const userMatches = (textLower.match(/user:/g) || []).length;
      const assistantMatches = (textLower.match(/assistant:/g) || []).length;
      
      // If we see multiple "User:" or "Assistant:" patterns, it's likely repeating conversation
      if (userMatches > 1 || assistantMatches > 1) {
        return true;
      }
    }
    
    // Check if the response is repeating previous messages
    if (previousMessages.length > 0) {
      // Check if the response contains large chunks from previous messages
      for (const msg of previousMessages.slice(-4)) {
        if (msg.content && msg.content.length > 30) {
          const msgLower = msg.content.toLowerCase();
          
          // Extract a significant chunk from the previous message (first 200 chars)
          const msgChunk = msgLower.substring(0, Math.min(200, msgLower.length));
          
          // Check if this chunk appears in the current response
          if (textLower.includes(msgChunk) && msgChunk.length > 50) {
            return true; // Repeating previous message
          }
          
          // Also check for sentence-level repetition
          const msgSentences = msgLower.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
          const textSentences = textLower.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
          
          // If even 1 sentence from a previous message appears, it's likely repetition
          for (const msgSentence of msgSentences) {
            if (msgSentence.length > 30) {
              // Check for exact or near-exact sentence matches
              if (textSentences.some(textSentence => {
                const similarity = msgSentence === textSentence || 
                                 (msgSentence.length > 40 && textSentence.length > 40 && 
                                  msgSentence.substring(0, Math.min(80, msgSentence.length)) === 
                                  textSentence.substring(0, Math.min(80, textSentence.length)));
                return similarity;
              })) {
                return true; // Repeating previous message
              }
            }
          }
        }
      }
    }
    
    // Split into sentences and check for internal repetition
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
    if (sentences.length < threshold + 1) return false;
    
    // Check if any sentence repeats a previous one (more aggressive)
    for (let i = 1; i < sentences.length; i++) {
      const currentSentence = sentences[i].trim().toLowerCase();
      // Check against all previous sentences
      for (let j = 0; j < i; j++) {
        const prevSentence = sentences[j].trim().toLowerCase();
        if (currentSentence.length > 20 && prevSentence.length > 20) {
          // Check for exact or near-exact matches
          if (currentSentence === prevSentence || 
              (currentSentence.length > 40 && prevSentence.length > 40 &&
               currentSentence.substring(0, Math.min(60, currentSentence.length)) === 
               prevSentence.substring(0, Math.min(60, prevSentence.length)))) {
            return true; // Internal repetition detected
          }
        }
      }
    }
    
    return false;
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
    setStatus(null); // Clear previous status when starting new generation
    streamingMessageRef.current = assistantMessage;

    try {
      // Use @electron/llm's streaming API
      const electronAi = (window as any).electronAi;
      if (!electronAi) {
        throw new Error('@electron/llm not available');
      }

      // @electron/llm's session should maintain conversation history automatically
      // We'll just send the current user message and let the session handle context
      // This prevents the model from repeating the conversation context
      const promptText = userMessage.content;
      const conversationContext = ''; // Not used, but kept for repetition detection

      // Use promptStreaming for real-time streaming
      // Pass generation options to control response quality
      const stream = await electronAi.promptStreaming(promptText, {
        temperature: temperature,
        topK: topK,
      });
      
      let repetitionDetected = false;
      let streamAborted = false;
      
      // Stream the response
      for await (const chunk of stream) {
        // If repetition was detected, stop processing chunks
        if (repetitionDetected || streamAborted) {
          break;
        }
        
        if (streamingMessageRef.current) {
          const currentId = streamingMessageRef.current.id;
          setMessages((prev) => {
            const updated = prev
              .filter((msg) => msg !== null && msg !== undefined)
              .map((msg) => {
                if (msg.id === currentId) {
                  const newContent = msg.content + chunk;
                  
                  // Immediate check for conversation pattern repetition (most common issue)
                  const contentLower = newContent.toLowerCase();
                  const userCount = (contentLower.match(/user:/g) || []).length;
                  const assistantCount = (contentLower.match(/assistant:/g) || []).length;
                  
                  // If we see multiple "User:" or "Assistant:" patterns, stop immediately
                  if (userCount > 1 || assistantCount > 1) {
                    repetitionDetected = true;
                    streamAborted = true;
                    setStatus('Stopped: Conversation repetition detected');
                    setIsGenerating(false); // Immediately enable input
                    return { ...msg, content: newContent, isStreaming: false };
                  }
                  
                  // Check for repetition more frequently and earlier
                  if (newContent.length > 50) {
                    // Check every 30 characters to catch repetition early
                    if (newContent.length % 30 === 0 || newContent.length < 200) {
                      if (detectRepetition(newContent, messages)) {
                        repetitionDetected = true;
                        streamAborted = true;
                        setStatus('Stopped: Repetition detected');
                        setIsGenerating(false); // Immediately enable input
                        return { ...msg, content: newContent, isStreaming: false };
                      }
                    }
                  }
                  
                  return { ...msg, content: newContent };
                }
                return msg;
              });
            return updated;
          });
        }
      }

      // Always clean up after streaming completes (whether stopped early or completed)
      // Only set isGenerating to false if we haven't already (to avoid race conditions)
      if (isGenerating) {
        setIsGenerating(false);
      }
      
      if (streamingMessageRef.current) {
        const currentId = streamingMessageRef.current.id;
        
        // If repetition was detected, we already updated the message, just finalize it
        if (repetitionDetected) {
          setMessages((prev) =>
            prev
              .filter((msg) => msg !== null && msg !== undefined)
              .map((msg) =>
                msg.id === currentId
                  ? { ...msg, isStreaming: false }
                  : msg
              )
          );
        } else {
          // Normal completion - check for repetition one final time
          setStatus(null); // Clear status on successful completion
          setMessages((prev) =>
            prev
              .filter((msg) => msg !== null && msg !== undefined)
              .map((msg) => {
                if (msg.id === currentId) {
                  // Final check for repetition in the complete message
                  if (detectRepetition(msg.content, messages)) {
                    setStatus('Note: Response may contain repetition');
                    return { ...msg, isStreaming: false };
                  }
                  return { ...msg, isStreaming: false };
                }
                return msg;
              })
          );
        }
        
        streamingMessageRef.current = null;
      } else if (!repetitionDetected) {
        // No streaming message ref but no repetition - clear status
        setStatus(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate response');
      setIsGenerating(false);
      setStatus(null); // Clear status on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessage.id));
      streamingMessageRef.current = null;
    } finally {
      // Ensure isGenerating is always false, even if something goes wrong
      setIsGenerating(false);
      if (streamingMessageRef.current) {
        streamingMessageRef.current = null;
      }
    }
  };

  const handleCancel = () => {
    // @electron/llm doesn't have a direct cancel method in the current API
    // We'll just stop the generation state
    setIsGenerating(false);
    setCurrentRequestId(null);
    setStatus('Generation cancelled');
    if (streamingMessageRef.current) {
      const currentId = streamingMessageRef.current.id;
      setMessages((prev) =>
        prev
          .filter((msg) => msg !== null && msg !== undefined) // Filter out null/undefined messages
          .map((msg) =>
            msg.id === currentId
              ? { ...msg, isStreaming: false }
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

      {/* Generation Parameters */}
      {isInitialized && (
        <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#2d2d2d', borderRadius: '4px', display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '12px' }}>
          <label style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Temperature: {temperature.toFixed(1)}
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
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
              onChange={(e) => setTopK(parseInt(e.target.value))}
              style={{ width: '100px' }}
            />
          </label>
        </div>
      )}

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
      
      {/* Status indicator */}
      {status && (
        <div style={{ 
          marginTop: '8px', 
          color: '#888', 
          fontSize: '12px', 
          fontStyle: 'italic',
          paddingLeft: '4px'
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

