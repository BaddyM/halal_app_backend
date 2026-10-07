import { AiService } from './ai.service';

describe('AiService Gemini response handling', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_PER_MINUTE_LIMIT = '100';
    process.env.GEMINI_DAILY_LIMIT = '1000';
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'A generated answer.' }],
            },
          },
        ],
      }),
    } as Response);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    delete process.env.GEMINI_PER_MINUTE_LIMIT;
    delete process.env.GEMINI_DAILY_LIMIT;
  });

  it('reads text from the Gemini candidates content.parts response', async () => {
    const result = await new AiService().generate('general app help');

    expect(result).toBe('A generated answer.');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('key=');
    expect(options.headers).toMatchObject({
      'x-goog-api-key': 'test-gemini-key',
    });
  });

  it('parses the structured assistant response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reply: 'Open prayer settings to enable alerts.',
                    escalate: false,
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const result = await new AiService().analyzeAndReply(
      'General app guidance about prayer alerts.',
      { topic: 'prayer alerts' },
    );

    expect(result).toEqual({
      reply: 'Open prayer settings to enable alerts.',
      escalate: false,
      reason: undefined,
    });
  });
});
