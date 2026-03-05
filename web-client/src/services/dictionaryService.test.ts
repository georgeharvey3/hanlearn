import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// The dictionary service keeps module-level in-memory state (entries, indexes,
// dictionaryLoaded flag).  Re-importing a fresh copy each test via
// vi.resetModules() ensures tests don't bleed into each other.

const SAMPLE_ENTRIES = [
  { id: 1, simp: '你好', trad: '你好', pinyin: 'nǐ hǎo', meaning: 'hello' },
  { id: 2, simp: '学习', trad: '學習', pinyin: 'xué xí', meaning: 'to study' },
  // Single-character entries used to exercise convertText
  { id: 3, simp: '学', trad: '學', pinyin: 'xué', meaning: 'to study (char)' },
  { id: 4, simp: '习', trad: '習', pinyin: 'xí', meaning: 'practice (char)' },
  { id: 5, simp: '中文', trad: '中文', pinyin: 'zhōng wén', meaning: 'Chinese language' },
];

describe('dictionaryService', () => {
  let mod: typeof import('./dictionaryService');

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_ENTRIES,
    } as unknown as Response);
    mod = await import('./dictionaryService');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // searchWord
  // ---------------------------------------------------------------------------
  describe('searchWord', () => {
    it('finds entries by simplified character', async () => {
      const results = await mod.searchWord('你好', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '你好', pinyin: 'nǐ hǎo' });
    });

    it('finds entries by traditional character', async () => {
      const results = await mod.searchWord('學習', 'trad');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '学习', trad: '學習' });
    });

    it('falls back to the traditional index when the simplified index has no match', async () => {
      // '學習' is not in simpIndex, so it should fall through to tradIndex
      const results = await mod.searchWord('學習', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0].simp).toBe('学习');
    });

    it('falls back to the simplified index when the traditional index has no match', async () => {
      // '学习' is not in tradIndex, so it should fall through to simpIndex
      const results = await mod.searchWord('学习', 'trad');
      expect(results).toHaveLength(1);
      expect(results[0].trad).toBe('學習');
    });

    it('returns an empty array for an unknown character', async () => {
      const results = await mod.searchWord('zzz', 'simp');
      expect(results).toEqual([]);
    });

    it('only fetches the dictionary JSON once across multiple calls', async () => {
      await mod.searchWord('你好', 'simp');
      await mod.searchWord('学习', 'simp');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('prevents duplicate concurrent fetches', async () => {
      const [r1, r2] = await Promise.all([
        mod.searchWord('你好', 'simp'),
        mod.searchWord('学习', 'simp'),
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // lookupCharacter
  // ---------------------------------------------------------------------------
  describe('lookupCharacter', () => {
    it('returns pinyin and trad for a known simplified entry', async () => {
      const result = await mod.lookupCharacter('学');
      expect(result).toEqual({ pinyin: 'xué', trad: '學' });
    });

    it('returns null for an unknown simplified character', async () => {
      expect(await mod.lookupCharacter('zzz')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // lookupCharacterByTrad
  // ---------------------------------------------------------------------------
  describe('lookupCharacterByTrad', () => {
    it('returns pinyin and simp for a known traditional entry', async () => {
      const result = await mod.lookupCharacterByTrad('學');
      expect(result).toEqual({ pinyin: 'xué', simp: '学' });
    });

    it('returns null for an unknown traditional character', async () => {
      expect(await mod.lookupCharacterByTrad('zzz')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // convertText
  // ---------------------------------------------------------------------------
  describe('convertText', () => {
    it('converts simplified text to traditional character by character', async () => {
      // 学 → 學, 习 → 習 via single-char entries
      const result = await mod.convertText('学习', 'trad');
      expect(result).toBe('學習');
    });

    it('converts traditional text to simplified character by character', async () => {
      const result = await mod.convertText('學習', 'simp');
      expect(result).toBe('学习');
    });

    it('passes through characters that are not found in the index', async () => {
      const result = await mod.convertText('abc', 'trad');
      expect(result).toBe('abc');
    });

    it('handles a mix of known and unknown characters', async () => {
      const result = await mod.convertText('学abc', 'trad');
      expect(result).toBe('學abc');
    });
  });

  // ---------------------------------------------------------------------------
  // isDictionaryLoaded / preloadDictionary
  // ---------------------------------------------------------------------------
  describe('isDictionaryLoaded', () => {
    it('returns false before any dictionary load', () => {
      expect(mod.isDictionaryLoaded()).toBe(false);
    });

    it('returns true after the dictionary has loaded', async () => {
      await mod.preloadDictionary();
      expect(mod.isDictionaryLoaded()).toBe(true);
    });
  });

  describe('preloadDictionary', () => {
    it('triggers the dictionary fetch', async () => {
      await mod.preloadDictionary();
      expect(global.fetch).toHaveBeenCalledWith('/dictionary.json');
    });

    it('does not re-fetch when the dictionary is already loaded', async () => {
      await mod.preloadDictionary();
      await mod.preloadDictionary();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // substringMatch
  // ---------------------------------------------------------------------------
  describe('substringMatch', () => {
    it('returns the exact entry when the full string is in the dictionary', async () => {
      const results = await mod.substringMatch('你好', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '你好', pinyin: 'nǐ hǎo' });
    });

    it('decomposes a compound into dictionary-matched substrings using greedy longest match', async () => {
      // '学习' exists as a 2-char entry; greedy should prefer it over '学' + '习'
      const results = await mod.substringMatch('学习', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ simp: '学习' });
    });

    it('decomposes when the full string is not in the dictionary', async () => {
      // '你好学习' is not in the dictionary, but '你好' and '学习' are
      const results = await mod.substringMatch('你好学习', 'simp');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ simp: '你好' });
      expect(results[1]).toMatchObject({ simp: '学习' });
    });

    it('falls back to single characters when no multi-char match exists', async () => {
      // '学' and '习' are separate single-char entries
      // Construct a string that won't match as compound: '习学' is not an entry
      const results = await mod.substringMatch('习学', 'simp');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ simp: '习' });
      expect(results[1]).toMatchObject({ simp: '学' });
    });

    it('creates a synthetic entry for characters not in the dictionary', async () => {
      const results = await mod.substringMatch('z', 'simp');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ id: -1, simp: 'z', trad: 'z', pinyin: '', meaning: '' });
    });

    it('handles a mix of known and unknown characters', async () => {
      const results = await mod.substringMatch('你好z', 'simp');
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ simp: '你好' });
      expect(results[1]).toMatchObject({ id: -1, simp: 'z' });
    });

    it('respects the charSet parameter for traditional lookups', async () => {
      const results = await mod.substringMatch('學習', 'trad');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ trad: '學習' });
    });

    it('returns empty array for empty string', async () => {
      const results = await mod.substringMatch('', 'simp');
      expect(results).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws when the fetch response is not OK', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(mod.searchWord('你好', 'simp')).rejects.toThrow(
        'Failed to load dictionary: 500',
      );
    });

    it('resets loadingPromise after failure so the next call can retry', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => SAMPLE_ENTRIES,
        } as unknown as Response);

      // First call should fail
      await expect(mod.searchWord('你好', 'simp')).rejects.toThrow();

      // Second call retries and succeeds because loadingPromise was reset
      const results = await mod.searchWord('你好', 'simp');
      expect(results).toHaveLength(1);
    });
  });
});
