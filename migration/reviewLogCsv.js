/**
 * Flatten the review log of one learner into CSV rows, one row per review.
 *
 * Pure: export-review-log.js reads the documents with the Admin SDK and writes
 * the file. The first three columns are the format of the FSRS optimizer, and
 * each direction of a word is one card. The other columns serve the
 * calibration and the review of the study design. See issue #397.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The FSRS rating of each grade: Good for a pass, Again for a lapse or a fail.
 * It must agree with `RATINGS` in web-client/src/utils/scheduling.ts, and
 * `elapsed_days` below with `elapsedDays` there. This script is plain Node,
 * so it cannot import the TypeScript module.
 */
const RATINGS = { pass: 3, lapse: 1, fail: 1 };

const REVIEW_LOG_COLUMNS = [
  'card_id',
  'review_time',
  'review_rating',
  'grade',
  'mode',
  'direction',
  'retrievability',
  'elapsed_days',
  'stability_before',
  'difficulty_before',
  'interval_after',
  'scheduler',
  'log_version',
  'session_id',
  'position',
  'tone_errors',
  'misses',
  'hint',
  'disambiguator',
  'revealed',
  'answer_ms',
  'answer',
];

/** A field the entry does not hold is an empty cell. */
const cell = (value) => (value === undefined || value === null ? '' : value);

/**
 * The rows of the review log documents, oldest first, and in the order of the
 * questions within a session.
 *
 * `docs` holds `{ id, data }`, and each timestamp has `toMillis()`, as the
 * Admin SDK reads one. `elapsed_days` counts whole days from the last review,
 * as FSRS does. It is empty for a direction that was never passed, and for a
 * legacy direction, which has no last review.
 */
function reviewLogRows(docs) {
  const rows = [];
  for (const { id, data } of docs) {
    const reviewTime = data.reviewedAt.toMillis();
    for (const entry of data.reviews ?? []) {
      const before = entry.before ?? null;
      const lastReview = before?.lastReview ?? null;
      rows.push({
        card_id: `${entry.wordId}_${entry.direction}`,
        review_time: reviewTime,
        review_rating: RATINGS[entry.grade],
        grade: entry.grade,
        mode: cell(entry.mode),
        direction: entry.direction,
        retrievability: cell(before?.retrievability),
        elapsed_days:
          lastReview === null
            ? ''
            : Math.max(0, Math.floor((reviewTime - lastReview.toMillis()) / MS_PER_DAY)),
        stability_before: cell(before?.stability),
        difficulty_before: cell(before?.difficulty),
        interval_after: cell(entry.after?.interval),
        scheduler: data.scheduler,
        // In version 1, `hint` was a free aid. In version 2, it caps the grade.
        log_version: data.version,
        session_id: id,
        position: cell(entry.position),
        tone_errors: cell(entry.toneErrors),
        misses: cell(entry.misses),
        hint: cell(entry.hint),
        disambiguator: cell(entry.disambiguator),
        revealed: cell(entry.revealed),
        answer_ms: cell(entry.answerMs),
        answer: cell(entry.answer),
      });
    }
  }
  // An entry with no position sorts after the ones that have it.
  const order = (row) => (row.position === '' ? Infinity : row.position);
  return rows.sort((a, b) => a.review_time - b.review_time || order(a) - order(b));
}

/** Quote a cell that holds a comma, a quote or a line break. */
function escape(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The CSV text of the rows, with a header line. */
function toCsv(rows) {
  const lines = [REVIEW_LOG_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(REVIEW_LOG_COLUMNS.map((column) => escape(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

module.exports = { REVIEW_LOG_COLUMNS, reviewLogRows, toCsv };
