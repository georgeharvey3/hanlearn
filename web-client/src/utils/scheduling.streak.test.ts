/**
 * Guard: the streak never influences the schedule (issue #335).
 *
 * The streak is an engagement feature. It is recorded after a session, from
 * `testCompletions`, and the Dashboard reads it. The scheduler must stay blind
 * to it: an interval that grew because the learner turned up yesterday would
 * no longer be a measurement of memory, and a missed day would then punish the
 * learner twice.
 *
 * Nothing in the code says that today, so this test does: the files that
 * compute a schedule are read here and must not mention the streak at all.
 * A future change that wires one into the other has to delete this test first.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The files that decide a due date, a bank, or the order of a session. */
const SCHEDULING_FILES = [
  'utils/scheduling.ts',
  'utils/directions.ts',
  'services/wordService.ts',
  'components/Test/Logic/TestLogic.ts',
];

// `testCompletions` is the collection the streak is counted from, and
// `streakService` is the only module that reads it.
const STREAK_REFERENCES = /streak|testCompletions/i;

describe('the scheduler is blind to the streak', () => {
  it.each(SCHEDULING_FILES)('%s does not read the streak', (file) => {
    const source = readFileSync(path.join(srcDir, file), 'utf8');

    expect(source).not.toMatch(STREAK_REFERENCES);
  });
});
