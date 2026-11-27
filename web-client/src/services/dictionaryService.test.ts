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
  // searchDictionary
  // ---------------------------------------------------------------------------
  describe('searchDictionary', () => {
    it('passes the trimmed query, charSet and search mode to the Cloud Function', async () => {
      mockCallable.mockResolvedValue({ data: [SAMPLE_ENTRIES[0]] });
      const results = await mod.searchDictionary('  ni hao ', 'trad', 'chinese');
      expect(mockCallable).toHaveBeenCalledWith({
        query: 'ni hao',
        charSet: 'trad',
        mode: 'chinese',
      });
      expect(results).toEqual([SAMPLE_ENTRIES[0]]);
    });

    it('does not call the Cloud Function for empty input', async () => {
      expect(await mod.searchDictionary('   ', 'simp', 'english')).toEqual([]);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('answers a repeated search from memory', async () => {
      mockCallable.mockResolvedValue({ data: [SAMPLE_ENTRIES[1]] });
      await mod.searchDictionary('xuexi', 'simp', 'chinese');
      const again = await mod.searchDictionary(' xuexi ', 'simp', 'chinese');
      expect(again).toEqual([SAMPLE_ENTRIES[1]]);
      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it('keeps a search apart for each search mode and character set', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      await mod.searchDictionary('study', 'simp', 'chinese');
      await mod.searchDictionary('study', 'simp', 'english');
      await mod.searchDictionary('study', 'trad', 'english');
      expect(mockCallable).toHaveBeenCalledTimes(3);
    });

    it('does not keep a failed search', async () => {
      mockCallable.mockRejectedValueOnce(new Error('internal'));
      await expect(mod.searchDictionary('xuexi', 'simp', 'chinese')).rejects.toThrow();
      mockCallable.mockResolvedValue({ data: [SAMPLE_ENTRIES[1]] });
      expect(await mod.searchDictionary('xuexi', 'simp', 'chinese')).toEqual([SAMPLE_ENTRIES[1]]);
    });

    it('gives a kept search at once, and nothing for a search not yet made', async () => {
      mockCallable.mockResolvedValue({ data: [SAMPLE_ENTRIES[1]] });
      expect(mod.cachedSearch('xuexi', 'simp', 'chinese')).toBeUndefined();
      await mod.searchDictionary('xuexi', 'simp', 'chinese');
      expect(mod.cachedSearch('xuexi ', 'simp', 'chinese')).toEqual([SAMPLE_ENTRIES[1]]);
    });

    it('forgets the oldest search past the cap', async () => {
      mockCallable.mockResolvedValue({ data: [] });
      for (let i = 0; i <= mod.SEARCH_CACHE_SIZE; i++) {
        await mod.searchDictionary(`q${i}`, 'simp', 'chinese');
      }
      expect(mod.cachedSearch('q0', 'simp', 'chinese')).toBeUndefined();
      expect(mod.cachedSearch('q1', 'simp', 'chinese')).toEqual([]);
    });
  });

  describe('warmEnglishSearch', () => {
    it('sends one empty English search, so the instance builds its English index', () => {
      mockCallable.mockResolvedValue({ data: [] });
      mod.warmEnglishSearch();
      expect(mockCallable).toHaveBeenCalledTimes(1);
      expect(mockCallable).toHaveBeenCalledWith({ query: '', charSet: 'simp', mode: 'english' });
    });

    it('does not reject when the call fails', async () => {
      mockCallable.mockRejectedValue(new Error('offline'));
      expect(() => mod.warmEnglishSearch()).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
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
  // searchWord — input validation branches
  // ---------------------------------------------------------------------------
  describe('searchWord input validation', () => {
    it('returns empty array for empty string input', async () => {
      const results = await mod.searchWord('', 'simp');
      expect(results).toEqual([]);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only input', async () => {
      const results = await mod.searchWord('   ', 'simp');
      expect(results).toEqual([]);
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('returns empty array for input exceeding max length', async () => {
      const longInput = '学'.repeat(101);
      const results = await mod.searchWord(longInput, 'simp');
      expect(results).toEqual([]);
      expect(mockCallable).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // convertText — input validation branches
  // ---------------------------------------------------------------------------
  describe('convertText input validation', () => {
    it('returns empty string for empty input', async () => {
      const result = await mod.convertText('', 'trad');
      expect(result).toBe('');
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('returns empty string for whitespace-only input', async () => {
      const result = await mod.convertText('   ', 'simp');
      expect(result).toBe('');
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('returns empty string for input exceeding max length', async () => {
      const longInput = '学'.repeat(101);
      const result = await mod.convertText(longInput, 'trad');
      expect(result).toBe('');
      expect(mockCallable).not.toHaveBeenCalled();
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
});
