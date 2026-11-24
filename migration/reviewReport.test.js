import { describe, it, expect } from 'vitest';
import { toCsv } from './reviewLogCsv';
import { reviewReport, toMarkdown } from './reviewReport';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 1, 9, 0);

/** One CSV row of the export of #397, with every design field. */
const review = (extra = {}) => ({
  card_id: '101_PC',
  review_time: START,
  review_rating: 3,
  grade: 'pass',
  mode: 'input',
  direction: 'PC',
  retrievability: 0.9,
  elapsed_days: 3,
  stability_before: 4,
  difficulty_before: 5,
  interval_after: 9,
  scheduler: 'fsrs-6-default',
  log_version: 2,
  session_id: 'session-1',
  position: 0,
  tone_errors: 0,
  misses: 0,
  hint: false,
  disambiguator: false,
  overridden: '',
  revealed: false,
  answer_ms: 5000,
  answer: '',
  ...extra,
});

/** `count` copies of a review, each at its own position. */
const many = (count, extra = {}) =>
  Array.from({ length: count }, (_, i) => review({ position: i, ...extra }));

/** The report of rows, through the CSV text that the export writes. */
const report = (rows, options = {}) => reviewReport(toCsv(rows), options);

describe('reviewReport header', () => {
  it('states the date range, the scheduler and the total reviews', () => {
    const result = report([
      review({ review_time: START }),
      review({ review_time: START + 2 * DAY, position: 1 }),
    ]);

    expect(result.header).toEqual({
      since: '2026-10-01',
      until: '2026-10-03',
      scheduler: 'fsrs-6-default',
      schedulerFromNewest: true,
      reviews: 2,
    });
  });

  it('keeps only the rows from --since to --until, both days included', () => {
    const result = report(
      [
        review({ review_time: START }),
        review({ review_time: START + DAY }),
        review({ review_time: START + 2 * DAY }),
        review({ review_time: START + 3 * DAY }),
      ],
      { since: '2026-10-02', until: '2026-10-03' },
    );

    expect(result.header.reviews).toBe(2);
    expect(result.header.since).toBe('2026-10-02');
    expect(result.header.until).toBe('2026-10-03');
  });

  it('uses the scheduler of the newest row when no --scheduler is given', () => {
    const result = report([
      review({ scheduler: 'fsrs-6-default', review_time: START }),
      review({ scheduler: 'fsrs-6-personal', review_time: START + DAY }),
    ]);

    expect(result.header.scheduler).toBe('fsrs-6-personal');
    expect(result.header.reviews).toBe(1);
  });

  it('keeps only the rows of the --scheduler', () => {
    const result = report(
      [
        review({ scheduler: 'fsrs-6-default', review_time: START }),
        review({ scheduler: 'fsrs-6-personal', review_time: START + DAY }),
      ],
      { scheduler: 'fsrs-6-default' },
    );

    expect(result.header.scheduler).toBe('fsrs-6-default');
    expect(result.header.schedulerFromNewest).toBe(false);
    expect(result.header.reviews).toBe(1);
  });

  it('reads a quoted answer that holds a comma', () => {
    const result = report([
      review({ grade: 'lapse', answer: 'a, "b"' }),
      review({ grade: 'lapse', answer: 'a, "b"', position: 1 }),
    ]);

    expect(result.repeatedErrors[0].answer).toBe('a, "b"');
  });
});

describe('reviewReport calibration', () => {
  it('bins the predicted recall in tenths and leaves out a first review', () => {
    const result = report([
      review({ retrievability: 0.92, grade: 'pass', position: 0 }),
      review({ retrievability: 0.96, grade: 'lapse', position: 1 }),
      review({ retrievability: 0.35, grade: 'fail', position: 2 }),
      review({ retrievability: '', grade: 'pass', position: 3 }),
    ]);
    const { all } = result.calibration;

    expect(all.reviews).toBe(3);
    expect(all.bins).toHaveLength(10);
    expect(all.bins[9]).toMatchObject({ reviews: 2, passRate: 0.5 });
    expect(all.bins[9].meanPrediction).toBeCloseTo(0.94, 6);
    expect(all.bins[3]).toMatchObject({
      reviews: 1,
      meanPrediction: 0.35,
      passRate: 0,
    });
    expect(all.bins[0].reviews).toBe(0);
  });

  it('gives the log loss and the RMSE of the bins', () => {
    const result = report([
      review({ retrievability: 0.8, grade: 'pass', position: 0 }),
      review({ retrievability: 0.8, grade: 'fail', position: 1 }),
    ]);
    const { all } = result.calibration;

    // Log loss: -(ln 0.8 + ln 0.2) / 2. RMSE: one bin, |0.5 - 0.8|.
    expect(all.logLoss).toBeCloseTo(0.9163, 4);
    expect(all.rmse).toBeCloseTo(0.3, 6);
  });

  it('gives one table for each direction', () => {
    const result = report([
      review({ direction: 'PC', card_id: '101_PC', retrievability: 0.9 }),
      review({
        direction: 'CM',
        card_id: '101_CM',
        retrievability: 0.9,
        position: 1,
      }),
    ]);

    expect(result.calibration.byDirection.map((table) => [table.direction, table.reviews])).toEqual(
      [
        ['PC', 1],
        ['CM', 1],
      ],
    );
  });
});

describe('reviewReport directions', () => {
  it('gives the rates of each direction', () => {
    const rows = [
      ...many(10, { grade: 'pass' }),
      ...many(5, { grade: 'lapse', misses: 2, hint: true }),
      ...many(5, { grade: 'fail', revealed: true }),
    ];
    const [row] = report(rows).directions;

    expect(row).toMatchObject({
      direction: 'PC',
      reviews: 20,
      passRate: 0.5,
      lapseRate: 0.25,
      failRate: 0.25,
      revealRate: 0.25,
      hintRate: 0.25,
      meanMisses: 0.5,
      tooFew: false,
    });
  });

  it('marks a group of fewer than 20 reviews as too few', () => {
    const [row] = report(many(19)).directions;

    expect(row.tooFew).toBe(true);
  });

  it('leaves out an answer time of more than 120 seconds from the median', () => {
    const [row] = report([
      review({ answer_ms: 1000, position: 0 }),
      review({ answer_ms: 3000, position: 1 }),
      review({ answer_ms: 5000, position: 2 }),
      review({ answer_ms: 120_001, position: 3 }),
      review({ answer_ms: 900_000, position: 4 }),
    ]).directions;

    expect(row.medianAnswerMs).toBe(3000);
    expect(row.answerMsLeftOut).toBe(2);
  });

  it('gives one row for each pair of direction and answer mode', () => {
    const result = report([
      review({ mode: 'input', position: 0 }),
      review({ mode: 'flashcard', grade: 'fail', position: 1 }),
      review({ mode: 'flashcard', position: 2 }),
    ]);

    expect(result.modes.map((row) => [row.direction, row.mode, row.reviews, row.passRate])).toEqual(
      [
        ['PC', 'input', 1, 1],
        ['PC', 'flashcard', 2, 0.5],
      ],
    );
  });
});

describe('reviewReport hints', () => {
  it('gives the pass rate with and without a hint for a pinyin answer', () => {
    const result = report([
      review({
        direction: 'PM',
        log_version: 1,
        hint: true,
        grade: 'pass',
        position: 0,
      }),
      review({
        direction: 'PM',
        log_version: 1,
        hint: true,
        grade: 'lapse',
        position: 1,
      }),
      review({
        direction: 'PM',
        log_version: 1,
        hint: false,
        grade: 'pass',
        position: 2,
      }),
    ]);
    const [row] = result.hints.pinyinAndMeaning;

    expect(row).toMatchObject({
      direction: 'PM',
      answer: 'pinyin',
      logVersion: 1,
      hinted: 2,
    });
    expect(row.withHint).toMatchObject({ reviews: 2, passRate: 0.5 });
    expect(row.withoutHint).toMatchObject({ reviews: 1, passRate: 1 });
  });

  it('splits the hint of a character answer into lapse and fail', () => {
    const result = report([
      review({ direction: 'CM', hint: true, grade: 'lapse', position: 0 }),
      review({ direction: 'CM', hint: true, grade: 'lapse', position: 1 }),
      review({ direction: 'CM', hint: true, grade: 'fail', position: 2 }),
      review({ direction: 'CM', hint: false, grade: 'pass', position: 3 }),
    ]);
    const [row] = result.hints.characters;

    expect(row).toMatchObject({
      direction: 'CM',
      reviews: 4,
      hinted: 3,
      hintRate: 0.75,
      hintedLapses: 2,
      hintedFails: 1,
    });
    expect(result.hints.pinyinAndMeaning).toEqual([]);
  });
});

describe('reviewReport reveals', () => {
  it('gives the reveal rate of each mode and the share of fails from a reveal', () => {
    const result = report([
      review({ mode: 'input', grade: 'fail', revealed: true, position: 0 }),
      review({ mode: 'input', grade: 'pass', position: 1 }),
      review({
        mode: 'flashcard',
        grade: 'fail',
        revealed: false,
        position: 2,
      }),
    ]);

    expect(result.reveals.modes.map((row) => [row.mode, row.revealRate])).toEqual([
      ['input', 0.5],
      ['flashcard', 0],
    ]);
    expect(result.reveals.fails).toEqual({ fails: 2, revealed: 1, share: 0.5 });
  });
});

describe('reviewReport fatigue and siblings', () => {
  it('gives the pass rate of each band of 10 positions', () => {
    const result = report([
      review({ position: 0, grade: 'pass' }),
      review({ position: 9, grade: 'fail' }),
      review({ position: 10, grade: 'fail' }),
    ]);

    expect(result.fatigue.map((band) => [band.band, band.reviews, band.passRate])).toEqual([
      ['1–10', 2, 0.5],
      ['11–20', 1, 0],
    ]);
  });

  it('finds an earlier sibling in the same session, and not in another session', () => {
    const result = report([
      review({
        card_id: '7_MC',
        direction: 'MC',
        session_id: 'a',
        position: 0,
      }),
      review({
        card_id: '7_PC',
        direction: 'PC',
        session_id: 'a',
        position: 1,
        grade: 'pass',
      }),
      review({
        card_id: '7_PC',
        direction: 'PC',
        session_id: 'b',
        position: 0,
        grade: 'fail',
      }),
      review({
        card_id: '8_MC',
        direction: 'MC',
        session_id: 'b',
        position: 1,
      }),
    ]);
    const pc = result.siblings.find((row) => row.direction === 'PC');

    expect(pc.withSibling).toMatchObject({ reviews: 1, passRate: 1 });
    expect(pc.withoutSibling).toMatchObject({ reviews: 1, passRate: 0 });
  });
});

describe('reviewReport errors and words', () => {
  const words = new Map([['101', { simp: '你好', pinyin: 'ni3 hao3' }]]);

  it('counts a repeated error with its word, and leaves out a single error', () => {
    const result = report(
      [
        review({ grade: 'lapse', answer: 'ni3hao4', position: 0 }),
        review({ grade: 'lapse', answer: 'ni3hao4', position: 1 }),
        review({ grade: 'lapse', answer: 'ni2hao3', position: 2 }),
      ],
      { words },
    );

    expect(result.repeatedErrors).toEqual([
      {
        word: '你好 ni3 hao3',
        answer: 'ni3hao4',
        directions: ['PC'],
        count: 2,
      },
    ]);
  });

  it('shows the id of a word with no dictionary entry', () => {
    const result = report([
      review({
        card_id: '-1700000000000_PC',
        grade: 'lapse',
        answer: 'x',
        position: 0,
      }),
      review({
        card_id: '-1700000000000_PC',
        grade: 'lapse',
        answer: 'x',
        position: 1,
      }),
    ]);

    expect(result.repeatedErrors[0].word).toBe('-1700000000000');
  });

  it('lists the words with the most misses and the most tone errors', () => {
    const result = report(
      [
        review({
          card_id: '101_PC',
          misses: 3,
          tone_errors: 0,
          grade: 'lapse',
          position: 0,
        }),
        review({
          card_id: '101_MC',
          direction: 'MC',
          misses: 1,
          tone_errors: 0,
          position: 1,
        }),
        review({ card_id: '202_PC', misses: 0, tone_errors: 2, position: 2 }),
      ],
      { words },
    );

    expect(result.hardWords.misses).toEqual([
      { word: '你好 ni3 hao3', count: 4, reviews: 2, passRate: 0.5 },
    ]);
    expect(result.hardWords.toneErrors).toEqual([
      { word: '202', count: 2, reviews: 1, passRate: 1 },
    ]);
  });
});

describe('reviewReport leeches', () => {
  it('counts a leech at 8 failed retrievals, and no leech at 7', () => {
    const result = report([
      ...many(8, { card_id: '1_PC', grade: 'lapse', mode: 'input' }),
      ...many(7, { card_id: '2_PC', grade: 'fail', mode: 'input' }),
      ...many(3, { card_id: '2_PC', grade: 'pass', mode: 'input' }),
    ]);

    expect(result.leeches).toEqual([{ direction: 'PC', mode: 'input', leeches: 1, words: ['1'] }]);
  });

  it('does not count a failed retrieval of a direction that was never passed', () => {
    const result = report([
      ...many(7, { card_id: '1_PC', grade: 'lapse' }),
      review({ card_id: '1_PC', grade: 'fail', retrievability: '', position: 7 }),
    ]);

    expect(result.leeches).toEqual([]);
  });
});

describe('toMarkdown', () => {
  it('writes the eight sections, with a small group in italics and marked too few', () => {
    const markdown = toMarkdown(
      report([...many(20, { direction: 'PC' }), review({ card_id: '9_CM', direction: 'CM' })]),
    );

    expect(markdown).toContain('Reviews: 21');
    for (const heading of [
      'Calibration',
      'Directions',
      'Answer modes',
      'Hints',
      'Reveals',
      'Fatigue and sibling directions',
      'Repeated errors',
      'Leeches',
    ]) {
      expect(markdown).toMatch(new RegExp(`^## \\d\\. ${heading}$`, 'm'));
    }
    expect(markdown).toMatch(/^\| PC \| 20 \| 100% \|/m);
    expect(markdown).toMatch(/^\| CM \| _1 \(too few\)_ \| _100%_ \|/m);
  });
});

describe('reviewReport legacy rows', () => {
  it('leaves the design sections empty for rows saved before #397', () => {
    const legacy = (extra) =>
      review({
        mode: '',
        position: '',
        misses: '',
        hint: '',
        revealed: '',
        answer_ms: '',
        disambiguator: '',
        log_version: 1,
        ...extra,
      });
    const result = report([legacy({}), legacy({ grade: 'fail' })]);

    expect(result.header.reviews).toBe(2);
    expect(result.directions[0]).toMatchObject({
      reviews: 2,
      passRate: 0.5,
      medianAnswerMs: null,
    });
    expect(result.hints).toEqual({ pinyinAndMeaning: [], characters: [] });
    expect(result.fatigue).toEqual([]);
    expect(result.siblings).toEqual([]);
    expect(result.hardWords.misses).toEqual([]);
  });

  it('gives the reveal and hint rates of only the rows that hold the field', () => {
    const [row] = report([
      review({ revealed: true, hint: true, grade: 'fail', position: 0 }),
      review({ revealed: false, hint: false, position: 1 }),
      review({ revealed: '', hint: '', log_version: 1, position: 2 }),
      review({ revealed: '', hint: '', log_version: 1, position: 3 }),
    ]).directions;

    expect(row.revealRate).toBe(0.5);
    expect(row.hintRate).toBe(0.5);
  });

  it('gives an empty report for an empty file', () => {
    expect(reviewReport('').header.reviews).toBe(0);
  });
});
