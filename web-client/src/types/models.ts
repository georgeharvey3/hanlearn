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
 * `lapses` is how many times the learner has failed to recall this direction
 * after learning it. It reads as 0 when absent, and a direction that has
 * collected enough of them is a leech. See
 * docs/adr/0010-partial-demotion-and-leeches.md.
 */
export interface DirectionState {
  level: number;
  dueDate: string;
  lapses?: number;
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
 * The grade of one question: how the first attempt at it went.
 *
 * `pass` is a correct first attempt, `lapse` is a correct answer that followed
 * a wrong one, and `fail` is "I don't know" or the handwriting reveal. The
 * retries stay, and they do not change the grade. See
 * docs/adr/0007-grade-the-first-attempt.md.
 */
export type DirectionResult = 'pass' | 'lapse' | 'fail';

/**
 * What one word's session produced, as submitted to finishTest.
 *
 * Only the directions the session asked appear. A direction that is absent
 * keeps the bank, due date and tone error count it already holds.
 *
 * `toneErrors` is a separate map because it has a separate life: the grade
 * replaces the bank of a direction, and the tone errors add to a running count
 * that every session of that direction contributes to.
 */
export interface WordDirectionResults {
  word_id: number;
  directions: Partial<Record<Direction, DirectionResult>>;
  toneErrors?: Partial<Record<Direction, number>>;
}

/**
 * One row of the session summary: how one question went.
 * The session asks a word in one direction, so a word produces one of these.
 */
export interface WordScore {
  char: string;
  direction: Direction;
  result: DirectionResult;
}

/**
 * The grade of one question, recorded as the session runs.
 *
 * The word is held by id rather than by character, because two words in one
 * session can share a character form and the results must not be merged.
 *
 * `toneErrors` counts the attempts at this question that gave the correct
 * syllables with an incorrect tone. It is 0 for every question that does not
 * ask for pinyin.
 */
export interface DirectionGrade {
  wordId: number;
  direction: Direction;
  result: DirectionResult;
  toneErrors: number;
}

export type QuestionCategory = 'C' | 'P' | 'M';

/**
 * One entry of the session queue: one word, asked in one direction.
 *
 * `index` points into the words of the plan, and the two categories are the
 * direction split into the answer it wants and the question it shows. The
 * direction that names the pair is `directionOf` in `TestLogic.ts`.
 */
export interface QueuePair {
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
