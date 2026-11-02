import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { reportError } from './errorReporting';
import { Direction, DirectionResult, GradeDetail } from '../types/models';
import { dayKey } from '../utils/retention';
import { Memory, SCHEDULER_NAME, retrievability } from '../utils/scheduling';

/**
 * The review log: one document per saved session at
 * `users/{userId}/reviewLog/{autoId}`, with one entry per graded question.
 *
 * `reviewStats` counts the reviews of a day, and it cannot show whether FSRS
 * predicted the recall of each review, or how the learner got to a grade. The
 * schedule of a direction is overwritten by each review, so this log is the
 * only record of the memory that FSRS read and the grade that it got. A script
 * in `migration/` exports it as a CSV for the FSRS optimizer. See issue #397.
 *
 * One document per session, not one per review: a review per document costs up
 * to 50 writes per session, and a session per document costs one. No analysis
 * queries one review in
 * Firestore, because the export flattens the documents. A session of 50
 * questions is about 20 KB, far below the 1 MiB limit of a document. The shape
 * is versioned, so a later change can tell old documents from new.
 *
 * The log is written after the reschedules are saved, and not in their batch.
 * A log that fails to save costs one session of measurement, and the session
 * itself is kept. A session that fails to save writes no log, so the log holds
 * no review that did not change the schedule.
 */

/**
 * The version of the document shape. In version 1, `hint` was a free aid, and
 * it also covered the outline after five misses. In version 2, `hint` is only a
 * hint that the learner asked for, which caps the question at `lapse`, and
 * `disambiguator` records a free aid on every entry. See issue #396.
 */
export const REVIEW_LOG_VERSION = 2;

/** The memory of a direction before a review, as FSRS read it. */
export interface MemoryBefore {
  stability: number;
  difficulty: number;
  /** Null for a legacy direction, which FSRS reads as reviewed on time. */
  lastReview: Timestamp | null;
  /** The recall probability that FSRS predicted at the time of the review. */
  retrievability: number;
}

export interface ReviewLogEntry extends GradeDetail {
  wordId: number;
  direction: Direction;
  grade: DirectionResult;
  /** Null for a direction that was never passed. */
  before: MemoryBefore | null;
  after: Memory;
  toneErrors: number;
}

export interface ReviewInput {
  wordId: number;
  direction: Direction;
  grade: DirectionResult;
  toneErrors: number;
  detail?: GradeDetail;
  /** The memory that `currentMemory` gave, so a legacy direction has its seeded values. */
  memory: Memory;
  lastReview: Timestamp | null;
  /** The whole days since the last review that FSRS read. */
  elapsed: number;
  /** The memory that the app wrote to the word. */
  next: Memory;
}

/**
 * The entry of one graded question. A detail field that the grade does not
 * hold is left out, because Firestore rejects `undefined`.
 */
export function reviewEntry(input: ReviewInput): ReviewLogEntry {
  const { memory, next } = input;
  const detail = Object.fromEntries(
    Object.entries(input.detail ?? {}).filter(([, value]) => value !== undefined),
  ) as GradeDetail;

  return {
    wordId: input.wordId,
    direction: input.direction,
    grade: input.grade,
    ...detail,
    toneErrors: input.toneErrors,
    before:
      memory.stability > 0
        ? {
            stability: memory.stability,
            difficulty: memory.difficulty,
            lastReview: input.lastReview,
            retrievability: retrievability(memory, input.elapsed),
          }
        : null,
    after: { stability: next.stability, difficulty: next.difficulty, interval: next.interval },
  };
}

/**
 * Write the session's review log, after `finishTest` has saved the
 * reschedules. A session that graded nothing writes no document.
 *
 * It never throws: a failure is reported, and the session stays saved.
 * `finishTest` does not wait for it, so the end of a session has no delay.
 *
 * `now` is the time that FSRS scheduled with, so the elapsed days in the log
 * match the elapsed days that FSRS read.
 */
export async function recordReviewLog(
  userId: string,
  reviews: ReviewLogEntry[],
  now: Date,
): Promise<void> {
  if (reviews.length === 0) return;

  try {
    await setDoc(doc(collection(db, 'users', userId, 'reviewLog')), {
      version: REVIEW_LOG_VERSION,
      date: dayKey(now),
      reviewedAt: Timestamp.fromDate(now),
      scheduler: SCHEDULER_NAME,
      reviews,
    });
  } catch (error) {
    reportError(error, { feature: 'review-log' });
  }
}
