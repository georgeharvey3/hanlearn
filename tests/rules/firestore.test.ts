import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, increment, Timestamp, type Firestore } from 'firebase/firestore';

import { loadRules, asUser } from './helpers';

/**
 * The Firestore rules, exercised against the emulator.
 *
 * These exist because a field the app writes went missing from the rules for a
 * whole release and nothing caught it: `lapses` arrived with ADR 0010 and was
 * never added to the allowed keys, so every reschedule after a failed retrieval
 * was rejected in production. A rule is only as good as the write it is checked
 * against, so each case here writes the shape the app actually writes.
 */

const DIRECTIONS = ['MC', 'MP', 'PM', 'PC', 'CM'] as const;

let env: RulesTestEnvironment;
let db: Firestore;
let otherDb: Firestore;

const ref = (d: Firestore, p: string) => doc(d, ...(p.split('/') as [string, ...string[]]));

/** A full directions map, as `finishTest` writes one. */
function directionsMap(extra: Record<string, unknown> = {}) {
  return DIRECTIONS.reduce<Record<string, unknown>>((acc, direction) => {
    acc[direction] = {
      bank: 2,
      dueDate: Timestamp.now(),
      stability: 4.2,
      difficulty: 5.5,
      interval: 3,
      lastReview: Timestamp.now(),
      ...extra,
    };
    return acc;
  }, {});
}

beforeAll(async () => {
  env = await loadRules();
  db = asUser(env, 'user-1');
  otherDb = asUser(env, 'user-2');
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('userWords', () => {
  /** A word document in place, written past the rules so a test can update it. */
  async function seedWord() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(ref(ctx.firestore() as unknown as Firestore, 'users/user-1/userWords/1'), {
        wordData: { simp: '好', trad: '好', pinyin: 'hǎo', meaning: 'good' },
        amendedMeaning: null,
        bank: 3,
        dueDate: Timestamp.now(),
        addedAt: Timestamp.now(),
      });
    });
  }

  it('accepts the directions map a reschedule writes', async () => {
    await seedWord();

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: directionsMap(),
        bank: 2,
        dueDate: Timestamp.now(),
      }),
    );
  });

  it('accepts a direction carrying a lapse count', async () => {
    // The regression: ADR 0010 added `lapses` and the rules did not follow, so
    // every reschedule after a failed retrieval was rejected.
    await seedWord();

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: directionsMap({ lapses: 2 }),
        bank: 2,
        dueDate: Timestamp.now(),
      }),
    );
  });

  it('accepts a direction carrying a tone error count', async () => {
    await seedWord();

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: directionsMap({ toneErrors: 4 }),
        bank: 2,
        dueDate: Timestamp.now(),
      }),
    );
  });

  it('rejects a negative lapse count', async () => {
    await seedWord();

    await assertFails(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: directionsMap({ lapses: -1 }),
        bank: 2,
        dueDate: Timestamp.now(),
      }),
    );
  });

  it('rejects a bank outside 1 to 5', async () => {
    await seedWord();

    await assertFails(updateDoc(ref(db, 'users/user-1/userWords/1'), { bank: 6 }));
  });

  it('rejects a field the app does not write', async () => {
    await seedWord();

    await assertFails(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: directionsMap({ streak: 3 }),
      }),
    );
  });

  it('rejects a partial directions map', async () => {
    await seedWord();
    const partial = directionsMap();
    delete partial.CM;

    await assertFails(updateDoc(ref(db, 'users/user-1/userWords/1'), { directions: partial }));
  });

  it("keeps one user out of another user's words", async () => {
    await seedWord();

    await assertFails(updateDoc(ref(otherDb, 'users/user-1/userWords/1'), { bank: 1 }));
  });
});

describe('reviewStats', () => {
  const path = 'users/user-1/reviewStats/2026-09-02';
  const base = () => ({ date: '2026-09-02', updatedAt: Timestamp.now() });

  it('accepts the rollup a session writes', async () => {
    await assertSucceeds(
      setDoc(
        ref(db, path),
        {
          ...base(),
          directions: {
            MC: {
              attempts: increment(3),
              reviews: increment(3),
              reviewPasses: increment(2),
              promoted: increment(1),
              held: increment(2),
            },
            CM: { attempts: increment(1), demoted: increment(1) },
          },
        },
        { merge: true },
      ),
    );
  });

  it('lets a second session of the day merge into the same document', async () => {
    const write = () =>
      setDoc(
        ref(db, path),
        { ...base(), directions: { MC: { attempts: increment(1) } } },
        { merge: true },
      );

    await assertSucceeds(write());
    await assertSucceeds(write());
  });

  it('rejects a document id that disagrees with its date', async () => {
    await assertFails(
      setDoc(
        ref(db, 'users/user-1/reviewStats/2026-09-03'),
        { ...base(), directions: {} },
        { merge: true },
      ),
    );
  });

  it('rejects a direction that is not one of the five', async () => {
    await assertFails(
      setDoc(
        ref(db, path),
        { ...base(), directions: { XX: { attempts: increment(1) } } },
        { merge: true },
      ),
    );
  });

  it('rejects a counter the metrics do not read', async () => {
    await assertFails(
      setDoc(
        ref(db, path),
        { ...base(), directions: { MC: { guesses: increment(1) } } },
        { merge: true },
      ),
    );
  });

  it('rejects a negative counter', async () => {
    await assertFails(
      setDoc(
        ref(db, path),
        { ...base(), directions: { MC: { attempts: -1 } } },
        { merge: true },
      ),
    );
  });

  it('rejects an extra top-level field', async () => {
    await assertFails(
      setDoc(ref(db, path), { ...base(), directions: {}, notes: 'x' }, { merge: true }),
    );
  });

  it("keeps one user out of another user's rollups", async () => {
    await assertFails(
      setDoc(ref(otherDb, path), { ...base(), directions: {} }, { merge: true }),
    );
  });
});

describe('testCompletions', () => {
  it('accepts the streak document a finished session writes', async () => {
    await assertSucceeds(
      setDoc(
        ref(db, 'users/user-1/testCompletions/2026-09-02'),
        { testsCount: increment(1), completedAt: Timestamp.now() },
        { merge: true },
      ),
    );
  });

  it("keeps one user out of another user's streak", async () => {
    await assertFails(
      setDoc(
        ref(otherDb, 'users/user-1/testCompletions/2026-09-02'),
        { testsCount: 1, completedAt: Timestamp.now() },
        { merge: true },
      ),
    );
  });
});
