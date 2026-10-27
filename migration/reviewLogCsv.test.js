import { describe, it, expect } from 'vitest';
import { REVIEW_LOG_COLUMNS, reviewLogRows, toCsv } from './reviewLogCsv';

const DAY = 24 * 60 * 60 * 1000;
const REVIEWED_AT = Date.UTC(2026, 9, 27, 9, 0);

/** A Firestore timestamp, as the Admin SDK reads one. */
const at = (ms) => ({ toMillis: () => ms });

/** A typed lapse with every design field. */
const entry = (extra = {}) => ({
  wordId: 101,
  direction: 'PC',
  grade: 'lapse',
  mode: 'input',
  before: {
    stability: 4.2,
    difficulty: 5.5,
    lastReview: at(REVIEWED_AT - 3 * DAY - 60_000),
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
  ...extra,
});

/** A review log document as the export reads it. */
const session = (reviews, id = 'session-1') => ({
  id,
  data: {
    version: 1,
    date: '2026-10-27',
    reviewedAt: at(REVIEWED_AT),
    scheduler: 'fsrs-6-default',
    reviews,
  },
});

describe('reviewLogRows', () => {
  it('joins the word and the direction in the card id', () => {
    const [row] = reviewLogRows([session([entry()])]);

    expect(row.card_id).toBe('101_PC');
  });

  it('gives each grade its FSRS rating: 3 for a pass, 1 for a lapse or a fail', () => {
    const rows = reviewLogRows([
      session([
        entry({ grade: 'pass', position: 0 }),
        entry({ grade: 'lapse', position: 1 }),
        entry({ grade: 'fail', position: 2 }),
      ]),
    ]);

    expect(rows.map((row) => [row.grade, row.review_rating])).toEqual([
      ['pass', 3],
      ['lapse', 1],
      ['fail', 1],
    ]);
  });

  it('flattens an entry into the columns of the optimizer and the design review', () => {
    const [row] = reviewLogRows([session([entry()])]);

    expect(row).toEqual({
      card_id: '101_PC',
      review_time: REVIEWED_AT,
      review_rating: 1,
      grade: 'lapse',
      mode: 'input',
      direction: 'PC',
      retrievability: 0.87,
      elapsed_days: 3,
      stability_before: 4.2,
      difficulty_before: 5.5,
      interval_after: 2,
      scheduler: 'fsrs-6-default',
      session_id: 'session-1',
      position: 0,
      tone_errors: 1,
      misses: 2,
      hint: false,
      revealed: false,
      answer_ms: 8421,
      answer: 'ni3hao4',
    });
  });

  it('leaves the memory before empty for a direction that was never passed', () => {
    const [row] = reviewLogRows([session([entry({ before: null, grade: 'fail' })])]);

    expect(row).toMatchObject({
      retrievability: '',
      elapsed_days: '',
      stability_before: '',
      difficulty_before: '',
      interval_after: 2,
    });
  });

  it('leaves the elapsed days empty for a legacy direction with no last review', () => {
    const [row] = reviewLogRows([
      session([entry({ before: { ...entry().before, lastReview: null } })]),
    ]);

    expect(row.elapsed_days).toBe('');
    expect(row.stability_before).toBe(4.2);
  });

  it('leaves the mode and the design fields empty for an entry saved before the release', () => {
    const [row] = reviewLogRows([
      session([
        {
          wordId: 102,
          direction: 'MC',
          grade: 'pass',
          toneErrors: 0,
          before: null,
          after: { stability: 3.2, difficulty: 5, interval: 3 },
        },
      ]),
    ]);

    expect(row).toMatchObject({
      mode: '',
      position: '',
      misses: '',
      hint: '',
      revealed: '',
      answer_ms: '',
      answer: '',
      tone_errors: 0,
    });
  });

  it('orders the rows by review time, then by position in the session', () => {
    const later = session([entry({ wordId: 3 })], 'later');
    later.data.reviewedAt = at(REVIEWED_AT + DAY);

    const rows = reviewLogRows([
      later,
      session([entry({ wordId: 2, position: 1 }), entry({ wordId: 1, position: 0 })]),
    ]);

    expect(rows.map((row) => row.card_id)).toEqual(['1_PC', '2_PC', '3_PC']);
  });
});

describe('toCsv', () => {
  it('writes a header of the columns and one line per row', () => {
    const csv = toCsv(reviewLogRows([session([entry()])]));
    const [header, line, ...rest] = csv.trimEnd().split('\n');

    expect(header).toBe(REVIEW_LOG_COLUMNS.join(','));
    expect(line.split(',')[0]).toBe('101_PC');
    expect(rest).toEqual([]);
  });

  it('quotes an answer that holds a comma or a quote', () => {
    const csv = toCsv(reviewLogRows([session([entry({ answer: 'hi, "you"' })])]));
    const line = csv.trimEnd().split('\n')[1];

    expect(line.endsWith(',"hi, ""you"""')).toBe(true);
  });

  it('writes a missing field as an empty cell', () => {
    const csv = toCsv(reviewLogRows([session([entry({ answer: undefined, mode: undefined })])]));
    const cells = csv.trimEnd().split('\n')[1].split(',');

    expect(cells[REVIEW_LOG_COLUMNS.indexOf('mode')]).toBe('');
    expect(cells[REVIEW_LOG_COLUMNS.indexOf('answer')]).toBe('');
  });
});
