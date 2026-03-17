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
  // Demo sentence at offset 3 — exercises lines 39–42 (4th DEMO_SENTENCES entry)
  // ---------------------------------------------------------------------------
  describe('getSegmentedSentence with demo word at offset 3', () => {
    it('returns the 4th demo sentence for 你好 at offset 3', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 3);
      expect(result.sentence).not.toBeNull();
      expect(result.sentence!.chinese.sentence).toBe('老师对每位学生说你好。');
      expect(result.sentence!.english.sentence).toBe('The teacher said hello to every student.');
      expect(result.sentence!.chinese.targetIndex).toBe(5);
    });

    it('includes correct segments for the 4th demo sentence', async () => {
      const result = await getSegmentedSentence('你好', 'simp', 3);
      expect(result.sentence!.chinese.segments).toEqual([
        '老师',
        '对',
        '每位',
        '学生',
        '说',
        '你好',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // AI response edge cases — generateSentencesWithAI filtering/validation
  // ---------------------------------------------------------------------------
  describe('generateSentencesWithAI edge cases', () => {
    it('returns empty when AI returns a non-array response', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '"just a string"' },
      });

      const result = await getSegmentedSentence('测试', 'simp', 0);
      expect(result.sentence).toBeNull();
      expect(result.totalCount).toBe(0);
    });

    it('filters out items with missing or wrong-type fields', async () => {
      const mixedItems = [
        // Missing chinese field
        { english: 'test', segments: ['a'], targetIndex: 0 },
        // targetIndex is string instead of number
        { chinese: '测试句子', english: 'test', segments: ['测试', '句子'], targetIndex: '0' },
        // Valid
        {
          chinese: '这是一个测试。',
          english: 'This is a test.',
          segments: ['这是', '一个', '测试'],
          targetIndex: 2,
        },
      ];

      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mixedItems) },
      });

      const result = await getSegmentedSentence('测试', 'simp', 0);
      expect(result.sentence).not.toBeNull();
      expect(result.sentence!.chinese.sentence).toBe('这是一个测试。');
      expect(result.totalCount).toBe(1);
    });

    it('does not cache empty AI results', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '[]' },
      });

      await getSegmentedSentence('空词', 'simp', 0);
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('limits AI results to SENTENCES_PER_WORD (5)', async () => {
      const manySentences = Array.from({ length: 8 }, (_, i) => ({
        chinese: `测试句子${i}，包含测试。`,
        english: `Test sentence ${i}.`,
        segments: ['测试', `句子${i}`],
        targetIndex: 0,
      }));

      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(manySentences) },
      });

      const result = await getSegmentedSentence('测试', 'simp', 0);
      expect(result.totalCount).toBeLessThanOrEqual(5);
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
  describe('getHintSentence with Firestore cache', () => {
    it('returns a random sentence from cached results', async () => {
      const sentences = [
        {
          chinese: '学习中文很有趣。',
          english: 'Learning Chinese is fun.',
          segments: ['学习'],
          targetIndex: 0,
        },
        {
          chinese: '他在学习数学。',
          english: 'He is studying math.',
          segments: ['学习'],
          targetIndex: 0,
        },
      ];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ sentences }),
      });

      const hint = await getHintSentence('学习');
      expect(hint).not.toBeNull();
      expect(sentences.map((s) => s.chinese)).toContain(hint!.chinese);
    });
  });

  // ---------------------------------------------------------------------------
  // getHintSentence with AI-generated sentences
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
