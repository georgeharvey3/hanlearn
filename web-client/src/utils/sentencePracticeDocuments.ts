/**
 * The Firestore documents of one sentence grade (#489), built with no Firebase
 * import so that the rules tests write the same shapes as the app.
 */
import { dayKey } from './retention';
import type { Direction } from '../types/models';
import type { SentenceTab } from './sentenceSettings';
import type { SentenceResult } from './sentenceQueue';

/** The version of a Comprehend entry: 2 since #386. */
export const SENTENCE_LOG_VERSION = 2;

/**
 * The version of a Compose entry: 3 since #597. It logs each attempt, and no
 * single answer. A tile answer names its input and logs its tiles (#386).
 */
export const ATTEMPTS_LOG_VERSION = 3;

/**
 * The most attempts that one entry logs. The rules allow no more, because one
 * rules evaluation counts at most 1000 expressions.
 */
export const MAX_LOGGED_ATTEMPTS = 10;

/** Whether the task played the sentence (`audio`) or showed it (`text`). */
export type SentenceMode = 'audio' | 'text';

/** How the learner gave a Compose answer: keyboard or mic (`free`), or tiles (#386). */
export type ComposeInput = 'free' | 'tiles';

/** One checked answer of a Compose task (#597). */
export interface ComposeAttempt {
  /** The raw text of the input at the check. */
  answer: string;
  /** The time from the start of the task to this check. */
  answerMs: number;
  /** How many English words the learner looked up since the previous check. */
  lookups: number;
}

interface GradeBase {
  wordId: number;
  sentenceId: string;
  tab: SentenceTab;
  grade: SentenceResult;
  mode: SentenceMode;
  /** The lookups of the task: segments tapped (Comprehend), English words (Compose). */
  lookups: number;
  at: Date;
  /** The lapse count of each trigger direction of the tab at the grade. */
  lapses: Partial<Record<Direction, number>>;
}

/** The grade of a Compose task: right only when the first attempt matches. */
export interface AttemptsGrade extends GradeBase {
  /** The attempts in order. The last one matches, unless the learner gave up. */
  attempts: ComposeAttempt[];
  gaveUp: boolean;
  /** `tiles` for a tile answer. A free answer (keyboard or mic) has no input. */
  input?: 'tiles';
  /**
   * The tiles of a tile answer, in screen order. A rebuild can change the
   * tile set of a sentence, so only the log keeps the tiles that the learner saw.
   */
  tiles?: string[];
}

/** The grade of a Comprehend task. */
export interface AnswerGrade extends GradeBase {
  /** The time from the start of the task to the reveal. */
  answerMs: number;
  /** Whether the Chinese text showed before the reveal. */
  revealed: boolean;
}

/** One grade of one task, as the tab records it. */
export type SentenceGrade = AnswerGrade | AttemptsGrade;

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
      lapses: grade.lapses,
    },
  };
}

/**
 * The attempts that the log keeps, in order: all of them, or the first ones
 * and the last one. The last attempt is the match, unless the learner gave up.
 */
function loggedAttempts(attempts: ComposeAttempt[]): ComposeAttempt[] {
  const kept =
    attempts.length <= MAX_LOGGED_ATTEMPTS
      ? attempts
      : [...attempts.slice(0, MAX_LOGGED_ATTEMPTS - 1), attempts[attempts.length - 1]];
  return kept.map(({ answer, answerMs, lookups }) => ({ answer, answerMs, lookups }));
}

/** The write-once document of `users/{uid}/sentenceLog/{autoId}`. */
export function sentenceLogDocument<T>(grade: SentenceGrade, at: T) {
  const base = {
    date: dayKey(grade.at),
    reviewedAt: at,
    wordId: grade.wordId,
    sentenceId: grade.sentenceId,
    tab: grade.tab,
    grade: grade.grade,
    mode: grade.mode,
  };
  if ('attempts' in grade) {
    return {
      version: ATTEMPTS_LOG_VERSION,
      ...base,
      gaveUp: grade.gaveUp,
      lookups: grade.lookups,
      attempts: loggedAttempts(grade.attempts),
      ...(grade.input === 'tiles' ? { input: grade.input, tiles: grade.tiles ?? [] } : {}),
    };
  }
  return {
    version: SENTENCE_LOG_VERSION,
    ...base,
    answerMs: grade.answerMs,
    revealed: grade.revealed,
    lookups: grade.lookups,
  };
}
