// Domain models for HanLearn

export interface Word {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
  due_date?: string;
  bank?: number;
  ammended_meaning?: string;
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
  pinyin: string;
  meaning: string;
  story?: string;
}

export interface Sentence {
  text: string;
  translation: string;
  highlighted?: string;
}
