import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SEED_LISTS, assertNotProduction, buildSeed, parseChengyus } from './stagingSeed';

describe('assertNotProduction', () => {
  it('refuses the production project', () => {
    expect(() => assertNotProduction('hanlearn-dd14f')).toThrow(/production/);
  });

  it('refuses a missing project id', () => {
    expect(() => assertNotProduction(undefined)).toThrow();
    expect(() => assertNotProduction('')).toThrow();
  });

  it('accepts the staging project', () => {
    expect(() => assertNotProduction('hanlearn-staging')).not.toThrow();
  });
});

describe('parseChengyus', () => {
  const source = `import { Chengyu } from '../types/models';

export const chengyus: Chengyu[] = [
  {
    characters: '不可得兼',
    trad: '不可得兼',
    pinyin: 'bù kě dé jiān',
    meaning: "you can't have both at the same time",
  },
  {
    characters: '心神不宁',
    trad: '心神不寧',
    pinyin: 'xīn shén bù níng',
    meaning: 'to feel bad about nothing',
  },
];

export function getDailyChengyu(): {
  characters: string;
  pinyin: string;
} {}
`;

  it('reads each chengyu of the array, with either kind of quote', () => {
    expect(parseChengyus(source)).toEqual([
      {
        characters: '不可得兼',
        pinyin: 'bù kě dé jiān',
        meaning: "you can't have both at the same time",
      },
      { characters: '心神不宁', pinyin: 'xīn shén bù níng', meaning: 'to feel bad about nothing' },
    ]);
  });

  it('reads all 147 chengyus of the app', () => {
    const real = readFileSync(new URL('../web-client/src/data/chengyus.ts', import.meta.url), 'utf8');
    const chengyus = parseChengyus(real);
    expect(chengyus).toHaveLength(147);
    for (const c of chengyus) {
      expect(c.characters).toMatch(/^\p{Script=Han}[\p{Script=Han}，,]+$/u);
      expect(c.pinyin).not.toBe('');
      expect(c.meaning).not.toBe('');
    }
  });
});

describe('buildSeed', () => {
  const now = new Date('2026-10-27T09:00:00Z');
  const chengyus = [
    { characters: '一心一意', pinyin: 'yī xīn yī yì', meaning: 'wholeheartedly' },
    { characters: '自言自语', pinyin: 'zì yán zì yǔ', meaning: 'to talk to oneself' },
  ];

  /** A dictionary with one entry for each seed word, plus the chengyu characters. */
  function dictionary() {
    const seedWords = [...new Set(SEED_LISTS.flatMap((list) => list.words))];
    const entries = seedWords.map((simp, i) => ({
      id: 1000 + i,
      simp,
      trad: `${simp}-trad`,
      pinyin: `pinyin${i}`,
      meaning: `meaning ${i}`,
      q: 5,
    }));
    return [
      ...entries,
      { id: 1, simp: '一', trad: '一', pinyin: 'yi1', meaning: 'one' },
      { id: 2, simp: '心', trad: '心', pinyin: 'xin1', meaning: 'heart' },
      { id: 3, simp: '自', trad: '自', pinyin: 'zi4', meaning: 'self' },
      { id: 4, simp: '言', trad: '言', pinyin: 'yan2', meaning: 'words' },
      { id: 5, simp: '语', trad: '語', pinyin: 'yu3', meaning: 'language' },
      { id: 6, simp: '语', trad: '語', pinyin: 'yu4', meaning: 'to tell' },
      { id: 7, simp: '意', trad: '意', pinyin: 'yi4', meaning: 'idea' },
      { id: 8, simp: '马', trad: '馬', pinyin: 'ma3', meaning: 'horse' },
    ];
  }

  it('puts the words of the test account in more than one list', () => {
    const seed = buildSeed({ dictionary: dictionary(), chengyus, now });
    const listIds = new Set(seed.userWords.flatMap((word) => word.data.listIds));
    expect(listIds.size).toBeGreaterThan(1);
    expect(seed.userWords.some((word) => word.data.listIds.length > 1)).toBe(true);
    // Each list other than the built-in General has its own document.
    const stored = new Set(['default', ...seed.lists.map((list) => list.id)]);
    for (const id of listIds) expect(stored.has(id)).toBe(true);
  });

  it('writes each word under its dictionary id, with the entry as its data', () => {
    const seed = buildSeed({ dictionary: dictionary(), chengyus, now });
    const word = seed.userWords.find((w) => w.data.wordData.simp === SEED_LISTS[0].words[0]);
    expect(word.id).toBe('1000');
    expect(word.data.wordId).toBe('1000');
    expect(word.data.wordData).toEqual({
      simp: SEED_LISTS[0].words[0],
      trad: `${SEED_LISTS[0].words[0]}-trad`,
      pinyin: 'pinyin0',
      meaning: 'meaning 0',
    });
  });

  it('derives the bank and due date of each word from its directions', () => {
    const seed = buildSeed({ dictionary: dictionary(), chengyus, now });
    for (const { data } of seed.userWords) {
      const states = Object.values(data.directions);
      expect(Object.keys(data.directions).sort()).toEqual(['CM', 'MC', 'MP', 'PC', 'PM']);
      expect(data.bank).toBe(Math.min(...states.map((s) => s.bank)));
      expect(data.dueDate.getTime()).toBe(Math.min(...states.map((s) => s.dueDate.getTime())));
    }
    // Some words are new and some reviewed, so the session queue and the
    // Dashboard both have something to show.
    expect(seed.userWords.some((w) => w.data.bank === 1)).toBe(true);
    expect(seed.userWords.some((w) => w.data.bank > 1)).toBe(true);
  });

  it('fails when a seed word is not in the dictionary', () => {
    const missing = dictionary().filter((entry) => entry.simp !== SEED_LISTS[0].words[0]);
    expect(() => buildSeed({ dictionary: missing, chengyus, now })).toThrow(SEED_LISTS[0].words[0]);
  });

  it('numbers the chengyus as the production import does', () => {
    const seed = buildSeed({ dictionary: dictionary(), chengyus, now });
    expect(seed.chengyus).toEqual([
      { id: '0', data: chengyus[0] },
      { id: '1', data: chengyus[1] },
    ]);
  });

  it('writes every dictionary entry of a chengyu character, and no other', () => {
    const seed = buildSeed({ dictionary: dictionary(), chengyus, now });
    expect(seed.words.map((w) => w.id).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(seed.words.find((w) => w.id === '6').data).toEqual({
      simp: '语',
      trad: '語',
      pinyin: 'yu4',
      meaning: 'to tell',
    });
  });
});
