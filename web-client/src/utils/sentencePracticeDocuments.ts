/**
 * The Firestore documents of one sentence grade (#489), built with no Firebase
 * import so that the rules tests write the same shapes as the app.
 */
import { dayKey } from './retention';
import type { SentenceTab } from './sentenceSettings';
import type { SentenceResult } from './sentenceQueue';

export const SENTENCE_LOG_VERSION = 1;

/** Whether the task played the sentence (`audio`) or showed it (`text`). */
export type SentenceMode = 'audio' | 'text';

/** One grade of one task, as the tab records it. */
export interface SentenceGrade {
  wordId: number;
  sentenceId: string;
  tab: SentenceTab;
  grade: SentenceResult;
  mode: SentenceMode;
  /** The raw answer of a Compose task. */
  answer?: string;
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
    ...(grade.tab === 'compose' && grade.answer !== undefined ? { answer: grade.answer } : {}),
    answerMs: grade.answerMs,
    revealed: grade.revealed,
    lookups: grade.lookups,
  };
}
