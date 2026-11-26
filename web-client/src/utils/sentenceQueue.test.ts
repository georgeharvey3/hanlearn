import { describe, it, expect } from 'vitest';

import { DIRECTIONS, Direction, Word } from '../types/models';
import { makeDirections } from './directions';
import {
  PracticeByWord,
  SentenceIndex,
  buildSet,
  gatedWords,
  hasNeverPractised,
  lapseSnapshot,
  recordPractice,
} from './sentenceQueue';

// Wednesday 4 November 2026, mid-morning.
const NOW = new Date(2026, 10, 4, 10, 0);

/** A day key `days` days after NOW, in the format the word documents use. */
const inDays = (days: number): string => {
  const date = new Date(2026, 10, 4 + days);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

let nextId = 1;
const word = (
  simp: string,
  level: number,
  dueInDays = 10,
  overrides: Partial<Record<Direction, { level?: number; dueInDays?: number }>> = {},
): Word => {
  const directions = makeDirections(level, inDays(dueInDays));
  for (const direction of DIRECTIONS) {
    const over = overrides[direction];
    if (!over) continue;
    directions[direction] = {
      level: over.level ?? level,
      dueDate: inDays(over.dueInDays ?? dueInDays),
    };
  }
  return {
    id: nextId++,
    simp,
    trad: simp,
    pinyin: '',
    meaning: '',
    level: Math.min(...Object.values(directions).map((d) => d.level)),
    due_date: inDays(dueInDays),
    directions,
  };
};

/** The index entry of a word whose two tabs share one sentence. */
const both = (id: string) => ({ comprehend: id, compose: id });

/** The word with these lapse counts on its directions. */
const withLapses = (w: Word, lapses: Partial<Record<Direction, number>>): Word => {
  const directions = { ...w.directions! };
  for (const [direction, count] of Object.entries(lapses) as [Direction, number][]) {
    directions[direction] = { ...directions[direction], lapses: count };
  }
  return { ...w, directions };
};

const at = (days: number, hour = 9): string => new Date(2026, 10, 4 + days, hour).toISOString();

describe('the words a tab may use', () => {
  const index = { 学: both('a'), 书: both('b'), 吃: both('c'), 喝: both('d') };

  it('keeps the words that pass the gate of the tab', () => {
    const one = word('学', 1);
    const two = word('书', 2);
    const three = word('吃', 3);

    expect(gatedWords([one, two, three], 'comprehend', NOW)).toEqual([two, three]);
    expect(gatedWords([one, two, three], 'compose', NOW)).toEqual([three]);
  });

  it('reads the four recall directions and not CM', () => {
    const weakRecall = word('学', 3, 10, { PM: { level: 1 } });
    const weakHandwriting = word('书', 3, 10, { CM: { level: 1 } });

    expect(gatedWords([weakRecall, weakHandwriting], 'compose', NOW)).toEqual([weakHandwriting]);
  });

  it('leaves out a word with a direction due today or tomorrow, overdue included', () => {
    const overdue = word('学', 3, 10, { MC: { dueInDays: -3 } });
    const today = word('书', 3, 10, { CM: { dueInDays: 0 } });
    const tomorrow = word('吃', 3, 10, { PC: { dueInDays: 1 } });
    const later = word('喝', 3, 2);

    expect(gatedWords([overdue, today, tomorrow, later], 'comprehend', NOW)).toEqual([later]);
  });

  it('leaves out a word with no example sentence', () => {
    const withSentence = word('学', 3);
    const without = word('无', 3);

    const set = buildSet({
      words: [withSentence, without],
      practice: {},
      index,
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word)).toEqual([withSentence]);
  });
});

describe('the order of a set', () => {
  it('puts never practised first, then a wrong last grade, then a right last grade that lapsed since', () => {
    const right = withLapses(word('学', 3), { MC: 1 });
    const fresh = word('书', 3);
    const wrong = word('吃', 3);
    const practice: PracticeByWord = {
      [right.id]: { comprehend: { lastPractised: at(-5), lastResult: 'right', seen: {} } },
      [wrong.id]: { comprehend: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [right, fresh, wrong],
      practice,
      index: { 学: both('a'), 书: both('b'), 吃: both('c') },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['书', '吃', '学']);
  });

  it('takes the oldest practice first among the wrong and among the right', () => {
    const words = ['一', '二', '三', '四'].map((simp) => withLapses(word(simp, 3), { MP: 1 }));
    const entry = (days: number, lastResult: 'right' | 'wrong') => ({
      comprehend: { lastPractised: at(days), lastResult, seen: {} },
    });
    const practice: PracticeByWord = {
      [words[0].id]: entry(-1, 'right'),
      [words[1].id]: entry(-4, 'right'),
      [words[2].id]: entry(-1, 'wrong'),
      [words[3].id]: entry(-6, 'wrong'),
    };

    const set = buildSet({
      words,
      practice,
      index: { 一: both('a'), 二: both('b'), 三: both('c'), 四: both('d') },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['四', '三', '二', '一']);
  });

  it('takes the lowest level first among the words never practised', () => {
    const high = word('一', 5);
    const low = word('二', 2);
    const mid = word('三', 3);

    const set = buildSet({
      words: [high, low, mid],
      practice: {},
      index: { 一: both('a'), 二: both('b'), 三: both('c') },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    expect(set.map((task) => task.word.simp)).toEqual(['二', '三', '一']);
  });

  it('holds a miss back until no new word is left', () => {
    const missed = word('错', 3);
    const imported = Array.from({ length: 50 }, (_, i) => word(`新${i}`, 2));
    const index: SentenceIndex = { 错: both('x') };
    for (const w of imported) index[w.simp] = both(`s-${w.simp}`);
    const practice: PracticeByWord = {
      [missed.id]: { comprehend: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [...imported, missed],
      practice,
      index,
      tab: 'comprehend',
      size: 51,
      now: NOW,
    });
    expect(set.slice(0, 50).map((task) => task.word)).toEqual(imported);
    expect(set[50].word).toBe(missed);
  });

  it('reads the practice of its own tab only', () => {
    const composedWrong = word('学', 3);
    const fresh = word('书', 2);
    const practice: PracticeByWord = {
      [composedWrong.id]: { compose: { lastPractised: at(-1), lastResult: 'wrong', seen: {} } },
    };

    const set = buildSet({
      words: [composedWrong, fresh],
      practice,
      index: { 学: both('a'), 书: both('b') },
      tab: 'comprehend',
      size: 5,
      now: NOW,
    });
    // Both are never practised in Comprehend, so the lower level comes first.
    expect(set.map((task) => task.word.simp)).toEqual(['书', '学']);
  });

  it('holds the set to its size', () => {
    const words = ['一', '二', '三'].map((simp) => word(simp, 3));
    const set = buildSet({
      words,
      practice: {},
      index: { 一: both('a'), 二: both('b'), 三: both('c') },
      tab: 'compose',
      size: 2,
      now: NOW,
    });
    expect(set).toHaveLength(2);
  });
});

describe('whether a tab has a word never practised there', () => {
  const index = { 学: both('a'), 书: both('b') };

  it('is true for an eligible word with no practice in the tab', () => {
    const study = word('学', 3);
    const practice: PracticeByWord = {
      [study.id]: { compose: { lastPractised: at(-1), lastResult: 'right', seen: {} } },
    };
    expect(
      hasNeverPractised({ words: [study], practice, index, tab: 'comprehend', now: NOW }),
    ).toBe(true);
    expect(hasNeverPractised({ words: [study], practice, index, tab: 'compose', now: NOW })).toBe(
      false,
    );
  });

  it('is false when the only fresh word is not eligible', () => {
    const due = word('学', 3, 1);
    const noSentence = word('无', 3);
    expect(
      hasNeverPractised({
        words: [due, noSentence],
        practice: {},
        index,
        tab: 'comprehend',
        now: NOW,
      }),
    ).toBe(false);
  });
});

describe('the sentence of a task', () => {
  const study = word('学', 3);
  const index = { 学: { comprehend: 'read', compose: 'write' } };

  it('gives each tab the sentence id of its pool, whatever the tabs saw before', () => {
    const practice: PracticeByWord = {
      [study.id]: {
        comprehend: { lastPractised: at(-1), lastResult: 'wrong', seen: { read: at(-1) } },
      },
    };
    const sentenceOf = (tab: 'comprehend' | 'compose') =>
      buildSet({ words: [study], practice, index, tab, size: 1, now: NOW })[0]?.sentenceId;

    expect(sentenceOf('comprehend')).toBe('read');
    expect(sentenceOf('compose')).toBe('write');
  });
});

describe('a word that the other tab showed today', () => {
  const TOMORROW = new Date(2026, 10, 5, 10, 0);
  const shared = { 学: both('only') };

  const seenToday = (study: Word, tab: 'comprehend' | 'compose', id = 'only'): PracticeByWord => ({
    [study.id]: { [tab]: { lastPractised: at(0), lastResult: 'wrong', seen: { [id]: at(0) } } },
  });

  it('waits until tomorrow when the two tabs share the sentence that the other tab showed today', () => {
    const study = word('学', 3);
    const practice = seenToday(study, 'comprehend');
    const set = (now: Date) =>
      buildSet({ words: [study], practice, index: shared, tab: 'compose', size: 5, now });

    expect(set(NOW)).toEqual([]);
    expect(set(TOMORROW)).toEqual([{ word: study, sentenceId: 'only' }]);
  });

  it('does not wait when the two tabs have different sentences', () => {
    const study = word('学', 3);
    const index = { 学: { comprehend: 'read', compose: 'write' } };
    const [task] = buildSet({
      words: [study],
      practice: seenToday(study, 'comprehend', 'read'),
      index,
      tab: 'compose',
      size: 1,
      now: NOW,
    });
    expect(task?.sentenceId).toBe('write');
  });

  it('does not wait when the other tab showed this sentence today but the tabs no longer share it', () => {
    // Before the pools, the rotation of a tab could show what is now the
    // sentence of the other tab.
    const study = word('学', 3);
    const index = { 学: { comprehend: 'read', compose: 'write' } };
    const [task] = buildSet({
      words: [study],
      practice: seenToday(study, 'comprehend', 'write'),
      index,
      tab: 'compose',
      size: 1,
      now: NOW,
    });
    expect(task?.sentenceId).toBe('write');
  });

  it('reads the local calendar day, so a view just before midnight does not count', () => {
    const study = word('学', 3);
    const practice: PracticeByWord = {
      [study.id]: {
        comprehend: {
          lastPractised: new Date(2026, 10, 3, 23, 59).toISOString(),
          lastResult: 'right',
          seen: { only: new Date(2026, 10, 3, 23, 59).toISOString() },
        },
      },
    };
    const set = buildSet({
      words: [study],
      practice,
      index: shared,
      tab: 'compose',
      size: 1,
      now: new Date(2026, 10, 4, 0, 1),
    });
    expect(set).toEqual([{ word: study, sentenceId: 'only' }]);
  });

  it('makes the tab neither ready nor fresh when it is the only word', () => {
    const study = word('学', 3);
    const input = {
      words: [study],
      practice: seenToday(study, 'comprehend'),
      index: shared,
      tab: 'compose' as const,
      now: NOW,
    };

    expect(buildSet({ ...input, size: 1 })).toEqual([]);
    expect(hasNeverPractised(input)).toBe(false);
  });

  it('does not wait when the same tab showed the sentence today', () => {
    const study = word('学', 3);
    const [task] = buildSet({
      words: [study],
      practice: seenToday(study, 'compose'),
      index: shared,
      tab: 'compose',
      size: 1,
      now: NOW,
    });
    expect(task?.sentenceId).toBe('only');
  });

  it('does not wait for a sentence that the other tab showed and that is not its sentence now', () => {
    const study = word('学', 3);
    const [task] = buildSet({
      words: [study],
      practice: seenToday(study, 'comprehend', 'gone'),
      index: shared,
      tab: 'compose',
      size: 1,
      now: NOW,
    });
    expect(task?.sentenceId).toBe('only');
  });
});

describe('recording a grade', () => {
  it('sets the result and the date, and adds the sentence to the seen ones', () => {
    const before: PracticeByWord = {
      '7': {
        comprehend: { lastPractised: at(-3), lastResult: 'right', seen: { a: at(-3) } },
        compose: { lastPractised: at(-2), lastResult: 'right', seen: {} },
      },
    };
    const after = recordPractice(before, {
      wordId: 7,
      tab: 'comprehend',
      sentenceId: 'b',
      result: 'wrong',
      at: NOW,
      lapses: { MC: 2, MP: 0 },
    });

    expect(after['7'].comprehend).toEqual({
      lastPractised: NOW.toISOString(),
      lastResult: 'wrong',
      seen: { a: at(-3), b: NOW.toISOString() },
      lapses: { MC: 2, MP: 0 },
    });
    expect(after['7'].compose).toBe(before['7'].compose);
    // The state before is left as it was.
    expect(before['7'].comprehend?.lastResult).toBe('right');
  });
});

describe('a word graded right', () => {
  const index = { 学: both('a') };
  const right = (lapses?: Partial<Record<Direction, number>>) => ({
    lastPractised: at(-5),
    lastResult: 'right' as const,
    seen: { a: at(-5) },
    ...(lapses ? { lapses } : {}),
  });
  const setOf = (w: Word, practice: PracticeByWord, tab: 'comprehend' | 'compose') =>
    buildSet({ words: [w], practice, index, tab, size: 5, now: NOW });

  it('never comes back while no trigger direction lapses', () => {
    const w = withLapses(word('学', 3), { MC: 1, PM: 2 });
    const practice: PracticeByWord = {
      [w.id]: { comprehend: right({ MC: 1, MP: 0 }), compose: right({ PM: 2, CM: 0 }) },
    };

    expect(setOf(w, practice, 'comprehend')).toEqual([]);
    expect(setOf(w, practice, 'compose')).toEqual([]);
  });

  it('comes back to Comprehend after an MC or MP lapse, and not after a PM or CM lapse', () => {
    const w = word('学', 3);
    const practice: PracticeByWord = { [w.id]: { comprehend: right({ MC: 0, MP: 0 }) } };

    expect(setOf(withLapses(w, { MP: 1 }), practice, 'comprehend')).toHaveLength(1);
    expect(setOf(withLapses(w, { MC: 1 }), practice, 'comprehend')).toHaveLength(1);
    expect(setOf(withLapses(w, { PM: 1, CM: 1, PC: 1 }), practice, 'comprehend')).toEqual([]);
  });

  it('comes back to Compose after a PM or CM lapse, and not after an MC or MP lapse', () => {
    const w = word('学', 3);
    const practice: PracticeByWord = { [w.id]: { compose: right({ PM: 0, CM: 0 }) } };

    expect(setOf(withLapses(w, { PM: 1 }), practice, 'compose')).toHaveLength(1);
    expect(setOf(withLapses(w, { CM: 1 }), practice, 'compose')).toHaveLength(1);
    expect(setOf(withLapses(w, { MC: 1, MP: 1, PC: 1 }), practice, 'compose')).toEqual([]);
  });

  it('reads a grade with no snapshot as 0 lapses', () => {
    const w = word('学', 3);
    const practice: PracticeByWord = { [w.id]: { comprehend: right() } };

    expect(setOf(w, practice, 'comprehend')).toEqual([]);
    expect(setOf(withLapses(w, { MC: 1 }), practice, 'comprehend')).toHaveLength(1);
  });

  it('makes the tab neither ready nor fresh when it is the only word', () => {
    const w = word('学', 3);
    const practice: PracticeByWord = { [w.id]: { comprehend: right({ MC: 0, MP: 0 }) } };

    expect(setOf(w, practice, 'comprehend')).toEqual([]);
    expect(hasNeverPractised({ words: [w], practice, index, tab: 'comprehend', now: NOW })).toBe(
      false,
    );
  });

  it('snapshots the lapse counts of the trigger directions of the tab', () => {
    const w = withLapses(word('学', 3), { MC: 3, PC: 4, CM: 1 });

    expect(lapseSnapshot(w, 'comprehend')).toEqual({ MC: 3, MP: 0 });
    expect(lapseSnapshot(w, 'compose')).toEqual({ PM: 0, CM: 1 });
  });
});
