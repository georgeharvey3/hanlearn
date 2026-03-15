/**
 * Tests for chengyuSentenceService.ts
 * Covers: getChengyuExampleSentence — cache hit, cache miss + AI generation,
 * AI fallback, traditional conversion, and error handling.
 *
 * Firebase Firestore and Firebase AI are mocked at the SDK level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetDoc,
  mockSetDoc,
  mockDoc,
  mockServerTimestamp,
  mockGenerateContent,
  mockGetGenerativeModel,
  mockConverter,
} = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  // opencc-js Converter returns a function that performs simplified→traditional conversion
  const mockConverter = vi.fn((text: string) => `TRAD:${text}`);

  return {
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
    mockServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    mockGenerateContent,
    mockGetGenerativeModel,
    mockConverter,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('../firebase/config', () => ({ db: {}, ai: {} }));

vi.mock('firebase/ai', () => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

vi.mock('opencc-js', () => ({
  Converter: vi.fn(() => mockConverter),
}));

import { getChengyuExampleSentence } from './chengyuSentenceService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_SENTENCE = {
  chinese: '他半途而废，没有完成学业。',
  pinyin: 'Tā bàntú ér fèi, méiyǒu wánchéng xuéyè.',
  english: 'He gave up halfway and did not finish his studies.',
};

function makeAIResponse(obj: object) {
  return {
    response: {
      text: () => JSON.stringify(obj),
    },
  };
}

// ─── Cache hit ────────────────────────────────────────────────────────────────

describe('getChengyuExampleSentence — cache hit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns the cached sentence for simp charSet without calling AI', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sentence: SAMPLE_SENTENCE }),
    });

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toEqual(SAMPLE_SENTENCE);
    expect(mockGetGenerativeModel).not.toHaveBeenCalled();
  });

  it('converts cached sentence to traditional when charSet=trad', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sentence: SAMPLE_SENTENCE }),
    });

    const result = await getChengyuExampleSentence('半途而废', 'trad');

    expect(result).not.toBeNull();
    // The converter should have been applied to the chinese field
    expect(result!.chinese).toMatch(/^TRAD:/);
    // pinyin and english stay unchanged
    expect(result!.pinyin).toBe(SAMPLE_SENTENCE.pinyin);
    expect(result!.english).toBe(SAMPLE_SENTENCE.english);
  });
});

// ─── Cache miss + AI generation ───────────────────────────────────────────────

describe('getChengyuExampleSentence — cache miss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('calls AI when cache is empty and returns the generated sentence', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '他半途而废，没有完成学业。',
        pinyin: 'Tā bàntú ér fèi.',
        english: 'He gave up halfway.',
      }),
    );
    mockSetDoc.mockResolvedValue(undefined);

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(mockGetGenerativeModel).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.chinese).toBe('他半途而废，没有完成学业。');
  });

  it('caches the generated sentence in Firestore', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '他半途而废，没有完成学业。',
        pinyin: 'Tā bàntú ér fèi.',
        english: 'He gave up halfway.',
      }),
    );
    mockSetDoc.mockResolvedValue(undefined);

    await getChengyuExampleSentence('半途而废', 'simp');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const setDocData = mockSetDoc.mock.calls[0][1];
    expect(setDocData.sentence).toBeDefined();
    expect(setDocData.generatedAt).toBe('SERVER_TIMESTAMP');
  });

  it('converts AI-generated sentence to traditional when charSet=trad', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '他半途而废，没有完成学业。',
        pinyin: 'Tā bàntú ér fèi.',
        english: 'He gave up halfway.',
      }),
    );
    mockSetDoc.mockResolvedValue(undefined);

    const result = await getChengyuExampleSentence('半途而废', 'trad');

    expect(result!.chinese).toMatch(/^TRAD:/);
  });

  it('returns null when AI returns JSON that does not contain the chengyu', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    // AI response where chinese field does NOT include the chengyu
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '这是一个不相关的句子。',
        pinyin: 'Some pinyin.',
        english: 'An unrelated sentence.',
      }),
    );

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toBeNull();
  });

  it('returns null when AI returns malformed JSON (missing required fields)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({ onlyChinese: '他半途而废' }), // missing pinyin and english
    );

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toBeNull();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('getChengyuExampleSentence — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('falls through to AI when Firestore cache read throws', async () => {
    // Cache read failure
    mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '他半途而废，没有完成学业。',
        pinyin: 'Tā bàntú ér fèi.',
        english: 'He gave up halfway.',
      }),
    );
    mockSetDoc.mockResolvedValue(undefined);

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    // Should still succeed via AI generation
    expect(result).not.toBeNull();
    expect(result!.chinese).toBe('他半途而废，没有完成学业。');
  });

  it('returns null when AI generation throws', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockRejectedValue(new Error('AI quota exceeded'));

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toBeNull();
  });

  it('returns localStorage-cached sentence without hitting Firestore', async () => {
    // Pre-populate localStorage cache
    localStorage.setItem(
      'chengyuSentenceCache',
      JSON.stringify({ chengyu: '半途而废', sentence: SAMPLE_SENTENCE }),
    );

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toEqual(SAMPLE_SENTENCE);
    // Should not touch Firestore at all
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('localStorage cache is populated after Firestore cache hit', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sentence: SAMPLE_SENTENCE }),
    });

    await getChengyuExampleSentence('半途而废', 'simp');

    const cached = JSON.parse(localStorage.getItem('chengyuSentenceCache')!);
    expect(cached.chengyu).toBe('半途而废');
    expect(cached.sentence).toEqual(SAMPLE_SENTENCE);
  });

  it('still returns the generated sentence when cache write (setDoc) fails', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGenerateContent.mockResolvedValue(
      makeAIResponse({
        chinese: '他半途而废，没有完成学业。',
        pinyin: 'Tā bàntú ér fèi.',
        english: 'He gave up halfway.',
      }),
    );
    // Cache write fails — this should not affect the result
    mockSetDoc.mockRejectedValue(new Error('Firestore write quota exceeded'));

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).not.toBeNull();
    expect(result!.chinese).toBe('他半途而废，没有完成学业。');
  });
});
