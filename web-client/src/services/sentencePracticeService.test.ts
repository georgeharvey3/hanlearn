import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setDocSpy, getDocsSpy, reportErrorSpy } = vi.hoisted(() => ({
  setDocSpy: vi.fn(),
  getDocsSpy: vi.fn(),
  reportErrorSpy: vi.fn(),
}));

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  perf: null,
  analytics: null,
}));

vi.mock('./errorReporting', () => ({ reportError: reportErrorSpy }));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('firebase/firestore');
  return {
    ...actual,
    // A doc of a collection with no id is a new document with an automatic id.
    doc: vi.fn((parent: { path?: string }, ...path: string[]) =>
      path.length === 0 ? { path: `${parent.path}/auto` } : { path: path.join('/') },
    ),
    collection: vi.fn((_db, ...path: string[]) => ({ path: path.join('/') })),
    getDocs: getDocsSpy,
    setDoc: setDocSpy,
    Timestamp: {
      fromDate: (d: Date) => ({ toDate: () => d, __ts: d.toISOString() }),
    },
  };
});

import { loadPractice, saveGrade, SentenceGrade } from './sentencePracticeService';

const NOW = new Date(2026, 10, 4, 10, 0);

const grade = (over: Partial<SentenceGrade> = {}): SentenceGrade => ({
  wordId: 42,
  sentenceId: 's1',
  tab: 'comprehend',
  grade: 'wrong',
  mode: 'audio',
  answerMs: 5300,
  revealed: true,
  lookups: 2,
  at: NOW,
  ...over,
});

describe('saveGrade', () => {
  beforeEach(() => {
    setDocSpy.mockReset();
    reportErrorSpy.mockReset();
  });

  it('writes the practice of the word first, then the log entry', async () => {
    setDocSpy.mockResolvedValue(undefined);

    await saveGrade('user-1', grade());

    expect(setDocSpy).toHaveBeenCalledTimes(2);
    const [practiceRef, practice, options] = setDocSpy.mock.calls[0];
    expect(practiceRef.path).toBe('users/user-1/sentencePractice/42');
    expect(options).toEqual({ merge: true });
    expect(practice).toEqual({
      comprehend: {
        lastPractised: expect.objectContaining({ __ts: NOW.toISOString() }),
        lastResult: 'wrong',
        seen: { s1: expect.objectContaining({ __ts: NOW.toISOString() }) },
      },
    });

    const [logRef, log] = setDocSpy.mock.calls[1];
    expect(logRef.path).toBe('users/user-1/sentenceLog/auto');
    expect(log).toEqual({
      version: 2,
      date: '2026-11-04',
      reviewedAt: expect.objectContaining({ __ts: NOW.toISOString() }),
      wordId: 42,
      sentenceId: 's1',
      tab: 'comprehend',
      grade: 'wrong',
      mode: 'audio',
      answerMs: 5300,
      revealed: true,
      lookups: 2,
    });
  });

  it('logs each attempt of a free Compose answer, at version 3', async () => {
    setDocSpy.mockResolvedValue(undefined);
    const attempts = [
      { answer: '我在学中文', answerMs: 8200, lookups: 1 },
      { answer: '我学中文', answerMs: 14100, lookups: 0 },
    ];

    await saveGrade('user-1', {
      wordId: 42,
      sentenceId: 's1',
      tab: 'compose',
      grade: 'wrong',
      mode: 'text',
      gaveUp: false,
      lookups: 1,
      attempts,
      at: NOW,
    });

    expect(setDocSpy.mock.calls[0][1]).toEqual({
      compose: expect.objectContaining({ lastResult: 'wrong' }),
    });
    expect(setDocSpy.mock.calls[1][1]).toEqual({
      version: 3,
      date: '2026-11-04',
      reviewedAt: expect.objectContaining({ __ts: NOW.toISOString() }),
      wordId: 42,
      sentenceId: 's1',
      tab: 'compose',
      grade: 'wrong',
      mode: 'text',
      gaveUp: false,
      lookups: 1,
      attempts,
    });
  });

  it('logs the first 9 attempts and the last one, as the rules allow', async () => {
    setDocSpy.mockResolvedValue(undefined);
    const attempts = Array.from({ length: 12 }, (_, i) => ({
      answer: String(i),
      answerMs: i,
      lookups: 0,
    }));

    await saveGrade('user-1', {
      ...grade({ tab: 'compose' }),
      gaveUp: true,
      attempts,
    });

    expect(setDocSpy.mock.calls[1][1].attempts).toEqual([...attempts.slice(0, 9), attempts[11]]);
  });

  it('logs the input and the tiles shown of a tile answer', async () => {
    setDocSpy.mockResolvedValue(undefined);
    const tiles = ['书', '我', '输', '看', '树', '吃'];
    const attempts = [{ answer: '我看书', answerMs: 4000, lookups: 0 }];

    await saveGrade('user-1', {
      wordId: 42,
      sentenceId: 's1',
      tab: 'compose',
      grade: 'right',
      mode: 'text',
      gaveUp: false,
      lookups: 0,
      attempts,
      input: 'tiles',
      tiles,
      at: NOW,
    });

    expect(setDocSpy.mock.calls[1][1]).toMatchObject({
      version: 3,
      input: 'tiles',
      tiles,
      attempts,
    });
  });

  it('gives a free Compose entry no input and no tiles', async () => {
    setDocSpy.mockResolvedValue(undefined);

    await saveGrade('user-1', {
      ...grade({ tab: 'compose' }),
      gaveUp: false,
      attempts: [{ answer: '我', answerMs: 1, lookups: 0 }],
    });

    expect(setDocSpy.mock.calls[1][1]).not.toHaveProperty('input');
    expect(setDocSpy.mock.calls[1][1]).not.toHaveProperty('tiles');
  });

  it('resolves when the log write fails, and reports the failure', async () => {
    setDocSpy.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));

    await expect(saveGrade('user-1', grade())).resolves.toBeUndefined();
    expect(reportErrorSpy).toHaveBeenCalledWith(expect.any(Error), {
      feature: 'sentence-log',
    });
  });

  it('rejects when the practice write fails', async () => {
    setDocSpy.mockRejectedValueOnce(new Error('denied'));

    await expect(saveGrade('user-1', grade())).rejects.toThrow('denied');
    // No log entry describes a grade that was not saved.
    expect(setDocSpy).toHaveBeenCalledTimes(1);
  });
});

describe('loadPractice', () => {
  it('reads every document with one query, with the dates as ISO strings', async () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    getDocsSpy.mockResolvedValue({
      docs: [
        {
          id: '42',
          data: () => ({
            comprehend: {
              lastPractised: ts('2026-11-01T09:00:00.000Z'),
              lastResult: 'right',
              seen: { s1: ts('2026-11-01T09:00:00.000Z') },
            },
          }),
        },
      ],
    });

    expect(await loadPractice('user-1')).toEqual({
      '42': {
        comprehend: {
          lastPractised: '2026-11-01T09:00:00.000Z',
          lastResult: 'right',
          seen: { s1: '2026-11-01T09:00:00.000Z' },
        },
      },
    });
    expect(getDocsSpy).toHaveBeenCalledTimes(1);
  });
});
