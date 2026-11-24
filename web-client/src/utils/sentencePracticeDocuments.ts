/**
 * The Firestore documents of one sentence grade (#489), built with no Firebase
 * import so that the rules tests write the same shapes as the app.
 */
import { dayKey } from './retention';
import type { SentenceTab } from './sentenceSettings';
import type { SentenceResult } from './sentenceQueue';

/** 2 since #386: a Compose entry names its input, and a tile answer logs its tiles. */
export const SENTENCE_LOG_VERSION = 2;

/** Whether the task played the sentence (`audio`) or showed it (`text`). */
export type SentenceMode = 'audio' | 'text';

/** How the learner gave a Compose answer: keyboard or mic (`free`), or tiles (#386). */
export type ComposeInput = 'free' | 'tiles';

/** One grade of one task, as the tab records it. */
export interface SentenceGrade {
  wordId: number;
  sentenceId: string;
  tab: SentenceTab;
  grade: SentenceResult;
  mode: SentenceMode;
  /** The raw answer of a Compose task: the placed characters of a tile answer. */
  answer?: string;
  /** The input of a Compose task. `free` when not given. */
  input?: ComposeInput;
  /**
   * The tiles of a tile answer, in screen order. A rebuild can change the
   * tile set of a sentence, so only the log keeps the tiles that the learner saw.
   */
  tiles?: string[];
  /** The time from the start of the task to the reveal. */
  answerMs: number;
  /** Whether the Chinese text showed before the reveal. */
  revealed: boolean;
  /** How many segments the learner tapped. */
  lookups: number;
  at: Date;
}

/**
 * The update of `users/{uid}/sentencePractice/{wordId}`, written as a merged
 * set. A merged set merges the maps depth-first, so the other tab, and the
 * sentences seen before, keep their values.
 */
export function sentencePracticeUpdate<T>(grade: SentenceGrade, at: T) {
  return {
    [grade.tab]: {
      lastPractised: at,
      lastResult: grade.grade,
      seen: { [grade.sentenceId]: at },
    },
  };
}

/** The fields that only a Compose entry has. */
function composeFields(grade: SentenceGrade) {
  const input = grade.input ?? 'free';
  return {
    input,
    ...(grade.answer !== undefined ? { answer: grade.answer } : {}),
    ...(input === 'tiles' && grade.tiles !== undefined ? { tiles: grade.tiles } : {}),
  };
}

/** The write-once document of `users/{uid}/sentenceLog/{autoId}`. */
export function sentenceLogDocument<T>(grade: SentenceGrade, at: T) {
  return {
    version: SENTENCE_LOG_VERSION,
    date: dayKey(grade.at),
    reviewedAt: at,
    wordId: grade.wordId,
    sentenceId: grade.sentenceId,
    tab: grade.tab,
    grade: grade.grade,
    mode: grade.mode,
    ...(grade.tab === 'compose' ? composeFields(grade) : {}),
    answerMs: grade.answerMs,
    revealed: grade.revealed,
    lookups: grade.lookups,
  };
}
