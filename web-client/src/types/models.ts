// Domain models for HanLearn

/**
 * The five directions a word can be tested in.
 *
 * A direction is a pair of an answer category and a question category, written
 * answer-first: 'MC' asks the character and takes the meaning as the answer.
 * 'CM' is the handwriting direction, because the answer is the character.
 *
 * Receptive recognition ('MC', 'MP'), productive recall ('PC', 'PM') and
 * handwriting production ('CM') are separate skills, so each one carries its
 * own level and due date. See docs/adr/0002-direction-level-scheduling.md.
 *
 * The order of this list is also the rotation order the session queue uses when
 * more than one direction of a word is due.
 */
export const DIRECTIONS = ['MC', 'MP', 'PM', 'PC', 'CM'] as const;

export type Direction = (typeof DIRECTIONS)[number];

/**
 * The scheduling state of one direction of one word.
 *
 * `level` is the spaced repetition level, 1 to 5. Firestore stores it as `bank`,
 * the same duplicate name the top-level field carries.
 * `dueDate` is a YYYY/MM/DD string, the format `Word.due_date` uses.
 */
export interface DirectionState {
  level: number;
  dueDate: string;
}

export type DirectionStates = Record<Direction, DirectionState>;

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
  /**
   * Per-direction scheduling state. Optional on the type because a Word can be
   * built from a dictionary result that has no scheduling state at all, but
   * every word that comes out of the service layer carries all five directions.
   */
  directions?: DirectionStates;
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

/**
 * The outcome of one direction in one session.
 *
 * A direction fails only when the learner selects "I don't know", or when the
 * handwriting reveal runs. A wrong answer gives "Try again" and unlimited
 * retries, so it is not a failure on its own.
 */
export type DirectionResult = 'pass' | 'fail';

/**
 * What one word's session produced, as submitted to finishTest.
 *
 * Only the directions the session asked appear. A direction that is absent
 * keeps the bank and due date it already holds.
 */
export interface WordDirectionResults {
  word_id: number;
  directions: Partial<Record<Direction, DirectionResult>>;
}

/**
 * One row of the session summary: how one direction of one word went.
 * A word the session asked in five directions produces five of these.
 */
export interface WordScore {
  char: string;
  direction: Direction;
  result: DirectionResult;
}

/**
 * A direction the learner did not know, recorded as the session runs.
 *
 * The word is held by id rather than by character, because two words in one
 * session can share a character form and the results must not be merged.
 */
export interface DirectionFailure {
  wordId: number;
  direction: Direction;
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
