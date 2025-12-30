import { Message } from '../hooks/useChatMessages';

export const detectRepetition = (
  text: string,
  previousMessages: Message[] = [],
  threshold: number = 1
): boolean => {
  if (text.length < 30) return false; // Too short to detect repetition

  const textLower = text.toLowerCase();

  // Check if the response contains "User:" or "Assistant:" patterns (indicates it's repeating conversation)
  if (textLower.includes('user:') || textLower.includes('assistant:')) {
    const userMatches = (textLower.match(/user:/g) || []).length;
    const assistantMatches = (textLower.match(/assistant:/g) || []).length;

    if (userMatches > 1 || assistantMatches > 1) {
      return true;
    }
  }

  // Check if the response is repeating previous messages
  if (previousMessages.length > 0) {
    for (const msg of previousMessages.slice(-4)) {
      if (msg.content && msg.content.length > 30) {
        const msgLower = msg.content.toLowerCase();
        const msgChunk = msgLower.substring(0, Math.min(200, msgLower.length));

        if (textLower.includes(msgChunk) && msgChunk.length > 50) {
          return true;
        }

        const msgSentences = msgLower.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
        const textSentences = textLower.split(/[.!?]\s+/).filter(s => s.trim().length > 20);

        for (const msgSentence of msgSentences) {
          if (msgSentence.length > 30) {
            if (textSentences.some(textSentence => {
              const similarity =
                msgSentence === textSentence ||
                (msgSentence.length > 40 &&
                  textSentence.length > 40 &&
                  msgSentence.substring(0, Math.min(80, msgSentence.length)) ===
                    textSentence.substring(0, Math.min(80, textSentence.length)));
              return similarity;
            })) {
              return true;
            }
          }
        }
      }
    }
  }

  // Split into sentences and check for internal repetition
  const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  if (sentences.length < threshold + 1) return false;

  // Check for phrase-level repetition
  const words = textLower.split(/\s+/);
  const phraseCounts = new Map<string, number>();

  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    if (phraseCounts.get(phrase)! > 3) {
      console.log('⚠️ Phrase repetition detected:', phrase, 'appears', phraseCounts.get(phrase), 'times');
      return true;
    }
  }

  // Check if any sentence repeats a previous one
  for (let i = 1; i < sentences.length; i++) {
    const currentSentence = sentences[i].trim().toLowerCase();
    for (let j = 0; j < i; j++) {
      const prevSentence = sentences[j].trim().toLowerCase();
      if (currentSentence.length > 20 && prevSentence.length > 20) {
        if (
          currentSentence === prevSentence ||
          (currentSentence.length > 40 &&
            prevSentence.length > 40 &&
            currentSentence.substring(0, Math.min(60, currentSentence.length)) ===
              prevSentence.substring(0, Math.min(60, prevSentence.length)))
        ) {
          console.log('⚠️ Sentence repetition detected:', currentSentence.substring(0, 80));
          return true;
        }
      }
    }
  }

  return false;
};

