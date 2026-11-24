/**
 * The report on the review log: the calibration of FSRS and the review of the
 * study design, built from the CSV file of export-review-log.js.
 *
 * Pure: review-report.js reads the CSV file and the dictionary, and writes the
 * Markdown file. The report makes no decision and changes no data. Each section
 * is a table, and the sections stay the same from one report to the next, so
 * two reports can be compared. See issue #446.
 */

/**
 * A group with fewer reviews than this shows its numbers as "too few". A
 * tunable limit, not a design decision: change it here.
 */
const MIN_SAMPLE = 20;

/**
 * The median answer time leaves out a longer answer, because `answerMs` counts
 * the time in a hidden tab (#397). A tunable limit, like MIN_SAMPLE.
 */
const MAX_ANSWER_MS = 120_000;

/** The number of rows in each top list: repeated errors and hard words. */
const TOP = 20;

/**
 * The failed retrievals that make a direction a leech, as in ADR 0010 and
 * `LEECH_THRESHOLD` in web-client/src/utils/scheduling.ts.
 */
const LEECH_LAPSES = 8;

/** The width of a position band in the fatigue table. */
const POSITION_BAND = 10;

const DIRECTIONS = ['MC', 'MP', 'PM', 'PC', 'CM'];

/**
 * A direction is written answer-first: 'MC' takes the meaning as its answer.
 * See `DIRECTIONS` in web-client/src/types/models.ts.
 */
const ANSWERS = { M: 'meaning', P: 'pinyin', C: 'character' };
const answerOf = (direction) => ANSWERS[direction[0]] ?? 'unknown';

/** Split CSV text into records of cells, with quotes as `toCsv` writes them. */
function parseCsv(text) {
  const records = [];
  let record = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  return records;
}

/** An empty cell is null: a field that the review did not hold. */
const number = (text) => (text === '' || text === undefined ? null : Number(text));
const flag = (text) => (text === '' || text === undefined ? null : text === 'true');

/** The typed rows of the CSV text. */
function readRows(csv) {
  const [header, ...records] = parseCsv(csv);
  return records
    .filter((record) => record.length > 1)
    .map((record) => {
      const cells = Object.fromEntries(header.map((column, i) => [column, record[i] ?? '']));
      const time = Number(cells.review_time);
      return {
        wordId: cells.card_id.slice(0, cells.card_id.lastIndexOf('_')),
        direction: cells.direction,
        grade: cells.grade,
        mode: cells.mode || null,
        time,
        // The UTC day: the export holds no time zone.
        date: new Date(time).toISOString().slice(0, 10),
        retrievability: number(cells.retrievability),
        scheduler: cells.scheduler,
        logVersion: number(cells.log_version),
        session: cells.session_id,
        position: number(cells.position),
        toneErrors: number(cells.tone_errors),
        misses: number(cells.misses),
        hint: flag(cells.hint),
        revealed: flag(cells.revealed),
        answerMs: number(cells.answer_ms),
        answer: cells.answer,
      };
    });
}

/** The rows that the options keep, and the scheduler that the report covers. */
function filterRows(rows, { since, until, scheduler }) {
  const inRange = rows.filter(
    (row) => (!since || row.date >= since) && (!until || row.date <= until),
  );
  const newest = inRange.reduce(
    (latest, row) => (!latest || row.time >= latest.time ? row : latest),
    null,
  );
  const chosen = scheduler ?? newest?.scheduler ?? null;
  return {
    rows: inRange.filter((row) => row.scheduler === chosen),
    scheduler: chosen,
    schedulerFromNewest: !scheduler,
  };
}

/**
 * The report of the CSV text. `words` maps a word id to `{ simp, pinyin }`; a
 * word with no entry shows its id.
 */
function reviewReport(csv, { since, until, scheduler, words = new Map() } = {}) {
  const filtered = filterRows(readRows(csv), { since, until, scheduler });
  const { rows } = filtered;
  const dates = rows.map((row) => row.date).sort();
  const modeGroups = byDirection(rows).flatMap(([direction, group]) =>
    byMode(group).map(([mode, modeGroup]) => ({ direction, mode, rows: modeGroup })),
  );
  const wordOf = (id) => {
    const entry = words.get(id);
    return entry ? `${entry.simp} ${entry.pinyin}` : id;
  };

  return {
    header: {
      since: since ?? dates[0] ?? null,
      until: until ?? dates[dates.length - 1] ?? null,
      scheduler: filtered.scheduler,
      schedulerFromNewest: filtered.schedulerFromNewest,
      reviews: rows.length,
    },
    calibration: {
      all: calibration(rows),
      byDirection: byDirection(rows).map(([direction, group]) => ({
        direction,
        ...calibration(group),
      })),
    },
    directions: byDirection(rows).map(([direction, group]) => ({
      direction,
      ...rates(group),
    })),
    modes: modeGroups.map(({ direction, mode, rows: group }) => ({
      direction,
      mode,
      ...rates(group),
    })),
    hints: hints(rows),
    reveals: {
      modes: modeGroups.map(({ direction, mode, rows: group }) => ({
        direction,
        mode,
        ...passRate(group),
        revealRate: flagRate(group, 'revealed'),
      })),
      fails: revealedFails(rows),
    },
    fatigue: fatigue(rows),
    siblings: siblings(rows),
    repeatedErrors: repeatedErrors(rows, wordOf),
    hardWords: {
      misses: hardWords(rows, wordOf, (row) => row.misses),
      toneErrors: hardWords(rows, wordOf, (row) => row.toneErrors),
    },
    leeches: leeches(rows, wordOf),
  };
}

/**
 * The hints of each direction and log version. In version 1, a hint was a free
 * aid, and on a character answer it also covered the outline after five
 * misses. From version 2 (#396), every hint caps the grade at `lapse`, so a
 * pass after a hint cannot occur. A row with no `hint` predates #397.
 */
function hints(rows) {
  const pinyinAndMeaning = [];
  const characters = [];
  for (const [direction, group] of byDirection(rows)) {
    const versions = [
      ...new Set(group.filter((row) => row.hint !== null).map((row) => row.logVersion)),
    ];
    for (const logVersion of versions.sort((a, b) => a - b)) {
      const known = group.filter((row) => row.hint !== null && row.logVersion === logVersion);
      const hinted = known.filter((row) => row.hint);
      const row = {
        direction,
        answer: answerOf(direction),
        logVersion,
        reviews: known.length,
        tooFew: known.length < MIN_SAMPLE,
        hinted: hinted.length,
        hintRate: share(known, (entry) => entry.hint),
        withHint: passRate(hinted),
        withoutHint: passRate(known.filter((entry) => !entry.hint)),
        hintedLapses: hinted.filter((entry) => entry.grade === 'lapse').length,
        hintedFails: hinted.filter((entry) => entry.grade === 'fail').length,
      };
      (row.answer === 'character' ? characters : pinyinAndMeaning).push(row);
    }
  }
  return { pinyinAndMeaning, characters };
}

/** How many `fail` grades came from a reveal. */
function revealedFails(rows) {
  const fails = rows.filter((row) => row.grade === 'fail');
  const revealed = fails.filter((row) => row.revealed).length;
  return {
    fails: fails.length,
    revealed,
    share: fails.length === 0 ? null : revealed / fails.length,
  };
}

/** The pass rate of each band of positions in the session, numbered from 1. */
function fatigue(rows) {
  const placed = rows.filter((row) => row.position !== null);
  if (placed.length === 0) return [];
  const last = Math.max(...placed.map((row) => Math.floor(row.position / POSITION_BAND)));
  return Array.from({ length: last + 1 }, (_, band) => ({
    band: `${band * POSITION_BAND + 1}–${(band + 1) * POSITION_BAND}`,
    ...passRate(placed.filter((row) => Math.floor(row.position / POSITION_BAND) === band)),
  })).filter((band) => band.reviews > 0);
}

/**
 * The pass rate of each direction with and without a sibling direction of the
 * same word earlier in the same session. A row with no position is left out.
 */
function siblings(rows) {
  const placed = rows.filter((row) => row.position !== null);
  const first = new Map();
  for (const row of placed) {
    const key = `${row.session}\u0000${row.wordId}`;
    first.set(key, Math.min(first.get(key) ?? Infinity, row.position));
  }
  const earlier = (row) => first.get(`${row.session}\u0000${row.wordId}`) < row.position;
  return byDirection(placed).map(([direction, group]) => ({
    direction,
    withSibling: passRate(group.filter(earlier)),
    withoutSibling: passRate(group.filter((row) => !earlier(row))),
  }));
}

/** The TOP words with the highest sum of a count, each with its reviews and pass rate. */
function hardWords(rows, wordOf, countOf) {
  const byWord = new Map();
  for (const row of rows) {
    const word = byWord.get(row.wordId) ?? {
      wordId: row.wordId,
      count: 0,
      rows: [],
    };
    word.count += countOf(row) ?? 0;
    word.rows.push(row);
    byWord.set(row.wordId, word);
  }
  return [...byWord.values()]
    .filter((word) => word.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP)
    .map((word) => ({
      word: wordOf(word.wordId),
      count: word.count,
      reviews: word.rows.length,
      passRate: share(word.rows, isPass),
    }));
}

/**
 * The leeches of the log, grouped by direction and answer mode. A direction
 * with LEECH_LAPSES or more `lapse` and `fail` grades in the range is a leech.
 * As in `nextLapses`, a direction that was never passed counts no lapse: its
 * row has no predicted recall. Its mode is the mode of most of its failed
 * retrievals. A direction that was a leech before the review log counts fewer
 * lapses here than in the app.
 */
function leeches(rows, wordOf) {
  const cards = new Map();
  for (const row of rows) {
    if (isPass(row) || row.retrievability === null) continue;
    const key = `${row.wordId}_${row.direction}`;
    const card = cards.get(key) ?? {
      wordId: row.wordId,
      direction: row.direction,
      modes: new Map(),
      count: 0,
    };
    const mode = row.mode ?? 'none';
    card.modes.set(mode, (card.modes.get(mode) ?? 0) + 1);
    card.count += 1;
    cards.set(key, card);
  }
  const groups = new Map();
  for (const card of cards.values()) {
    if (card.count < LEECH_LAPSES) continue;
    const [mode] = [...card.modes.entries()].sort((a, b) => b[1] - a[1])[0];
    const key = `${card.direction}_${mode}`;
    const group = groups.get(key) ?? {
      direction: card.direction,
      mode,
      leeches: 0,
      words: [],
    };
    group.leeches += 1;
    group.words.push(wordOf(card.wordId));
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.leeches - a.leeches);
}

/** The share of rows that pass a test; null for no rows. */
const share = (rows, test) => (rows.length === 0 ? null : rows.filter(test).length / rows.length);
const mean = (values) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
const isPass = (row) => row.grade === 'pass';

/**
 * The share of the rows that hold a true flag. A row from a session saved
 * before #397 does not hold the flag, so it is left out, not counted as false.
 */
const flagRate = (rows, field) =>
  share(
    rows.filter((row) => row[field] !== null),
    (row) => row[field],
  );

/** The rows of each direction that has some, in the order of DIRECTIONS. */
function byDirection(rows) {
  const known = DIRECTIONS.map((direction) => [
    direction,
    rows.filter((row) => row.direction === direction),
  ]);
  const other = rows.filter((row) => !DIRECTIONS.includes(row.direction));
  return [...known, ['other', other]].filter(([, group]) => group.length > 0);
}

/** The answer modes in a fixed order; `none` is a session saved before #397. */
const MODES = ['input', 'flashcard', 'handwriting'];
function byMode(rows) {
  const modeOf = (row) => row.mode ?? 'none';
  const order = [...MODES, ...new Set(rows.map(modeOf).filter((mode) => !MODES.includes(mode)))];
  return order
    .map((mode) => [mode, rows.filter((row) => modeOf(row) === mode)])
    .filter(([, group]) => group.length > 0);
}

/** The pass rate of a group, with its size and the "too few" mark. */
function passRate(rows) {
  return {
    reviews: rows.length,
    passRate: share(rows, isPass),
    tooFew: rows.length < MIN_SAMPLE,
  };
}

/** The median of the answer times up to MAX_ANSWER_MS, and the count left out. */
function answerTime(rows) {
  const times = rows.map((row) => row.answerMs).filter((ms) => ms !== null);
  const kept = times.filter((ms) => ms <= MAX_ANSWER_MS).sort((a, b) => a - b);
  const middle = Math.floor(kept.length / 2);
  return {
    medianAnswerMs:
      kept.length === 0
        ? null
        : kept.length % 2
          ? kept[middle]
          : (kept[middle - 1] + kept[middle]) / 2,
    answerMsLeftOut: times.length - kept.length,
  };
}

/** The columns of the directions and the answer modes tables. */
function rates(rows) {
  return {
    ...passRate(rows),
    lapseRate: share(rows, (row) => row.grade === 'lapse'),
    failRate: share(rows, (row) => row.grade === 'fail'),
    revealRate: flagRate(rows, 'revealed'),
    hintRate: flagRate(rows, 'hint'),
    meanMisses: mean(rows.map((row) => row.misses).filter((misses) => misses !== null)),
    ...answerTime(rows),
  };
}

/**
 * The calibration of the rows that have a predicted recall: 10 bins of 0.1,
 * the log loss, and the RMSE of the bins weighted by their size, as the FSRS
 * benchmark measures it. A first review has no prediction, so it is left out.
 */
function calibration(rows) {
  const predicted = rows.filter((row) => row.retrievability !== null);
  const bins = Array.from({ length: 10 }, (_, i) => {
    const group = predicted.filter((row) => Math.min(9, Math.floor(row.retrievability * 10)) === i);
    return {
      bin: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
      ...passRate(group),
      meanPrediction: mean(group.map((row) => row.retrievability)),
    };
  });
  const clamp = (p) => Math.min(1 - 1e-6, Math.max(1e-6, p));
  const logLoss = mean(
    predicted.map((row) => {
      const p = clamp(row.retrievability);
      return isPass(row) ? -Math.log(p) : -Math.log(1 - p);
    }),
  );
  const squared = bins
    .filter((bin) => bin.reviews > 0)
    .reduce((sum, bin) => sum + bin.reviews * (bin.passRate - bin.meanPrediction) ** 2, 0);
  return {
    reviews: predicted.length,
    tooFew: predicted.length < MIN_SAMPLE,
    bins,
    logLoss,
    rmse: predicted.length === 0 ? null : Math.sqrt(squared / predicted.length),
  };
}

/**
 * The most common pairs of expected word and first wrong answer. A pair that
 * occurs once is left out.
 */
function repeatedErrors(rows, wordOf) {
  const pairs = new Map();
  for (const row of rows) {
    if (!row.answer) continue;
    const key = `${row.wordId}\u0000${row.answer}`;
    const pair = pairs.get(key) ?? {
      wordId: row.wordId,
      answer: row.answer,
      count: 0,
      directions: new Set(),
    };
    pair.count += 1;
    pair.directions.add(row.direction);
    pairs.set(key, pair);
  }
  return [...pairs.values()]
    .filter((pair) => pair.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP)
    .map((pair) => ({
      word: wordOf(pair.wordId),
      answer: pair.answer,
      directions: DIRECTIONS.filter((direction) => pair.directions.has(direction)),
      count: pair.count,
    }));
}

/* ---------- Markdown ---------- */

const percent = (value) => (value === null ? '–' : `${Math.round(value * 100)}%`);
const decimal = (digits) => (value) => (value === null ? '–' : value.toFixed(digits));
const seconds = (ms) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);
const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * A Markdown table. A row with `tooFew` shows its numbers in italics, and its
 * first number cell, the review count, carries the mark.
 */
function table(columns, rows) {
  if (rows.length === 0) return '_No reviews._';
  const lines = [
    `| ${columns.map((column) => column.title).join(' | ')} |`,
    `| ${columns.map((column) => (column.label ? '---' : '---:')).join(' | ')} |`,
  ];
  for (const row of rows) {
    let marked = false;
    const cells = columns.map((column) => {
      const text = escapeCell(column.cell(row));
      if (column.label || !row.tooFew) return text;
      const mark = marked ? '' : ' (too few)';
      marked = true;
      return `_${text}${mark}_`;
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

const label = (title, cell) => ({ title, cell, label: true });
const value = (title, cell) => ({ title, cell });
const reviewsColumn = value('Reviews', (row) => row.reviews);
const rateColumns = [
  reviewsColumn,
  value('Pass', (row) => percent(row.passRate)),
  value('Lapse', (row) => percent(row.lapseRate)),
  value('Fail', (row) => percent(row.failRate)),
  value('Reveal', (row) => percent(row.revealRate)),
  value('Hint', (row) => percent(row.hintRate)),
  value('Mean misses', (row) => decimal(2)(row.meanMisses)),
  value('Median answer', (row) => seconds(row.medianAnswerMs)),
  value('Times left out', (row) => row.answerMsLeftOut),
];

/**
 * The reviews and pass columns of a group inside a row, such as `withHint`. The
 * group has its own size, so it carries its own "too few" mark, as `table` does.
 */
const groupColumns = (title, field) => {
  const italic = (group, text) => (group.tooFew ? `_${text}_` : text);
  return [
    value(`${title} reviews`, (row) =>
      italic(row[field], `${row[field].reviews}${row[field].tooFew ? ' (too few)' : ''}`),
    ),
    value(`${title} pass`, (row) => italic(row[field], percent(row[field].passRate))),
  ];
};

function calibrationTable(calibrationResult) {
  return [
    table(
      [
        label('Predicted recall', (row) => row.bin),
        reviewsColumn,
        value('Mean prediction', (row) => decimal(3)(row.meanPrediction)),
        value('Pass rate', (row) => percent(row.passRate)),
      ],
      calibrationResult.bins.filter((bin) => bin.reviews > 0),
    ),
    '',
    `Reviews: ${calibrationResult.reviews}${calibrationResult.tooFew ? ' (too few)' : ''}. ` +
      `Log loss: ${decimal(4)(calibrationResult.logLoss)}. RMSE of the bins: ${decimal(4)(calibrationResult.rmse)}.`,
  ].join('\n');
}

/** The Markdown text of a report. */
function toMarkdown(report) {
  const { header } = report;
  const out = [];
  // Each block (heading, note, table) stands alone, with a blank line after it.
  const add = (...blocks) =>
    out.push(...blocks.filter((block) => block !== '').flatMap((block) => [block, '']));

  add(
    '# Review log report',
    [
      `- Dates: ${header.since ?? '–'} to ${header.until ?? '–'} (UTC)`,
      `- Scheduler: ${header.scheduler ?? '–'}${header.schedulerFromNewest ? ' (the scheduler of the newest row)' : ''}`,
      `- Reviews: ${header.reviews}`,
      `- A group with fewer than ${MIN_SAMPLE} reviews is in italics and marked "too few".`,
    ].join('\n'),
  );

  add(
    '## 1. Calibration',
    'A first review has no prediction, so it is left out. In a calibrated direction, the pass rate of each bin is near its mean prediction. A lower log loss and RMSE are better.',
    '### All directions',
    calibrationTable(report.calibration.all),
  );
  for (const direction of report.calibration.byDirection) {
    add(`### ${direction.direction}`, calibrationTable(direction));
  }

  add(
    '## 2. Directions',
    `The median answer time leaves out an answer of more than ${MAX_ANSWER_MS / 1000} seconds, because it includes time in a hidden tab. "Times left out" counts them.`,
    table([label('Direction', (row) => row.direction), ...rateColumns], report.directions),
  );

  add(
    '## 3. Answer modes',
    'A mode with a much higher pass rate than the other modes of its direction can grade more easily, for example a self-graded flashcard.',
    table(
      [
        label('Direction', (row) => row.direction),
        label('Mode', (row) => row.mode),
        ...rateColumns,
      ],
      report.modes,
    ),
  );

  add(
    '## 4. Hints',
    'The learner asks for a hint when a question is hard, so a lower pass rate after a hint does not prove that the hint has no effect. In log version 1, a hint was free. From version 2, every hint caps the grade at lapse, so a pass after a hint cannot occur.',
    '### Pinyin and meaning answers',
    table(
      [
        label('Direction', (row) => row.direction),
        label('Answer', (row) => row.answer),
        label('Log version', (row) => row.logVersion),
        reviewsColumn,
        value('Hint rate', (row) => percent(row.hintRate)),
        ...groupColumns('With hint', 'withHint'),
        ...groupColumns('Without hint', 'withoutHint'),
        value('Hinted lapse', (row) => row.hintedLapses),
        value('Hinted fail', (row) => row.hintedFails),
      ],
      report.hints.pinyinAndMeaning,
    ),
    '',
    '### Character answers',
    'The stroke outline is the answer. From log version 2, a hinted question ends as a lapse or a fail. In version 1, a hinted question can also pass.',
    table(
      [
        label('Direction', (row) => row.direction),
        label('Log version', (row) => row.logVersion),
        reviewsColumn,
        value('Hinted', (row) => row.hinted),
        value('Hint rate', (row) => percent(row.hintRate)),
        value('Hinted lapse', (row) => row.hintedLapses),
        value('Hinted fail', (row) => row.hintedFails),
      ],
      report.hints.characters,
    ),
  );

  const { fails } = report.reveals;
  add(
    '## 5. Reveals',
    `Fail grades: ${fails.fails}. From a reveal: ${fails.revealed} (${percent(fails.share)}). A flashcard self-grade of fail is not a reveal.`,
    table(
      [
        label('Direction', (row) => row.direction),
        label('Mode', (row) => row.mode),
        reviewsColumn,
        value('Reveal rate', (row) => percent(row.revealRate)),
      ],
      report.reveals.modes,
    ),
  );

  add(
    '## 6. Fatigue and sibling directions',
    'The order of the session queue is not random, so these tables describe the sessions and do not prove a cause.',
    '### Position in the session',
    table(
      [
        label('Positions', (row) => row.band),
        reviewsColumn,
        value('Pass rate', (row) => percent(row.passRate)),
      ],
      report.fatigue,
    ),
    '',
    '### An earlier sibling direction of the same word in the session',
    table(
      [
        label('Direction', (row) => row.direction),
        ...groupColumns('With sibling', 'withSibling'),
        ...groupColumns('Without sibling', 'withoutSibling'),
      ],
      report.siblings,
    ),
  );

  const wordColumns = [
    label('Word', (row) => row.word),
    value('Count', (row) => row.count),
    value('Reviews', (row) => row.reviews),
    value('Pass rate', (row) => percent(row.passRate)),
  ];
  add(
    '## 7. Repeated errors',
    `The ${TOP} most common first wrong answers, with the expected word. A pair that occurs once is left out.`,
    table(
      [
        label('Expected word', (row) => row.word),
        label('Answer', (row) => row.answer),
        label('Directions', (row) => row.directions.join(', ')),
        value('Count', (row) => row.count),
      ],
      report.repeatedErrors,
    ),
    '',
    '### Words with the most misses',
    table(wordColumns, report.hardWords.misses),
    '',
    '### Words with the most tone errors',
    table(wordColumns, report.hardWords.toneErrors),
  );

  add(
    '## 8. Leeches',
    `A direction with ${LEECH_LAPSES} or more lapse and fail grades in the date range. Its mode is the mode of most of those grades. A direction that was a leech before the review log counts fewer lapses here than in the app.`,
    table(
      [
        label('Direction', (row) => row.direction),
        label('Mode', (row) => row.mode),
        value('Leeches', (row) => row.leeches),
        label('Words', (row) => row.words.join(', ')),
      ],
      report.leeches,
    ),
  );

  return `${out.join('\n').trimEnd()}\n`;
}

module.exports = { MIN_SAMPLE, MAX_ANSWER_MS, reviewReport, toMarkdown };
