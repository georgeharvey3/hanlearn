/**
 * Tests for chengyuSentenceService.ts
 * Covers: getChengyuExampleSentence — cache hit, cache miss + Cloud Function
 * generation, traditional conversion, and error handling.
 *
 * Firebase Firestore and Cloud Functions are mocked at the SDK level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetDoc,
  mockDoc,
  mockHttpsCallable,
  mockCallable,
  mockConverter,
} = vi.hoisted(() => {
  const mockCallable = vi.fn();
  const mockHttpsCallable = vi.fn(() => mockCallable);
  // opencc-js Converter returns a function that performs simplified→traditional conversion
  const mockConverter = vi.fn((text: string) => `TRAD:${text}`);

  return {
    mockGetDoc: vi.fn(),
    mockDoc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
    mockHttpsCallable,
    mockCallable,
    mockConverter,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}));

vi.mock('../firebase/config', () => ({ db: {}, functions: {} }));

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

// ─── Cache hit ────────────────────────────────────────────────────────────────

describe('getChengyuExampleSentence — cache hit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns the cached sentence for simp charSet without calling Cloud Function', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ sentence: SAMPLE_SENTENCE }),
    });

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(result).toEqual(SAMPLE_SENTENCE);
    expect(mockHttpsCallable).not.toHaveBeenCalled();
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

// ─── Cache miss + Cloud Function generation ──────────────────────────────────

describe('getChengyuExampleSentence — cache miss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('calls Cloud Function when cache is empty and returns the generated sentence', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCallable.mockResolvedValue({
      data: {
        sentence: {
          chinese: '他半途而废，没有完成学业。',
          pinyin: 'Tā bàntú ér fèi.',
          english: 'He gave up halfway.',
        },
      },
    });

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    expect(mockHttpsCallable).toHaveBeenCalled();
    expect(mockCallable).toHaveBeenCalledWith({ chengyu: '半途而废' });
    expect(result).not.toBeNull();
    expect(result!.chinese).toBe('他半途而废，没有完成学业。');
  });

  it('converts Cloud Function sentence to traditional when charSet=trad', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCallable.mockResolvedValue({
      data: {
        sentence: {
          chinese: '他半途而废，没有完成学业。',
          pinyin: 'Tā bàntú ér fèi.',
          english: 'He gave up halfway.',
        },
      },
    });

    const result = await getChengyuExampleSentence('半途而废', 'trad');

    expect(result!.chinese).toMatch(/^TRAD:/);
  });

  it('returns null when Cloud Function returns null sentence', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCallable.mockResolvedValue({ data: { sentence: null } });

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

  it('falls through to Cloud Function when Firestore cache read throws', async () => {
    // Cache read failure
    mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));
    mockCallable.mockResolvedValue({
      data: {
        sentence: {
          chinese: '他半途而废，没有完成学业。',
          pinyin: 'Tā bàntú ér fèi.',
          english: 'He gave up halfway.',
        },
      },
    });

    const result = await getChengyuExampleSentence('半途而废', 'simp');

    // Should still succeed via Cloud Function
    expect(result).not.toBeNull();
    expect(result!.chinese).toBe('他半途而废，没有完成学业。');
  });

  it('returns null when Cloud Function throws', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCallable.mockRejectedValue(new Error('Function unavailable'));

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
    expect(mockHttpsCallable).not.toHaveBeenCalled();
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

  it('localStorage cache is populated after Cloud Function returns a sentence', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockCallable.mockResolvedValue({
      data: {
        sentence: SAMPLE_SENTENCE,
      },
    });

    await getChengyuExampleSentence('半途而废', 'simp');

    const cached = JSON.parse(localStorage.getItem('chengyuSentenceCache')!);
    expect(cached.chengyu).toBe('半途而废');
    expect(cached.sentence).toEqual(SAMPLE_SENTENCE);
  });
});
