// PROTOTYPE (#414): the data, sample data and strings that the three variants
// of the session summary and the empty state share. Throwaway; lives on the
// prototype/summary-414 branch only.
import React from 'react';
import { colors } from '../../../../theme';
import { Direction, DirectionResult, Word, WordScore } from '../../../../types/models';

/** One answered question, with the word's answers filled in for display. */
export interface SummaryRow {
  char: string;
  pinyin: string;
  meaning: string;
  direction: Direction;
  result: DirectionResult;
}

export interface SummaryProps {
  rows: SummaryRow[];
  practiceMode: boolean;
  onHome: () => void;
  /** Practice the missed words again. A stub: the prototype only alerts. */
  onPracticeMissed: () => void;
}

export interface OtherList {
  id: string;
  name: string;
  due: number;
}

export interface EmptyProps {
  /** The list the session ran on: a list's name, or "All lists". */
  listName: string;
  isAllLists: boolean;
  otherLists: OtherList[];
  /** Due across all lists, when more than one list exists. */
  totalDue: number;
  hasMultipleLists: boolean;
  hasWords: boolean;
  /** Words due on each of the next 7 days, tomorrow first. Counts only. */
  upcoming: number[];
  onSwitchList: (id: string) => void;
  onTestAll: () => void;
  onAddWords: () => void;
  onPractice: () => void;
  onHome: () => void;
}

export interface VariantModule {
  Summary: React.FC<SummaryProps>;
  Empty: React.FC<EmptyProps>;
}

export const protoCopy = {
  stageDone: 'Done',
  stageTest: 'Test',
  backToDashboard: 'Back to Dashboard',
  done: 'Done',
  known: 'Known',
  nearly: 'Nearly',
  notKnown: 'Not known',
  lookAgain: 'Look again',
  allAnswers: 'All answers',
  hideAnswers: 'Hide answers',
  allKnown: 'All known',
  practiceMissed: 'Practise missed words',
  practiceNote: 'Practice · no due dates changed',
  questionsWords: (q: number, w: number) =>
    `${q} question${q === 1 ? '' : 's'} · ${w} word${w === 1 ? '' : 's'}`,
  knownOf: (k: number, t: number) => `${k} of ${t} known`,
  nothingDue: 'Nothing due',
  nothingDueIn: (list: string) => `Nothing due in ${list}`,
  allCaughtUp: 'All caught up',
  noWords: 'No words yet',
  nextDue: (n: number, day: string) => `${n} due ${day}`,
  nothingThisWeek: 'Nothing due this week',
  otherLists: 'Other lists',
  dueCount: (n: number) => `${n} due`,
  testAll: (n: number) => `Test all lists · ${n}`,
  study: 'Study',
  studyList: (name: string) => `Study ${name}`,
  practice: 'Practise',
  addWords: 'Add words',
  thisWeek: 'This week',
  tomorrow: 'tomorrow',
  inDays: (n: number) => `in ${n} days`,
  allLists: 'All lists',
  stubPractice: 'PROTOTYPE: would start a practice session of the missed words.',
};

/** The summary's question rows, with each word's pinyin and meaning. */
export const rowsFrom = (scores: WordScore[], words: Word[]): SummaryRow[] =>
  scores.map((s) => {
    const word = words.find((w) => w.simp === s.char || w.trad === s.char);
    return {
      char: s.char,
      pinyin: word?.pinyin ?? '',
      meaning: word?.ammended_meaning || word?.meaning || '',
      direction: s.direction,
      result: s.result,
    };
  });

const sample: [string, string, string, Direction, DirectionResult][] = [
  ['银行', 'yín háng', 'bank', 'MC', 'pass'],
  ['机场', 'jī chǎng', 'airport', 'PC', 'pass'],
  ['护照', 'hù zhào', 'passport', 'CM', 'fail'],
  ['安静', 'ān jìng', 'quiet', 'PM', 'lapse'],
  ['邻居', 'lín jū', 'neighbour', 'MP', 'pass'],
  ['打扫', 'dǎ sǎo', 'to sweep; to clean', 'MC', 'pass'],
  ['厨房', 'chú fáng', 'kitchen', 'PC', 'pass'],
  ['空调', 'kōng tiáo', 'air conditioning', 'CM', 'pass'],
  ['习惯', 'xí guàn', 'habit; to be used to', 'PM', 'fail'],
  ['附近', 'fù jìn', 'nearby', 'MC', 'pass'],
  ['表演', 'biǎo yǎn', 'to perform', 'PC', 'lapse'],
  ['冰箱', 'bīng xiāng', 'refrigerator', 'MP', 'pass'],
];

export const sampleRows = (): SummaryRow[] =>
  sample.map(([char, pinyin, meaning, direction, result]) => ({
    char,
    pinyin,
    meaning,
    direction,
    result,
  }));

/** Sample empty-state data for the `?state=` previews. */
export const sampleEmpty = (
  kind: 'empty' | 'empty-lists' | 'empty-new',
): Omit<EmptyProps, 'onSwitchList' | 'onTestAll' | 'onAddWords' | 'onPractice' | 'onHome'> => ({
  listName: 'HSK 3',
  isAllLists: false,
  otherLists:
    kind === 'empty-lists'
      ? [
          { id: 'travel', name: 'Travel', due: 14 },
          { id: 'food', name: 'Food', due: 6 },
        ]
      : [],
  totalDue: kind === 'empty-lists' ? 20 : 0,
  hasMultipleLists: kind === 'empty-lists',
  hasWords: kind !== 'empty-new',
  upcoming: kind === 'empty-new' ? [0, 0, 0, 0, 0, 0, 0] : [8, 3, 0, 12, 5, 2, 9],
});

/** Words due on each of the next 7 days, tomorrow first, from each word's earliest direction. */
export const upcomingCounts = (words: Word[], now = new Date()): number[] => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  for (const word of words) {
    const dates = word.directions
      ? Object.values(word.directions).map((d) => d.dueDate)
      : [word.due_date ?? ''];
    const times = dates.map((d) => new Date(d).getTime()).filter((t) => !Number.isNaN(t));
    if (times.length === 0) continue;
    const offset = Math.floor((Math.min(...times) - today) / day);
    if (offset >= 1 && offset <= 7) counts[offset - 1] += 1;
  }
  return counts;
};

export const firstUpcoming = (upcoming: number[]): { n: number; day: string } | null => {
  const i = upcoming.findIndex((n) => n > 0);
  if (i < 0) return null;
  return { n: upcoming[i], day: i === 0 ? protoCopy.tomorrow : protoCopy.inDays(i + 1) };
};

export const tally = (rows: SummaryRow[]) => ({
  total: rows.length,
  pass: rows.filter((r) => r.result === 'pass').length,
  lapse: rows.filter((r) => r.result === 'lapse').length,
  fail: rows.filter((r) => r.result === 'fail').length,
  words: new Set(rows.map((r) => r.char)).size,
});

export const resultLabel: Record<DirectionResult, string> = {
  pass: protoCopy.known,
  lapse: protoCopy.nearly,
  fail: protoCopy.notKnown,
};

export const resultInk: Record<DirectionResult, string> = {
  pass: colors.success,
  lapse: colors.warningText,
  fail: colors.primaryLight,
};

export const resultFill: Record<DirectionResult, string> = {
  pass: colors.success,
  lapse: colors.warning,
  fail: colors.primaryLight,
};

export const resultSurface: Record<DirectionResult, string> = {
  pass: colors.successSurface,
  lapse: colors.warningSurface,
  fail: colors.errorSurface,
};

/** Room at the foot of each screen for the floating variant switcher. */
export const SwitcherGap: React.FC = () => <div style={{ height: 52, flex: 'none' }} />;
