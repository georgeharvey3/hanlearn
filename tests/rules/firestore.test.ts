import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
  deleteDoc,
  getDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';

import { loadRules, asUser } from './helpers';
import { QUESTIONS_PER_SESSION_MAX } from '../../web-client/src/utils/sessionSettings';

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
  async function seedWord(membership: Record<string, unknown> = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(ref(ctx.firestore() as unknown as Firestore, 'users/user-1/userWords/1'), {
        wordData: { simp: '好', trad: '好', pinyin: 'hǎo', meaning: 'good' },
        amendedMeaning: null,
        bank: 3,
        dueDate: Timestamp.now(),
        addedAt: Timestamp.now(),
        ...membership,
      });
    });
  }

  /** A new word, as `addWordToList` creates one. */
  function newWord(listIds: unknown) {
    const dueDate = Timestamp.now();
    return {
      wordId: '1',
      wordData: { simp: '好', trad: '好', pinyin: 'hǎo', meaning: 'good' },
      amendedMeaning: null,
      bank: 1,
      dueDate,
      directions: DIRECTIONS.reduce<Record<string, unknown>>((acc, direction) => {
        acc[direction] = { bank: 1, dueDate };
        return acc;
      }, {}),
      addedAt: Timestamp.now(),
      listIds,
    };
  }

  it('accepts a new word in a list', async () => {
    await assertSucceeds(setDoc(ref(db, 'users/user-1/userWords/1'), newWord(['hsk1'])));
  });

  it('rejects a new word in no list', async () => {
    await assertFails(setDoc(ref(db, 'users/user-1/userWords/1'), newWord([])));
  });

  it('rejects a new word whose lists are not a list', async () => {
    await assertFails(setDoc(ref(db, 'users/user-1/userWords/1'), newWord('hsk1')));
  });

  it('accepts a word put into a second list', async () => {
    await seedWord({ listIds: ['default'] });

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), { listIds: arrayUnion('hsk1') }),
    );
  });

  it('accepts a word taken out of one of its two lists', async () => {
    await seedWord({ listIds: ['default', 'hsk1'] });

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), { listIds: arrayRemove('hsk1') }),
    );
  });

  it('accepts the lists a word is given', async () => {
    await seedWord({ listIds: ['default'] });

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), { listIds: ['hsk1', 'default'] }),
    );
  });

  it('accepts the backfill from listId to listIds', async () => {
    await seedWord({ listId: 'hsk1' });

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        listIds: ['hsk1'],
        listId: deleteField(),
      }),
    );
  });

  it('rejects a word taken out of its last list', async () => {
    await seedWord({ listIds: ['hsk1'] });

    await assertFails(
      updateDoc(ref(db, 'users/user-1/userWords/1'), { listIds: arrayRemove('hsk1') }),
    );
  });

  it('rejects lists that are not a list', async () => {
    await seedWord({ listIds: ['default'] });

    await assertFails(updateDoc(ref(db, 'users/user-1/userWords/1'), { listIds: 'hsk1' }));
  });

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

  it('accepts a buried sibling that moved only its due date', async () => {
    // ADR 0016: a pass moves the due date of the directions the session did not
    // ask, and leaves the rest of each record as it was. A sibling that no
    // session has asked since the release holds only a bank and a due date.
    await seedWord();
    const buried = { bank: 1, dueDate: Timestamp.fromDate(new Date(Date.now() + 3 * 864e5)) };

    await assertSucceeds(
      updateDoc(ref(db, 'users/user-1/userWords/1'), {
        directions: { ...directionsMap(), MP: buried, PM: buried, PC: buried, CM: buried },
        bank: 1,
        dueDate: buried.dueDate,
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

  it('accepts the level snapshot the end of a session writes', async () => {
    const write = () =>
      setDoc(
        ref(db, path),
        { ...base(), levels: { 1: 12, 2: 30, 3: 18, 4: 6, 5: 2 } },
        { merge: true },
      );

    await assertSucceeds(write());
    // A second session of the day replaces the snapshot.
    await assertSucceeds(write());
  });

  it('rejects a level that is not one of the five', async () => {
    await assertFails(setDoc(ref(db, path), { ...base(), levels: { 6: 1 } }, { merge: true }));
  });

  it('rejects a negative or fractional level count', async () => {
    await assertFails(setDoc(ref(db, path), { ...base(), levels: { 1: -1 } }, { merge: true }));
    await assertFails(setDoc(ref(db, path), { ...base(), levels: { 1: 1.5 } }, { merge: true }));
  });

  it("keeps one user out of another user's rollups", async () => {
    await assertFails(
      setDoc(ref(otherDb, path), { ...base(), directions: {} }, { merge: true }),
    );
  });
});

describe('reviewLog', () => {
  const path = 'users/user-1/reviewLog/session-1';

  /** One entry, as `finishTest` writes it for a typed question with every design field. */
  const entry = (extra: Record<string, unknown> = {}) => ({
    wordId: 101,
    direction: 'PC',
    grade: 'lapse',
    mode: 'input',
    before: {
      stability: 4.2,
      difficulty: 5.5,
      lastReview: Timestamp.now(),
      retrievability: 0.87,
    },
    after: { stability: 2.1, difficulty: 6.3, interval: 2 },
    position: 0,
    toneErrors: 1,
    misses: 2,
    hint: false,
    revealed: false,
    answerMs: 8421,
    answer: 'ni3hao4',
    alternatives: ['ni3 hao5'],
    disambiguator: true,
    ...extra,
  });

  /** An entry of a session saved before the review log: no mode, no design fields. */
  const legacyEntry = () => ({
    wordId: 102,
    direction: 'MC',
    grade: 'pass',
    before: {
      stability: 3,
      difficulty: 3.6,
      lastReview: null,
      retrievability: 0.9,
    },
    after: { stability: 9.4, difficulty: 3.5, interval: 9 },
  });

  const session = (reviews: unknown[], extra: Record<string, unknown> = {}) => ({
    version: 2,
    date: '2026-10-27',
    reviewedAt: Timestamp.now(),
    scheduler: 'fsrs-6-default',
    reviews,
    ...extra,
  });

  it('accepts the document a session writes', async () => {
    await assertSucceeds(setDoc(ref(db, path), session([entry()])));
  });

  // Version 2 records an asked-for hint and the disambiguator apart (#396).
  it('accepts a version 2 entry with a hint and a disambiguator', async () => {
    await assertSucceeds(
      setDoc(ref(db, path), session([entry({ hint: true, disambiguator: true })])),
    );
  });

  // A cached bundle writes version 1 until the version check reloads it.
  it('accepts a version 1 document', async () => {
    await assertSucceeds(setDoc(ref(db, path), session([entry()], { version: 1 })));
  });

  it('accepts a direction that was never passed', async () => {
    await assertSucceeds(
      setDoc(ref(db, path), session([entry({ before: null, grade: 'fail', revealed: true })])),
    );
  });

  it('accepts the entries of a session saved before the release', async () => {
    await assertSucceeds(setDoc(ref(db, path), session([legacyEntry()])));
  });

  it('accepts a flashcard and a handwriting entry, with no misses, answer or alternatives', async () => {
    const {
      misses: _m,
      answer: _a,
      alternatives: _c,
      ...flashcard
    } = entry({ mode: 'flashcard', disambiguator: false });
    const { answer: _b, alternatives: _d, ...handwriting } = entry({
      mode: 'handwriting',
      direction: 'CM',
    });
    await assertSucceeds(setDoc(ref(db, path), session([flashcard, handwriting])));
  });

  it('accepts a session of the longest length the settings allow', async () => {
    const reviews = Array.from({ length: QUESTIONS_PER_SESSION_MAX }, (_, position) =>
      entry({ wordId: position, position }),
    );
    await assertSucceeds(setDoc(ref(db, path), session(reviews)));
  });

  it('rejects a session with no entries', async () => {
    await assertFails(setDoc(ref(db, path), session([])));
  });

  it('rejects an extra top-level field', async () => {
    await assertFails(setDoc(ref(db, path), session([entry()], { notes: 'x' })));
  });

  it('rejects a wrong type at the top level', async () => {
    await assertFails(setDoc(ref(db, path), session([entry()], { version: 3 })));
    await assertFails(setDoc(ref(db, path), session([entry()], { date: 20261027 })));
    await assertFails(setDoc(ref(db, path), session([entry()], { reviewedAt: '2026-10-27' })));
    await assertFails(setDoc(ref(db, path), session([entry()], { scheduler: 6 })));
    await assertFails(setDoc(ref(db, path), session([entry()], { reviews: entry() })));
  });

  it('is write-once: no update and no delete', async () => {
    await assertSucceeds(setDoc(ref(db, path), session([entry()])));

    await assertFails(updateDoc(ref(db, path), { scheduler: 'fsrs-6-personal' }));
    await assertFails(setDoc(ref(db, path), session([entry({ grade: 'pass' })])));
    await assertFails(deleteDoc(ref(db, path)));
  });

  it('lets the owner read the log', async () => {
    await assertSucceeds(setDoc(ref(db, path), session([entry()])));
    await assertSucceeds(getDoc(ref(db, path)));
  });

  it("keeps one user out of another user's log", async () => {
    await assertFails(setDoc(ref(otherDb, path), session([entry()])));
    await assertSucceeds(setDoc(ref(db, path), session([entry()])));
    await assertFails(getDoc(ref(otherDb, path)));
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
