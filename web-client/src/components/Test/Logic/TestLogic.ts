import { Word, TestPerm, QuestionCategory } from '../../../types/models';

export const chooseTestSet = (allWords: Word[], numWords: number): Word[] => {
  const today = new Date();
  const dueWords = allWords.filter(
    (word) => word.due_date && new Date(word.due_date) <= today
  );
  let actualNumWords = numWords;
  if (actualNumWords > dueWords.length) {
    actualNumWords = dueWords.length;
  }
  const remainingWords = [...dueWords];
  const selectedWords: Word[] = [];
  for (let i = 0; i < actualNumWords; i++) {
    const index = Math.floor(Math.random() * remainingWords.length);
    const selectedWord = remainingWords[index];
    selectedWords.push(selectedWord);
    remainingWords.splice(index, 1);
  }
  return selectedWords;
};

export const setPermList = (
  testSet: Word[],
  includeHandwriting: boolean,
  priority: string = 'none',
  onlyPriority: boolean = false
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
      (perm) =>
        perm.aCategory === priority[0] && perm.qCategory === priority[1]
    );
  }

  return permList;
};

const ranChoice = <T,>(array: T[]): T =>
  array[Math.floor(Math.random() * array.length)];

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
  priority: string = 'none'
): AssignQAResult => {
  let priorityPerms: TestPerm[] = [];
  if (priority !== 'none') {
    priorityPerms = permList.filter(
      (perm) =>
        perm.aCategory === priority[0] && perm.qCategory === priority[1]
    );
  }
  const perm =
    priorityPerms.length > 0 ? ranChoice(priorityPerms) : ranChoice(permList);
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
    Ax = ranWord.meaning.split('/');
    ACs = 'meaning';
  }

  if (perm.qCategory === 'C') {
    Qx = ranWord[charSet];
    QCs = 'character';
  } else if (perm.qCategory === 'P') {
    Qx = ranWord.pinyin;
    QCs = 'pinyin';
  } else {
    Qx = ranWord.meaning.split('/');
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
