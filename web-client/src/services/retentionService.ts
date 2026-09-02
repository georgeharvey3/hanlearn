import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  where,
  Timestamp,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { DIRECTIONS, Direction } from '../types/models';
import {
  dayKey,
  emptyDayTally,
  tallyOutcomes,
  type DirectionTally,
  type ReviewOutcome,
  type ReviewStatsDay,
} from '../utils/retention';

/**
 * The Firestore side of the scheduler measurement: one rollup document per day
 * per user, at `users/{userId}/reviewStats/{YYYY-MM-DD}`.
 *
 * The scheduling state of a direction is overwritten by each review, so it
 * cannot answer how often the learner recalled the answer, or how often a
 * review moved the direction up a bank. Those are properties of the reviews
 * themselves, and this is where the reviews are counted.
 *
 * The counts are a rollup rather than one document per question: a session adds
 * one write to the batch that `finishTest` already commits, and the whole
 * history of a user reads in a single query bounded by the days they studied.
 * The cost is granularity — these counters answer "how is `CM` doing" and not
 * "which words fail most".
 *
 * The counting rules live in `utils/retention.ts` and are pure. See
 * docs/adr/0013-retention-metrics.md.
 */

/**
 * Add a session's counts to today's rollup, inside the batch that reschedules
 * the words.
 *
 * Every count is an increment, so two sessions on one day add up and the
 * document needs no read before the write. The counters are nested rather than
 * written as dotted field paths, because `set` reads a dotted key as a field
 * name and only `update` reads it as a path; a merged `set` is what creates the
 * document on the first session of the day, and it merges maps depth-first, so
 * a direction this session did not ask keeps the counts it holds.
 *
 * The write is part of the scheduling batch on purpose: a session either
 * records both what it scheduled and what it measured, or neither, and the
 * measurement can never describe reviews that did not happen.
 */
export function addSessionToBatch(
  batch: WriteBatch,
  userId: string,
  outcomes: ReviewOutcome[],
  now: Date,
): void {
  const tally = tallyOutcomes(outcomes);
  if (Object.keys(tally).length === 0) return;

  const date = dayKey(now);
  const directions: Record<string, Record<string, unknown>> = {};

  for (const direction of DIRECTIONS) {
    const entry = tally[direction];
    if (!entry) continue;
    const counters: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(entry)) {
      // A counter this session did not move is left out, so a direction with no
      // demotions never gains the field until it has one.
      if (value === 0) continue;
      counters[field] = increment(value);
    }
    if (Object.keys(counters).length > 0) directions[direction] = counters;
  }

  batch.set(
    doc(db, 'users', userId, 'reviewStats', date),
    { date, updatedAt: Timestamp.fromDate(now), directions },
    { merge: true },
  );
}

/**
 * Read the daily rollups from a date onwards, oldest first.
 *
 * `date` holds the same value as the document id, so the range is a query on
 * one field and needs no composite index. Days the learner did not study are
 * simply absent, and every day that comes back carries all five directions so
 * that no reader has to fill a gap.
 */
export const getReviewStats = async (userId: string, from: string): Promise<ReviewStatsDay[]> => {
  const colRef = collection(db, 'users', userId, 'reviewStats');
  const snapshot = await getDocs(query(colRef, where('date', '>=', from), orderBy('date')));

  return snapshot.docs.map((d) => {
    const stored = (
      d.data() as { directions?: Partial<Record<Direction, Partial<DirectionTally>>> }
    ).directions;
    const directions = emptyDayTally();
    for (const direction of DIRECTIONS) {
      const entry = stored?.[direction];
      if (!entry) continue;
      directions[direction] = { ...directions[direction], ...entry };
    }
    return { date: d.id, directions };
  });
};
