import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const SAMPLE_ENTRIES = [
  { id: 1, simp: '你好', trad: '你好', pinyin: 'nǐ hǎo', meaning: 'hello' },
  { id: 2, simp: '学习', trad: '學習', pinyin: 'xué xí', meaning: 'to study' },
  { id: 3, simp: '学', trad: '學', pinyin: 'xué', meaning: 'to study (char)' },
  { id: 4, simp: '习', trad: '習', pinyin: 'xí', meaning: 'practice (char)' },
  { id: 5, simp: '中文', trad: '中文', pinyin: 'zhōng wén', meaning: 'Chinese language' },
];

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('../firebase/config', () => ({
  functions: {},
  perf: null,
  analytics: null,
}));

vi.mock('./performanceService', () => ({
  traceAsync: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

describe('dictionaryService', () => {
  let mod: typeof import('./dictionaryService');

  beforeEach(async () => {
    vi.resetModules();
    mockCallable.mockReset();
    // Re-import to get fresh module (though the Cloud Functions version is stateless client-side)
    mod = await import('./dictionaryService');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // searchWord
  // ---------------------------------------------------------------------------
  describe('searchWord', () => {
    it('returns results from the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: [SAMPLE_ENTRIES[0]] });
      const results = await mod.searchWord('你好', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '你好', pinyin: 'nǐ hǎo' });
    });

    it('passes character and charSet to the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      await mod.searchWord('學習', 'trad');
      expect(mockCallable).toHaveBeenCalledWith({ character: '學習', charSet: 'trad' });
    });

    it('returns an empty array when no results found', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      const results = await mod.searchWord('zzz', 'simp');
      expect(results).toEqual([]);
    });

    it('propagates errors from the Cloud Function', async () => {
      mockCallable.mockRejectedValue(new Error('internal'));
      await expect(mod.searchWord('你好', 'simp')).rejects.toThrow('internal');
    });
  });

  // ---------------------------------------------------------------------------
  // lookupCharacter
  // ---------------------------------------------------------------------------
  describe('lookupCharacter', () => {
    it('returns pinyin and trad for a known simplified entry', async () => {
      mockCallable.mockResolvedValue({ data: { pinyin: 'xué', trad: '學' } });
      const result = await mod.lookupCharacter('学');
      expect(result).toEqual({ pinyin: 'xué', trad: '學' });
    });

    it('returns null for an unknown simplified character', async () => {
      mockCallable.mockResolvedValue({ data: null });
      expect(await mod.lookupCharacter('zzz')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // lookupCharacterByTrad
  // ---------------------------------------------------------------------------
  describe('lookupCharacterByTrad', () => {
    it('returns pinyin and simp for a known traditional entry', async () => {
      mockCallable.mockResolvedValue({ data: { pinyin: 'xué', simp: '学' } });
      const result = await mod.lookupCharacterByTrad('學');
      expect(result).toEqual({ pinyin: 'xué', simp: '学' });
    });

    it('returns null for an unknown traditional character', async () => {
      mockCallable.mockResolvedValue({ data: null });
      expect(await mod.lookupCharacterByTrad('zzz')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // convertText
  // ---------------------------------------------------------------------------
  describe('convertText', () => {
    it('returns the converted text from the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: '學習' });
      const result = await mod.convertText('学习', 'trad');
      expect(result).toBe('學習');
    });

    it('passes text and toCharSet to the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: '学习' });
      await mod.convertText('學習', 'simp');
      expect(mockCallable).toHaveBeenCalledWith({ text: '學習', toCharSet: 'simp' });
    });
  });

  // ---------------------------------------------------------------------------
  // isDictionaryLoaded / preloadDictionary
  // ---------------------------------------------------------------------------
  describe('isDictionaryLoaded', () => {
    it('always returns true (dictionary is server-side)', () => {
      expect(mod.isDictionaryLoaded()).toBe(true);
    });
  });

  describe('preloadDictionary', () => {
    it('is a no-op that resolves immediately', async () => {
      await expect(mod.preloadDictionary()).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // substringMatch
  // ---------------------------------------------------------------------------
  describe('substringMatch', () => {
    it('returns results from the Cloud Function', async () => {
      const expected = [SAMPLE_ENTRIES[0]];
      mockCallable.mockResolvedValue({ data: expected });
      const results = await mod.substringMatch('你好', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '你好' });
    });

    it('passes text and charSet to the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      await mod.substringMatch('學習', 'trad');
      expect(mockCallable).toHaveBeenCalledWith({ text: '學習', charSet: 'trad' });
    });

    it('returns empty array for empty string', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      const results = await mod.substringMatch('', 'simp');
      expect(results).toHaveLength(0);
    });
  });
});
