import { describe, it, expect, beforeEach } from 'vitest';

import {
  SAVED_SESSION_KEY,
  SAVED_SESSION_VERSION,
  SavedSession,
  clearSavedSession,
  describeSavedSession,
  loadResumableSession,
  readSavedSession,
  restoreSession,
  saveSession,
} from './savedSession';
import { Word } from '../types/models';
import { dayKey } from './retention';

const word = (id: number, simp: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'test',
  meaning: 'test meaning',
});

const session = (overrides: Partial<SavedSession> = {}): SavedSession => ({
  version: SAVED_SESSION_VERSION,
  userId: 'user-1',
  listId: 'default',
  date: dayKey(new Date()),
  savedAt: new Date().toISOString(),
  stage: 'vocab',
  practiceMode: false,
  wordIds: [1, 2],
  newWordIds: [1],
  sentenceReadWordIds: [],
  sentenceWriteWordIds: [],
  seenOffsets: {},
  scoreList: [],
  queue: [{ index: '1', aCategory: 'M', qCategory: 'C' }],
  gradeList: [{ wordId: 1, direction: 'MC', result: 'pass', toneErrors: 0 }],
  initialQueueLength: 2,
  ...overrides,
});

beforeEach(() => {
  clearSavedSession();
});

describe('saveSession / readSavedSession', () => {
  it('reads back what it saved', () => {
    const saved = session();
    saveSession(saved);
    expect(readSavedSession()).toEqual(saved);
  });

  it('returns null when nothing is saved', () => {
    expect(readSavedSession()).toBeNull();
  });

  it('returns null for a record it cannot parse', () => {
    localStorage.setItem(SAVED_SESSION_KEY, 'not json');
    expect(readSavedSession()).toBeNull();
  });

  it('returns null for a record written by an older version', () => {
    localStorage.setItem(SAVED_SESSION_KEY, JSON.stringify(session({ version: 0 })));
    expect(readSavedSession()).toBeNull();
  });

  it('returns null for a record missing a field', () => {
    const { queue, ...rest } = session();
    expect(queue).toBeDefined();
    localStorage.setItem(SAVED_SESSION_KEY, JSON.stringify(rest));
    expect(readSavedSession()).toBeNull();
  });
});

describe('loadResumableSession', () => {
  it('offers a session saved today, for this learner and list', () => {
    saveSession(session());
    expect(loadResumableSession('user-1', 'default')).not.toBeNull();
  });

  it('does not offer a session from another day, and deletes it', () => {
    saveSession(session({ date: '2020-01-01' }));
    expect(loadResumableSession('user-1', 'default')).toBeNull();
    expect(localStorage.getItem(SAVED_SESSION_KEY)).toBeNull();
  });

  it('does not offer another learner a session, and deletes it', () => {
    saveSession(session({ userId: 'someone-else' }));
    expect(loadResumableSession('user-1', 'default')).toBeNull();
    expect(localStorage.getItem(SAVED_SESSION_KEY)).toBeNull();
  });

  it('leaves another list its session rather than deleting it', () => {
    saveSession(session({ listId: 'other-list' }));
    expect(loadResumableSession('user-1', 'default')).toBeNull();
    expect(localStorage.getItem(SAVED_SESSION_KEY)).not.toBeNull();
  });

  it('does not offer a vocab stage that has nothing left to ask', () => {
    saveSession(session({ queue: [] }));
    expect(loadResumableSession('user-1', 'default')).toBeNull();
    expect(localStorage.getItem(SAVED_SESSION_KEY)).toBeNull();
  });

  it('offers a sentence stage even though its queue is empty', () => {
    saveSession(session({ stage: 'read', queue: [] }));
    expect(loadResumableSession('user-1', 'default')).not.toBeNull();
  });
});

describe('restoreSession', () => {
  const words = [word(1, '你好'), word(2, '再见'), word(3, '謝謝')];

  it('puts the words back in the order the queue indexes into', () => {
    const restored = restoreSession(session({ wordIds: [2, 1] }), words);
    expect(restored?.words.map((w) => w.id)).toEqual([2, 1]);
    expect(restored?.newWords.map((w) => w.id)).toEqual([1]);
    expect(restored?.progress.initialQueueLength).toBe(2);
  });

  it('takes the word as it is now, not as it was saved', () => {
    const amended = [{ ...words[0], meaning: 'amended since' }, words[1]];
    const restored = restoreSession(session(), amended);
    expect(restored?.words[0].meaning).toBe('amended since');
  });

  it('gives up the session when one of its words has been deleted', () => {
    expect(restoreSession(session({ wordIds: [1, 99] }), words)).toBeNull();
  });

  it('gives up the session when a queue entry points outside the plan', () => {
    const saved = session({ queue: [{ index: '5', aCategory: 'M', qCategory: 'C' }] });
    expect(restoreSession(saved, words)).toBeNull();
  });

  it('gives up an empty session', () => {
    expect(restoreSession(session({ wordIds: [], queue: [] }), words)).toBeNull();
  });
});

describe('describeSavedSession', () => {
  it('counts the questions the vocab stage has left', () => {
    expect(describeSavedSession(session())).toBe('1 question left');
    expect(
      describeSavedSession(
        session({
          queue: [
            { index: '0', aCategory: 'M', qCategory: 'C' },
            { index: '1', aCategory: 'M', qCategory: 'C' },
          ],
        }),
      ),
    ).toBe('2 questions left');
  });

  it('names the other stages', () => {
    expect(describeSavedSession(session({ stage: 'new' }))).toBe('Learning new words');
    expect(describeSavedSession(session({ stage: 'write' }))).toBe('Sentences');
  });
});
