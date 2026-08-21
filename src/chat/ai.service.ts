import { Injectable, Logger } from '@nestjs/common';
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private minuteWindowStart = 0;
  private minuteCount = 0;
  private dayWindowStart = 0;
  private dayCount = 0;

  private perMinuteLimit: number;
  private dailyLimit: number;
  private readonly model: string;
  private readonly requestTimeoutMs = 12_000;

  constructor() {
    this.perMinuteLimit = parseInt(process.env.GEMINI_PER_MINUTE_LIMIT || '') || 60;
    this.dailyLimit = parseInt(process.env.GEMINI_DAILY_LIMIT || '') || 1000;
    this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.resetIfNeeded();
  }

  private resetIfNeeded() {
    const now = Date.now();
    if (now - this.minuteWindowStart > 60_000) {
      this.minuteWindowStart = now;
      this.minuteCount = 0;
    }
    const today = new Date().setHours(0, 0, 0, 0);
    if (this.dayWindowStart !== today) {
      this.dayWindowStart = today;
      this.dayCount = 0;
    }
  }

  private consumeToken(cost = 1) {
    this.resetIfNeeded();
    if (this.minuteCount + cost > this.perMinuteLimit) {
      throw new Error('AI per-minute quota exceeded');
    }
    if (this.dayCount + cost > this.dailyLimit) {
      throw new Error('AI daily quota exceeded');
    }
    this.minuteCount += cost;
    this.dayCount += cost;
  }

  async generate(prompt: string): Promise<string> {
    this.consumeToken(1);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured');
      return 'Sorry, AI is not configured.';
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        this.logger.error(`Gemini generate failed (${res.status}): ${JSON.stringify(data)}`);
        return 'Sorry, AI is temporarily unavailable.';
      }
      const text = data?.candidates?.[0]?.content?.[0]?.text || data?.output?.[0]?.content?.[0]?.text || JSON.stringify(data);
      return String(text);
    } catch (err) {
      this.logger.error('AI generate failed', err as any);
      return 'Sorry, AI is temporarily unavailable.';
    }
  }

  /**
   * Ask the model to analyze the last user message + context and decide
   * whether to escalate to admin. The model SHOULD respond with JSON
   * object: { reply: string, escalate: boolean, reason?: string }
   */
  async analyzeAndReply(prompt: string, contextJson?: any): Promise<{ reply: string; escalate: boolean; reason?: string }> {
    this.consumeToken(2);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured');
      return { reply: 'Sorry, AI is not configured.', escalate: false };
    }
    const system = `You are Halal Connect support assistant. Given the user message and context, produce a JSON object exactly with keys: reply (string), escalate (true/false), reason (optional short string). Only set escalate to true when human intervention is required (security, payment, account ownership, moderation, unclear/confusing). Keep reply concise.`;
    const body = {
      contents: [
        { parts: [{ text: system }] },
        { parts: [{ text: `Context: ${JSON.stringify(contextJson || {})}` }] },
        { parts: [{ text: `User: ${prompt}` }] },
        { parts: [{ text: `Respond with JSON: {"reply":"...","escalate":true|false,"reason":"..."}` }] },
      ],
    };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        this.logger.error(`Gemini analysis failed (${res.status}): ${JSON.stringify(data)}`);
        return { reply: 'Sorry, AI is temporarily unavailable.', escalate: false };
      }
      const text = data?.candidates?.[0]?.content?.[0]?.text || data?.output?.[0]?.content?.[0]?.text || JSON.stringify(data);
      // Try to extract JSON object from the text
      const jsonStart = text.indexOf('{');
      const jsonText = jsonStart >= 0 ? text.slice(jsonStart) : text;
      try {
        const parsed = JSON.parse(jsonText);
        return { reply: String(parsed.reply ?? ''), escalate: !!parsed.escalate, reason: parsed.reason };
      } catch (e) {
        // Fallback: return full text as reply, no escalation
        return { reply: String(text), escalate: false };
      }
    } catch (err) {
      this.logger.error('AI analyze failed', err as any);
      return { reply: 'Sorry, AI is unavailable right now.', escalate: false };
    }
  }
}
