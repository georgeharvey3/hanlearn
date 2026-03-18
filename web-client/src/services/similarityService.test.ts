import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('firebase/ai', () => ({
  getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
}));

vi.mock('../firebase/config', () => ({
  ai: {},
}));

import { getSimilarityScore } from './similarityService';

describe('similarityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed score from Gemini response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"score": 85}' },
    });

    const result = await getSimilarityScore('hello world', 'hi world', 'en');

    expect(result).toEqual({ score: 85, rawSimilarity: 0.85 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('clamps score to 0-100 range', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"score": 150}' },
    });

    const result = await getSimilarityScore('text', 'text', 'zh');
    expect(result.score).toBe(100);
    expect(result.rawSimilarity).toBe(1);
  });

  it('clamps negative scores to 0', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"score": -10}' },
    });

    const result = await getSimilarityScore('a', 'b', 'en');
    expect(result.score).toBe(0);
    expect(result.rawSimilarity).toBe(0);
  });

  it('uses Chinese label for zh language', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"score": 70}' },
    });

    await getSimilarityScore('你好', '你好世界', 'zh');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text;
    expect(promptText).toContain('Chinese');
  });

  it('uses English label for en language', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"score": 70}' },
    });

    await getSimilarityScore('hello', 'hi there', 'en');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[0].text;
    expect(promptText).toContain('English');
  });

  it('propagates errors from Gemini', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API error'));

    await expect(
      getSimilarityScore('a', 'b', 'en'),
    ).rejects.toThrow('API error');
  });
});
