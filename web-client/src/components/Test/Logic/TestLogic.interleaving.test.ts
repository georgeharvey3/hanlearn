/**
 * Guards for the interleaving of a session (issue #335).
 *
 * The words of a session are shuffled within a due day, so a session mixes
 * lists and levels rather than blocking by either. Interleaving is the right
 * default for this material, and the scheduler work must not quietly replace
 * it with a block, so these tests state the property directly: the plan of a
 * session depends on the due dates and on nothing about the list or the level.
 */
import { describe, it, expect } from 'vitest';

import { planSession } from './TestLogic';
import { Word } from '../../../types/models';

const dayOffset = (days: number): string => {
  const date = new Date(2026, 0, 1 + days);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const makeWord = (id: number, overrides: Partial<Word> = {}): Word => ({
  id,
  simp: `词${id}`,
  trad: `詞${id}`,
  pinyin: `ci${id}`,
  meaning: `word ${id}`,
  level: 1,
  due_date: dayOffset(0),
  ...overrides,
});

/** Twelve words, all due on the same day, spread over three lists and levels. */
const sameDayWords = (): Word[] =>
  Array.from({ length: 12 }, (_, index) =>
    makeWord(index + 1, {
      level: (index % 5) + 1,
      listId: `list-${index % 3}`,
    }),
  );

const options = {
  budget: 8,
  includeHandwriting: true,
  now: new Date(2026, 0, 10),
};

const idsOf = (words: Word[]): number[] => words.map((word) => word.id);

describe('planSession — interleaving', () => {
  it('reads neither the list nor the level of a word', () => {
    const plan = planSession(sameDayWords(), options);

    // The same words, with their lists and levels permuted. A plan that read
    // either would answer differently; one that ranks by due date cannot.
    const relabelled = sameDayWords().map((word, index) => ({
      ...word,
      level: 5 - (index % 5),
      listId: `list-${(index + 1) % 3}`,
    }));

    expect(idsOf(planSession(relabelled, options).words)).toEqual(idsOf(plan.words));
  });

  it('does not group the session by list', () => {
    const plan = planSession(sameDayWords(), options);
    const lists = plan.words.map((word) => word.listId);
    const blocked = [...lists].sort();

    expect(plan.words.length).toBeGreaterThan(3);
    expect(lists).not.toEqual(blocked);
  });

  it('does not order the session by level', () => {
    const plan = planSession(sameDayWords(), options);
    const levels = plan.words.map((word) => word.level ?? 0);

    expect(levels).not.toEqual([...levels].sort((a, b) => a - b));
    expect(levels).not.toEqual([...levels].sort((a, b) => b - a));
  });

  it('cuts the session at the budget by due date, not by level', () => {
    // The oldest words are the lowest levels here, so a level-blind plan takes
    // them all: a plan that preferred a level would leave one out.
    const words = [
      ...Array.from({ length: 4 }, (_, i) => makeWord(i + 1, { level: 5, due_date: dayOffset(0) })),
      ...Array.from({ length: 4 }, (_, i) => makeWord(i + 5, { level: 1, due_date: dayOffset(3) })),
    ];

    const plan = planSession(words, { ...options, budget: 4 });

    expect(idsOf(plan.words).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});
