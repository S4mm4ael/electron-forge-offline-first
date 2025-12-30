import { useState, useCallback, useRef } from 'react';
import { Message } from './useChatMessages';
import { detectRepetition } from '../utils/repetitionDetection';
import { filterSpecialTokens, checkProblematicPatterns } from '../utils/contentFilter';

interface GenerationOptions {
  temperature: number;
  topK: number;
}

export const useChatGeneration = (
  getMessages: () => Message[],
  onMessageUpdate: (id: string, content: string) => void,
  onStreamingFinish: (id: string) => void,
  onRepetitionDetected: (reason: string) => void
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const currentContentRef = useRef<string>('');

  const generate = useCallback(async (
    prompt: string,
    options: GenerationOptions,
    assistantMessageId: string
  ) => {
    setIsGenerating(true);
    setStatus(null);
    currentContentRef.current = '';

    try {
      const electronAi = (window as any).electronAi;
      if (!electronAi) {
        throw new Error('@electron/llm not available');
      }

      const messages = getMessages();

      // Log conversation state for debugging
      console.log('=== LLM Request ===');
      console.log('Current message:', prompt);
      console.log('Message history (before current):', messages.slice(0, -2).map(m => ({
        role: m.role,
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        id: m.id
      })));
      console.log('Temperature:', options.temperature, 'TopK:', options.topK);
      console.log('Total messages in history:', messages.length - 2, '(before current)');

      const stream = await electronAi.promptStreaming(prompt, {
        temperature: options.temperature,
        topK: options.topK,
      });

      console.log('Stream started, waiting for response...');

      let repetitionDetected = false;
      let streamAborted = false;

      for await (const chunk of stream) {
        if (repetitionDetected || streamAborted) {
          break;
        }

        currentContentRef.current += chunk;
        const newContent = currentContentRef.current;

        // Check for problematic patterns
        const patternCheck = checkProblematicPatterns(newContent);
        if (patternCheck.hasProblem) {
          repetitionDetected = true;
          streamAborted = true;
          console.warn(`⚠️ ${patternCheck.reason}`);
          console.log('Response so far:', newContent.substring(0, 500));
          setStatus(`Stopped: ${patternCheck.reason || 'Problematic pattern detected'}`);
          setIsGenerating(false);
          onStreamingFinish(assistantMessageId);
          break;
        }

        // Check for repetition
        if (newContent.length > 50 && (newContent.length % 30 === 0 || newContent.length < 200)) {
          const currentMessages = getMessages();
          if (detectRepetition(newContent, currentMessages)) {
            repetitionDetected = true;
            streamAborted = true;
            console.warn('⚠️ Repetition detected: Content matches previous messages');
            console.log('Response so far:', newContent.substring(0, 500));
            setStatus('Stopped: Repetition detected');
            setIsGenerating(false);
            onStreamingFinish(assistantMessageId);
            break;
          }
        }

        // Filter and update content
        const cleanedContent = filterSpecialTokens(newContent);
        onMessageUpdate(assistantMessageId, cleanedContent);
        currentContentRef.current = cleanedContent;
      }

      // Final cleanup
      setIsGenerating(false);
      if (!repetitionDetected) {
        setStatus(null);
      }

      // Final check for repetition in complete message
      const finalMessages = getMessages();
      const finalMessage = finalMessages.find(m => m.id === assistantMessageId);
      if (finalMessage && !repetitionDetected) {
        const cleaned = filterSpecialTokens(finalMessage.content);
        if (detectRepetition(cleaned, finalMessages)) {
          setStatus('Note: Response may contain repetition');
        }
      }

      onStreamingFinish(assistantMessageId);

      // Log final response
      if (finalMessage) {
        console.log('=== LLM Response Complete ===');
        console.log('Response length:', finalMessage.content.length);
        console.log('Response preview:', finalMessage.content.substring(0, 200) + '...');
        console.log('Repetition detected:', repetitionDetected);
      }
    } catch (err) {
      setIsGenerating(false);
      setStatus(null);
      throw err;
    }
  }, [getMessages, onMessageUpdate, onStreamingFinish, onRepetitionDetected]);

  const cancel = useCallback(() => {
    setIsGenerating(false);
    setStatus('Generation cancelled');
  }, []);

  return {
    isGenerating,
    status,
    generate,
    cancel,
    setStatus,
  };
};

