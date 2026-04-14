// Domain models for HanLearn

export interface Word {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
  due_date?: string;
  level?: number;
  ammended_meaning?: string;
  listId?: string;
}

export interface WordList {
  id: string;
  name: string;
  createdAt: string;
  order: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface TestScore {
  word_id: number;
  score: number;
}

export interface WordScore {
  char: string;
  score: 'Very Strong' | 'Strong' | 'Average' | 'Weak' | 'Very Weak';
}

export type QuestionCategory = 'C' | 'P' | 'M';

export interface TestPerm {
  index: string;
  aCategory: QuestionCategory;
  qCategory: QuestionCategory;
}

export interface Chengyu {
  characters: string;
  // Traditional character equivalent. Must be provided for every entry.
  trad: string;
  pinyin: string;
  meaning: string;
  story?: string;
}

export interface CharData {
  simp: string;
  pinyins: string[];
  meanings: string[];
}

export interface Sentence {
  text: string;
  translation: string;
  highlighted?: string;
}

export interface CloudSentence {
  chinese: {
    sentence: string;
    highlight: number[][];
    segments: string[];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}
