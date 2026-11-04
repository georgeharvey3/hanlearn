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
      version: 1,
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

  it('logs the raw answer of a Compose task', async () => {
    setDocSpy.mockResolvedValue(undefined);

    await saveGrade('user-1', grade({ tab: 'compose', answer: '我学中文' }));

    expect(setDocSpy.mock.calls[0][1]).toHaveProperty('compose');
    expect(setDocSpy.mock.calls[1][1]).toMatchObject({ tab: 'compose', answer: '我学中文' });
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
