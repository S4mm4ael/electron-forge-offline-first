import React, { useState, useEffect, useCallback } from 'react';
import { useLLM } from '../hooks/useLLM';
import { useChatMessages } from '../hooks/useChatMessages';
import { useChatGeneration } from '../hooks/useChatGeneration';
import { ParameterControls } from './chat/ParameterControls';
import { ModelSelector, Model } from './chat/ModelSelector';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { ErrorDisplay } from './chat/ErrorDisplay';
import { StatusDisplay } from './chat/StatusDisplay';
import { filterSpecialTokens } from '../utils/contentFilter';

const AVAILABLE_MODELS: Model[] = [
  { name: 'Llama 3 8B', alias: 'llama-3-8b' },
  { name: 'Phi-3', alias: 'phi-3' },
];

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model>(AVAILABLE_MODELS[0]);
  const [modelPath, setModelPath] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [topK, setTopK] = useState(30);

  // Business logic hooks
  const llm = useLLM();
  const chatMessages = useChatMessages();

  // Handle message updates during streaming
  const handleMessageUpdate = useCallback((id: string, content: string) => {
    chatMessages.setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      )
    );
  }, [chatMessages]);

  // Handle repetition detection
  const handleRepetitionDetected = useCallback((reason: string) => {
    // Status will be set by useChatGeneration
    console.warn('Repetition detected:', reason);
  }, []);

  const generation = useChatGeneration(
    () => chatMessages.messages,
    handleMessageUpdate,
    chatMessages.finishStreaming,
    handleRepetitionDetected
  );

  // Cleanup: destroy LLM session when component unmounts
  useEffect(() => {
    return () => {
      const electronAi = (window as any).electronAi;
      if (electronAi && llm.isInitialized) {
        electronAi.destroy().catch((err: any) => {
          console.error('Error destroying LLM on unmount:', err);
        });
      }
    };
  }, [llm.isInitialized]);

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
        llm.setError(null);
      }
    } catch (err) {
      llm.setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const handleInitialize = async () => {
    const success = await llm.initialize({
      modelAlias: selectedModel.alias,
      modelPath,
      temperature,
      topK,
    });

    if (success) {
      chatMessages.clearMessages();
    }
  };

  const handleReset = async () => {
    await llm.reset();
    chatMessages.clearMessages();
    generation.setStatus(null);
  };

  const handleSend = async () => {
    if (!input.trim() || generation.isGenerating || !llm.isInitialized) return;

    const userMessage = chatMessages.addUserMessage(input);
    const assistantMessage = chatMessages.addAssistantMessage();

    setInput('');

    try {
      await generation.generate(
        userMessage.content,
        { temperature, topK },
        assistantMessage.id
      );
    } catch (err) {
      llm.setError(err instanceof Error ? err.message : 'Failed to generate response');
      chatMessages.removeMessage(assistantMessage.id);
    }
  };

  const handleCancel = () => {
    generation.cancel();
    if (chatMessages.streamingMessageRef.current) {
      chatMessages.finishStreaming(chatMessages.streamingMessageRef.current.id);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1e1e1e',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      boxSizing: 'border-box',
    }}>
      <h3 style={{ color: '#fff', marginBottom: '15px' }}>AI Chat (Local LLM)</h3>

      {/* Generation Parameters */}
      {llm.isInitialized && (
        <ParameterControls
          temperature={temperature}
          topK={topK}
          onTemperatureChange={setTemperature}
          onTopKChange={setTopK}
        />
      )}

      {/* Model Selection and Initialization */}
      <ModelSelector
        models={AVAILABLE_MODELS}
        selectedModel={selectedModel}
        modelPath={modelPath}
        isInitialized={llm.isInitialized}
        isInitializing={llm.isInitializing}
        onModelChange={setSelectedModel}
        onPathChange={setModelPath}
        onSelectFile={handleSelectFile}
        onInitialize={handleInitialize}
        onReset={handleReset}
      />

      {/* Error Display */}
      <ErrorDisplay error={llm.error} />

      {/* Messages Area */}
      <MessageList
        messages={chatMessages.messages}
        isInitialized={llm.isInitialized}
        messagesEndRef={chatMessages.messagesEndRef}
      />

      {/* Input Area */}
      <MessageInput
        value={input}
        isInitialized={llm.isInitialized}
        isGenerating={generation.isGenerating}
        onChange={setInput}
        onSend={handleSend}
        onCancel={handleCancel}
      />

      {/* Status indicator */}
      <StatusDisplay status={generation.status} />
    </div>
  );
};
