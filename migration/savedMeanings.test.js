import { describe, it, expect } from 'vitest';
import { planMeaningUpdates } from './savedMeanings';

const dictionary = [
  { id: 10, trad: '誰', simp: '谁', pinyin: 'shei2', meaning: 'who' },
  { id: 11, trad: '路', simp: '路', pinyin: 'lu4', meaning: 'road/journey' },
];

/** A userWords document as the app writes it. */
const doc = (id, wordData, extra = {}) => ({
  path: `users/u1/userWords/${id}`,
  id: String(id),
  data: { wordData, amendedMeaning: null, ...extra },
});
const shei = (meaning) => ({ simp: '谁', trad: '誰', pinyin: 'shei2', meaning });

describe('the plan of the saved-meaning migration', () => {
  it('sets the clean meaning of the entry with the same ID', () => {
    const plan = planMeaningUpdates([doc(10, shei('who/also pr. [shui2]'))], dictionary);
    expect(plan.updates).toEqual([
      { path: 'users/u1/userWords/10', simp: '谁', from: 'who/also pr. [shui2]', to: 'who' },
    ]);
    expect(plan.unchanged).toBe(0);
  });

  it('never touches amendedMeaning: the update names only wordData.meaning', () => {
    const plan = planMeaningUpdates([doc(10, shei('who/also pr. [shui2]'), { amendedMeaning: 'who (my note)' })], dictionary);
    expect(plan.updates).toHaveLength(1);
    expect(Object.keys(plan.updates[0])).toEqual(['path', 'simp', 'from', 'to']);
  });

  it('changes nothing on a second run', () => {
    const first = planMeaningUpdates([doc(10, shei('who/also pr. [shui2]'))], dictionary);
    const migrated = doc(10, shei(first.updates[0].to));
    const second = planMeaningUpdates([migrated], dictionary);
    expect(second).toEqual({ updates: [], unchanged: 1, missing: [] });
  });

  it('reports a word with no entry, and a word whose ID names another entry', () => {
    const custom = doc(99, { simp: '猫', trad: '貓', pinyin: 'mao1', meaning: 'cat' });
    const other = doc(11, shei('who'));
    const plan = planMeaningUpdates([custom, other], dictionary);
    expect(plan.updates).toEqual([]);
    expect(plan.missing).toEqual([
      { path: 'users/u1/userWords/99', simp: '猫', reason: 'no dictionary entry with this ID' },
      { path: 'users/u1/userWords/11', simp: '谁', reason: 'the entry with this ID is 路 [lu4]' },
    ]);
  });
});
