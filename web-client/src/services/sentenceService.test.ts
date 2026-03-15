import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted runs before module factories, giving us refs we can configure
// per-test while still being used by the factory functions below.
const { mockGenerateContent, mockGetDoc, mockSetDoc } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));

vi.mock('firebase/ai', () => ({
  getGenerativeModel: vi.fn(() => ({ generateContent: mockGenerateContent })),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

// opencc-js Converter is called at module initialisation to build toTraditional.
// Use an identity function so conversion passes through unchanged in tests.
vi.mock('opencc-js', () => ({
  Converter: vi.fn(() => (text: string) => text),
}));

vi.mock('../firebase/config', () => ({
  ai: {},
  db: {},
}));

import {
  getSegmentedSentence,
  getHintSentence,
  checkSentenceAvailability,
} from './sentenceService';

// Sentence data used when the AI mock is needed
const AI_SENTENCES = [
  {
    chinese: '我在学习中文。',
    english: 'I am studying Chinese.',
    segments: ['我', '在', '学习', '中文'],
    targetIndex: 2,
  },
];

describe('sentenceService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Demo word "你好" — served directly from DEMO_SENTENCES without Firestore/AI
  // ---------------------------------------------------------------------------
  describe('getSegmentedSentence with demo word "你好"', () => {
    it('returns the first demo sentence at offset 0', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 0);
      expect(result.sentence).not.toBeNull();
      expect(result.sentence!.chinese.sentence).toBe('你好，欢迎来到这里！');
      expect(result.sentence!.english.sentence).toBe('Hello, welcome here!');
      expect(result.totalCount).toBe(4);
    });

    it('returns the sentence at a non-zero offset', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 2);
      expect(result.sentence!.chinese.sentence).toBe('她走进来时说了你好。');
    });

    it('returns null sentence when offset is at or beyond totalCount', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 4);
      expect(result.sentence).toBeNull();
      expect(result.totalCount).toBe(4);
    });

    it('calculates correct highlight indices for the target word', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 0);
      // '你好' begins at character index 0 in '你好，欢迎来到这里！'
      expect(result.sentence!.chinese.highlight).toEqual([[0, 2]]);
    });

    it('includes segments and targetIndex from the demo data', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 0);
      expect(result.sentence!.chinese.segments).toEqual(['你好', '欢迎', '来到', '这里']);
      expect(result.sentence!.chinese.targetIndex).toBe(0);
    });

    it('does not call Firestore or AI for demo words', async () => {
      await getSegmentedSentence('你好', 'simp', 0);
      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('applies the charSet conversion path for "trad" (identity in tests)', async () => {
      const result = await getSegmentedSentence('你好', 'trad', 0);
      expect(result.sentence).not.toBeNull();
      // toTraditional is mocked as identity, so the sentence text is unchanged
      expect(result.sentence!.chinese.sentence).toBe('你好，欢迎来到这里！');
    });
  });

  // ---------------------------------------------------------------------------
  // Firestore cache paths (non-demo words)
  // ---------------------------------------------------------------------------
  describe('getSegmentedSentence with Firestore cache', () => {
    it('returns cached sentences on a cache hit without calling AI', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ sentences: AI_SENTENCES }),
      });

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.sentence!.chinese.sentence).toBe('我在学习中文。');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('generates sentences with AI on a cache miss and stores them in Firestore', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(AI_SENTENCES) },
      });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.sentence!.chinese.sentence).toBe('我在学习中文。');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ sentences: AI_SENTENCES }),
      );
    });

    it('falls through to AI when the Firestore cache read throws', async () => {
      mockGetDoc.mockRejectedValue(new Error('Permission denied'));
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(AI_SENTENCES) },
      });

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.sentence).not.toBeNull();
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('still returns generated sentences even when the cache write fails', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(AI_SENTENCES) },
      });
      mockSetDoc.mockRejectedValue(new Error('Write failed'));

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.sentence).not.toBeNull();
      expect(result.sentence!.chinese.sentence).toBe('我在学习中文。');
    });

    it('filters out AI responses that do not contain the target word', async () => {
      const badSentences = [
        // This sentence does not contain '学习' and should be filtered out
        {
          chinese: '这是一句话。',
          english: 'This is a sentence.',
          segments: ['这', '是', '一句话'],
          targetIndex: 0,
        },
        ...AI_SENTENCES, // Valid — contains '学习'
      ];
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(badSentences) },
      });

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.sentence!.chinese.sentence).toBe('我在学习中文。');
      expect(result.totalCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getHintSentence
  // ---------------------------------------------------------------------------
  describe('getHintSentence', () => {
    it('returns a non-null hint for a demo word', async () => {
      const hint = await getHintSentence('你好');
      expect(hint).not.toBeNull();
      expect(hint!.chinese).toBeTruthy();
      expect(hint!.english).toBeTruthy();
    });

    it('returns null when no sentences are available', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '[]' }, // AI returns an empty array
      });

      const hint = await getHintSentence('unknown_word_xyz');
      expect(hint).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // checkSentenceAvailability
  // ---------------------------------------------------------------------------
  describe('checkSentenceAvailability', () => {
    it('returns true when sentences are available for a demo word', async () => {
      const available = await checkSentenceAvailability('你好', 'simp');
      expect(available).toBe(true);
    });

    it('returns false when no sentences are available', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '[]' },
      });

      const available = await checkSentenceAvailability('unknown_word_xyz', 'simp');
      expect(available).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // generateSentencesWithAI — edge cases
  // ---------------------------------------------------------------------------
  describe('generateSentencesWithAI edge cases', () => {
    it('returns empty result when AI returns a non-array response', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify({ not: 'an array' }) },
      });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await getSegmentedSentence('测试', 'simp', 0);
      expect(result.sentence).toBeNull();
      expect(result.totalCount).toBe(0);
    });

    it('filters out AI items missing required fields', async () => {
      const malformed = [
        { chinese: '有中文', english: 'Has English' }, // missing segments & targetIndex
        { chinese: 123, english: 'wrong type', segments: [], targetIndex: 0 },
        ...AI_SENTENCES,
      ];
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(malformed) },
      });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.totalCount).toBe(1);
      expect(result.sentence!.chinese.sentence).toBe('我在学习中文。');
    });

    it('does not write to cache when AI returns no valid sentences', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '[]' },
      });

      await getSegmentedSentence('空的', 'simp', 0);
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('limits results to SENTENCES_PER_WORD (5)', async () => {
      const manySentences = Array.from({ length: 10 }, (_, i) => ({
        chinese: `我学习第${i}课。`,
        english: `I study lesson ${i}.`,
        segments: ['我', '学习', `第${i}课`],
        targetIndex: 1,
      }));
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(manySentences) },
      });
      mockSetDoc.mockResolvedValue(undefined);

      const result = await getSegmentedSentence('学习', 'simp', 0);
      expect(result.totalCount).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateHighlightIndices — multiple occurrences
  // ---------------------------------------------------------------------------
  describe('highlight calculation', () => {
    it('finds multiple occurrences of the word in a sentence', async () => {
      const sentences = [
        {
          chinese: '学习学习再学习',
          english: 'Study study and study again',
          segments: ['学习', '学习', '再', '学习'],
          targetIndex: 0,
        },
      ];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ sentences }),
      });

      const result = await getSegmentedSentence('学习', 'simp', 0);
      // '学习' appears at index 0, 2, and 5
      expect(result.sentence!.chinese.highlight).toEqual([
        [0, 2],
        [2, 4],
        [5, 7],
      ]);
    });

    it('returns empty highlight array when word is not in sentence text', async () => {
      const sentences = [
        {
          chinese: '这是一句话',
          english: 'This is a sentence',
          segments: ['这', '是', '一句话'],
          targetIndex: 0,
        },
      ];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ sentences }),
      });

      const result = await getSegmentedSentence('别的', 'simp', 0);
      expect(result.sentence!.chinese.highlight).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getHintSentence — caching behavior
  // ---------------------------------------------------------------------------
  describe('getHintSentence with AI-generated sentences', () => {
    it('returns a hint from AI-generated sentences when cache is empty', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(AI_SENTENCES) },
      });
      mockSetDoc.mockResolvedValue(undefined);

      const hint = await getHintSentence('学习');
      expect(hint).not.toBeNull();
      expect(hint!.chinese).toBe('我在学习中文。');
      expect(hint!.english).toBe('I am studying Chinese.');
    });
  });

  // ---------------------------------------------------------------------------
  // checkSentenceAvailability with trad charSet
  // ---------------------------------------------------------------------------
  describe('checkSentenceAvailability with trad', () => {
    it('returns true for a cached word in trad mode', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ sentences: AI_SENTENCES }),
      });

      const available = await checkSentenceAvailability('学习', 'trad');
      expect(available).toBe(true);
    });
  });
});
