import { describe, it, expect } from 'vitest';

import { Word, WordScore } from '../../../types/models';
import { missedWords, nextDue, summaryRows, tally } from './summary';

const word = (id: number, simp: string, extra: Partial<Word> = {}): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'ni3 hao3',
  meaning: 'hello/hi',
  ...extra,
});

describe('summaryRows', () => {
  it('fills in the pinyin with tone marks and the meaning of each question', () => {
    const scores: WordScore[] = [{ char: '你好', direction: 'MC', result: 'pass' }];
    expect(summaryRows(scores, [word(1, '你好')])).toEqual([
      {
        char: '你好',
        pinyin: 'nǐ hǎo',
        meaning: 'hello; hi',
        direction: 'MC',
        result: 'pass',
        wordId: 1,
      },
    ]);
  });

  it('finds a word asked in traditional characters', () => {
    const scores: WordScore[] = [{ char: '護照', direction: 'MC', result: 'fail' }];
    const rows = summaryRows(scores, [word(2, '护照', { trad: '護照', meaning: 'passport' })]);
    expect(rows[0].meaning).toBe('passport');
    expect(rows[0].wordId).toBe(2);
  });

  it('prefers the meaning the learner amended', () => {
    const scores: WordScore[] = [{ char: '你好', direction: 'MC', result: 'pass' }];
    const rows = summaryRows(scores, [word(1, '你好', { ammended_meaning: 'hey' })]);
    expect(rows[0].meaning).toBe('hey');
  });

  it('puts Not known first, then Nearly, then Known, keeping the order within each', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'pass' },
      { char: '二', direction: 'MC', result: 'lapse' },
      { char: '三', direction: 'MC', result: 'fail' },
      { char: '四', direction: 'MC', result: 'pass' },
      { char: '五', direction: 'MC', result: 'fail' },
    ];
    const words = ['一', '二', '三', '四', '五'].map((c, i) => word(i, c));
    expect(summaryRows(scores, words).map((r) => r.char)).toEqual(['三', '五', '二', '一', '四']);
  });

  it('keeps a question whose word is gone, with no pinyin or meaning', () => {
    const scores: WordScore[] = [{ char: '无', direction: 'MC', result: 'pass' }];
    expect(summaryRows(scores, [])[0]).toMatchObject({ char: '无', pinyin: '', meaning: '' });
  });
});

describe('tally', () => {
  it('counts each result per question, and the distinct words', () => {
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'pass' },
      { char: '一', direction: 'CM', result: 'fail' },
      { char: '二', direction: 'MC', result: 'lapse' },
      { char: '三', direction: 'PM', result: 'pass' },
    ];
    expect(tally(summaryRows(scores, []))).toEqual({
      total: 4,
      words: 3,
      pass: 2,
      lapse: 1,
      fail: 1,
    });
  });
});

describe('missedWords', () => {
  it('gives each word with a Nearly or Not known question once', () => {
    const words = [word(1, '一'), word(2, '二'), word(3, '三')];
    const scores: WordScore[] = [
      { char: '一', direction: 'MC', result: 'fail' },
      { char: '一', direction: 'CM', result: 'lapse' },
      { char: '二', direction: 'MC', result: 'pass' },
      { char: '三', direction: 'MC', result: 'lapse' },
    ];
    expect(missedWords(summaryRows(scores, words), words).map((w) => w.id)).toEqual([1, 3]);
  });
});

describe('nextDue', () => {
  const now = new Date(2026, 9, 23, 10, 0);
  const dueOn = (days: number, hour = 9) =>
    word(days, `字${days}`, {
      due_date: new Date(2026, 9, 23 + days, hour, 0).toISOString(),
    });

  it('gives the count of the first day ahead with words due', () => {
    expect(nextDue([dueOn(3), dueOn(3), dueOn(5)], now)).toEqual({ count: 2, days: 3 });
  });

  it('counts tomorrow as one day ahead', () => {
    expect(nextDue([dueOn(1)], now)).toEqual({ count: 1, days: 1 });
  });

  it('counts a word due later today as zero days ahead', () => {
    expect(nextDue([dueOn(0, 18)], now)).toEqual({ count: 1, days: 0 });
  });

  it('gives null when nothing falls due in the next seven days', () => {
    expect(nextDue([dueOn(8)], now)).toBeNull();
    expect(nextDue([], now)).toBeNull();
  });
});
