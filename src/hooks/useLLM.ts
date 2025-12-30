import { useState, useCallback } from 'react';

interface LLMConfig {
  modelAlias: string;
  modelPath: string;
  temperature: number;
  topK: number;
  systemPrompt?: string;
}

export const useLLM = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async (config: LLMConfig) => {
    if (!config.modelPath.trim()) {
      setError('Please provide a model path');
      return false;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const electronAi = (window as any).electronAi;
      if (!electronAi) {
        throw new Error('@electron/llm not loaded. Please restart the app.');
      }

      // Destroy existing model if any to reset conversation history
      if (isInitialized) {
        console.log('Destroying existing model to reset state...');
        try {
          await electronAi.destroy();
        } catch (err) {
          console.warn('Error destroying existing model (may not exist):', err);
        }
      }

      // Register the model path with the main process
      await window.electronAPI.llmRegisterModelPath(config.modelAlias, config.modelPath);

      // Create the model using the alias
      console.log('Creating new LLM model instance...');
      await electronAi.create({
        modelAlias: config.modelAlias,
        systemPrompt: config.systemPrompt || 'You are a helpful AI assistant. Provide clear, concise answers. Do not repeat yourself. Each response should be unique and relevant to the conversation.',
        temperature: config.temperature,
        topK: config.topK,
      });

      console.log('LLM model initialized successfully');
      setIsInitialized(true);
      setIsInitializing(false);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize model');
      setIsInitializing(false);
      return false;
    }
  }, [isInitialized]);

  const destroy = useCallback(async () => {
    try {
      const electronAi = (window as any).electronAi;
      if (electronAi && isInitialized) {
        console.log('Resetting LLM session...');
        await electronAi.destroy();
        console.log('LLM session destroyed');
      }
    } catch (err) {
      console.error('Error destroying LLM session:', err);
    }

    setIsInitialized(false);
    setError(null);
  }, [isInitialized]);

  const reset = useCallback(async () => {
    await destroy();
  }, [destroy]);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    destroy,
    reset,
    setError,
  };
};

