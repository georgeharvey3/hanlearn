/**
 * Tests for chengyuSentenceService.ts: the example sentence of a chengyu comes
 * from the committed file, with no network call (#387).
 */
import { describe, it, expect } from 'vitest';
import { ChengyuSentence, getChengyuExampleSentence } from './chengyuSentenceService';
import { chengyus } from '../data/chengyus';
import sentences from '../data/chengyuSentences.json';

describe('getChengyuExampleSentence', () => {
  it('gives the committed sentence of a chengyu', async () => {
    const sentence = await getChengyuExampleSentence('画蛇添足', 'simp');
    expect(sentence?.chinese).toContain('画蛇添足');
    expect(sentence?.pinyin).not.toBe('');
    expect(sentence?.english).not.toBe('');
  });

  it('converts the sentence to traditional characters', async () => {
    const sentence = await getChengyuExampleSentence('画蛇添足', 'trad');
    expect(sentence?.chinese).toContain('畫蛇添足');
  });

  it('gives null for a chengyu with no sentence', async () => {
    expect(await getChengyuExampleSentence('不是成语', 'simp')).toBeNull();
  });
});

describe('the committed chengyu sentences', () => {
  const bySimp = sentences as Record<string, ChengyuSentence>;

  it('give each chengyu one sentence that holds it', () => {
    const missing = chengyus
      .map((c) => c.characters)
      .filter((simp) => !bySimp[simp]?.chinese.includes(simp));
    expect(missing).toEqual([]);
  });

  it('hold no sentence for a word that is not a chengyu', () => {
    const known = new Set(chengyus.map((c) => c.characters));
    expect(Object.keys(bySimp).filter((simp) => !known.has(simp))).toEqual([]);
  });

  it('give each sentence its pinyin and its English', () => {
    const blank = Object.entries(bySimp)
      .filter(([, s]) => !s.pinyin.trim() || !s.english.trim())
      .map(([simp]) => simp);
    expect(blank).toEqual([]);
  });
});
