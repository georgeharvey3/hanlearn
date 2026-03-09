import { Word, TestPerm, QuestionCategory } from '../../../types/models';
import { parseMeanings } from '../../../utils/meaningUtils';

const pickRandom = <T>(array: T[], n: number): T[] => {
  const remaining = [...array];
  const selected: T[] = [];
  const count = Math.min(n, remaining.length);
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
};

/**
 * Parse a due-date string into a Date.
 *
 * Three formats are in circulation:
 *   • YYYY/MM/DD  — stored by wordService.formatDate (the common case)
 *   • YYYY-MM-DD  — ISO date-only (hyphenated variant)
 *   • ISO 8601    — full timestamp like "2026-03-07T10:00:00.000Z" (demo words)
 *
 * ISO strings containing 'T' are parsed with new Date() — all browsers handle
 * these correctly.  Date-only strings are parsed manually so Safari/WebKit
 * (which returns Invalid Date for slash-separated strings) works on iOS.
 */
function parseDueDate(dateStr: string): Date | null {
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  const normalised = dateStr.replace(/\//g, '-');
  const [year, month, day] = normalised.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function seedFromDate(date: Date): number {
  const str = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dueDateDay(dateStr: string): number {
  const d = parseDueDate(dateStr)!;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const chooseTestSet = (allWords: Word[], numWords: number): Word[] => {
  const today = new Date();
  const dueWords = allWords.filter((word) => {
    if (!word.due_date) return false;
    const due = parseDueDate(word.due_date);
    return due !== null && due <= today;
  });

  if (dueWords.length <= numWords) {
    return dueWords;
  }

  // Sort by due date ascending (oldest due first)
  dueWords.sort((a, b) => dueDateDay(a.due_date!) - dueDateDay(b.due_date!));

  // Find the cutoff date (the due date of the last word we'd take)
  const cutoffTime = dueDateDay(dueWords[numWords - 1].due_date!);

  const definitelyIn: Word[] = [];
  const tieGroup: Word[] = [];

  for (const word of dueWords) {
    const dayTime = dueDateDay(word.due_date!);
    if (dayTime < cutoffTime) {
      definitelyIn.push(word);
    } else if (dayTime === cutoffTime) {
      tieGroup.push(word);
    }
  }

  const remaining = numWords - definitelyIn.length;
  const seed = seedFromDate(today);
  const shuffledTies = seededShuffle(tieGroup, seed);

  return [...definitelyIn, ...shuffledTies.slice(0, remaining)];
};

/**
 * Choose random words for practice mode, ignoring due dates
 */
export const chooseRandomTestSet = (allWords: Word[], numWords: number): Word[] => {
  return pickRandom(allWords, numWords);
};

export const setPermList = (
  testSet: Word[],
  includeHandwriting: boolean,
  priority: string = 'none',
  onlyPriority: boolean = false,
): TestPerm[] => {
  const nums = Array.from(Array(testSet.length).keys());

  let qaCombinations: string[];

  if (includeHandwriting) {
    qaCombinations = ['CM', 'PC', 'PM', 'MP', 'MC'];
  } else {
    qaCombinations = ['PC', 'PM', 'MP', 'MC'];
  }

  let permList: TestPerm[] = [];

  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < qaCombinations.length; j++) {
      permList.push({
        index: nums[i].toString(),
        aCategory: qaCombinations[j][0] as QuestionCategory,
        qCategory: qaCombinations[j][1] as QuestionCategory,
      });
    }
  }

  if (priority !== 'none' && onlyPriority) {
    permList = permList.filter(
      (perm) => perm.aCategory === priority[0] && perm.qCategory === priority[1],
    );
  }

  return permList;
};

const ranChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

export interface AssignQAResult {
  perm: TestPerm;
  chosenCharacter: string;
  answer: string | string[];
  answerCategory: string;
  question: string | string[];
  questionCategory: string;
}

export const assignQA = (
  testSet: Word[],
  permList: TestPerm[],
  charSet: 'simp' | 'trad',
  priority: string = 'none',
): AssignQAResult => {
  let priorityPerms: TestPerm[] = [];
  if (priority !== 'none') {
    priorityPerms = permList.filter(
      (perm) => perm.aCategory === priority[0] && perm.qCategory === priority[1],
    );
  }
  const perm = priorityPerms.length > 0 ? ranChoice(priorityPerms) : ranChoice(permList);
  const ranWord = testSet[parseInt(perm.index)];

  let Ax: string | string[];
  let ACs: string;
  let Qx: string | string[];
  let QCs: string;

  if (perm.aCategory === 'C') {
    Ax = ranWord[charSet];
    ACs = 'character';
  } else if (perm.aCategory === 'P') {
    Ax = ranWord.pinyin;
    ACs = 'pinyin';
  } else {
    Ax = parseMeanings(ranWord.meaning);
    ACs = 'meaning';
  }

  if (perm.qCategory === 'C') {
    Qx = ranWord[charSet];
    QCs = 'character';
  } else if (perm.qCategory === 'P') {
    Qx = ranWord.pinyin;
    QCs = 'pinyin';
  } else {
    Qx = parseMeanings(ranWord.meaning);
    QCs = 'meaning';
  }

  return {
    perm: perm,
    chosenCharacter: ranWord[charSet],
    answer: Ax,
    answerCategory: ACs,
    question: Qx,
    questionCategory: QCs,
  };
};

export const toneChecker = (inp: string, answer: string): boolean => {
  return inp.replace(/[0-9]/g, '') === answer.replace(/[0-9]/g, '');
};

export const Counter = (array: string[]): Record<string, number> => {
  const count: Record<string, number> = {};
  array.forEach((val) => (count[val] = (count[val] || 0) + 1));
  return count;
};

export const removePunctuation = (word: string): string => {
  return word
    .toLowerCase()
    .replace(/[.,/#!'$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s{2,}/g, ' ');
};
