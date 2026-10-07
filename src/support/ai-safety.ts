const sensitiveRequestPattern =
  /\b(account|login|password|passcode|otp|verification|verify|identity|payment|paid|charge|refund|billing|withdraw|wallet|bank|card|subscription|health|medical|condition|disability|fertility|pregnan\w*|safety|abuse|harass\w*|report|blocked|banned|hacked|fraud|delete|deletion|email|phone|address|location|my profile|my photo)\b/i;

const personalDataPattern =
  /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)|(?:\+?\d[\d\s().-]{7,}\d)|(?:https?:\/\/\S+)/i;

const generalTopics: Array<{ pattern: RegExp; topic: string }> = [
  {
    pattern: /\b(match(?:es|ing)?|discover|likes?|conversation|chat)\b/i,
    topic: 'finding matches and starting conversations',
  },
  { pattern: /\bwali\b|\bguardian\b/i, topic: 'how the wali feature works' },
  {
    pattern: /\b(prayer|salah|adhan|qibla)\b/i,
    topic: 'prayer times and prayer alerts',
  },
  {
    pattern: /\b(tasbih|dhikr|dhikr counter|adhkar)\b/i,
    topic: 'using the dhikr counter',
  },
  {
    pattern: /\b(notification|alert|settings)\b/i,
    topic: 'general notification and app settings',
  },
  {
    pattern: /\b(profile|photo|picture|bio)\b/i,
    topic: 'general profile setup',
  },
  {
    pattern:
      /\b(app|feature|navigate|navigation|how do i|how can i|where is)\b/i,
    topic: 'general app navigation',
  },
];

/// Returns only a predefined, non-personal topic. The user's message and
/// conversation history must never be included in a free-tier Gemini prompt.
export function generalAiHelpTopic(message: string): string | null {
  if (
    sensitiveRequestPattern.test(message) ||
    personalDataPattern.test(message)
  ) {
    return null;
  }
  return (
    generalTopics.find(({ pattern }) => pattern.test(message))?.topic ?? null
  );
}

export function isBareGreeting(message: string): boolean {
  return /^(hi|hello|hey|salam|assalamu alaikum)[!. ]*$/i.test(message.trim());
}
