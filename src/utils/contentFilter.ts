/**
 * Filters out special tokens and formatting markers from model output
 */
export const filterSpecialTokens = (content: string): string => {
  let cleaned = content;

  // Remove common chat template tokens
  cleaned = cleaned.replace(/ยวก(user|assistant|system)ยวก/gi, '');
  cleaned = cleaned.replace(/ยวก/g, '');

  // Remove other potential formatting markers
  cleaned = cleaned.replace(/<\|(user|assistant|system)\|>/gi, '');
  cleaned = cleaned.replace(/\[(user|assistant|system)\]/gi, '');
  cleaned = cleaned.replace(/\{\{(user|assistant|system)\}\}/gi, '');

  // Remove common special tokens
  cleaned = cleaned.replace(/<\|endoftext\|>/gi, '');
  cleaned = cleaned.replace(/<\|im_start\|>/gi, '');
  cleaned = cleaned.replace(/<\|im_end\|>/gi, '');

  // Remove "弋" character loops
  cleaned = cleaned.replace(/弋+/g, '');

  // Remove any trailing repeated characters (likely token loops)
  cleaned = cleaned.replace(/(.)\1{50,}$/, '');

  return cleaned;
};

/**
 * Checks if content contains problematic patterns that should trigger early stopping
 */
export const checkProblematicPatterns = (content: string): {
  hasProblem: boolean;
  reason?: string;
} => {
  const contentLower = content.toLowerCase();

  // Check for conversation pattern repetition
  const userCount = (contentLower.match(/user:/g) || []).length;
  const assistantCount = (contentLower.match(/assistant:/g) || []).length;
  if (userCount > 1 || assistantCount > 1) {
    return { hasProblem: true, reason: 'Multiple User/Assistant patterns found' };
  }

  // Check for "弋" character loops
  if (content.match(/弋{10,}/)) {
    return { hasProblem: true, reason: 'Excessive "弋" characters detected' };
  }

  // Check for excessive repetition of any single character
  const charCounts = new Map<string, number>();
  for (const char of content.slice(-200)) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  for (const [char, count] of charCounts.entries()) {
    if (count > 50 && content.endsWith(char.repeat(count))) {
      return { hasProblem: true, reason: `Character loop detected (${char})` };
    }
  }

  return { hasProblem: false };
};

