/**
 * Write the Markdown report on the review log of one learner, from the CSV
 * file of export-review-log.js. reviewReport.js holds the rules. See #446.
 *
 * It reads no Firestore and needs no service account, so it runs again on an
 * old export. The words show as characters and pinyin from
 * functions/data/dictionary.json (`npm run build:dict` writes it): the id of a
 * `userWords` document is the id of its dictionary entry, and a custom word,
 * with a negative id, shows its id. build:dict numbers the entries in the order
 * of CC-CEDICT, so a new CC-CEDICT file can move the ids under an old export.
 *
 * Usage:
 *   node review-report.js <review-log.csv> [--out <file>]
 *     [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--scheduler <name>]
 *
 * The default output is the input path with `.md` in place of `.csv`. The
 * report holds typed answers, so it stays out of git, as the CSV file does.
 */

const fs = require('fs');
const path = require('path');
const { reviewReport, toMarkdown } = require('./reviewReport');

const DICTIONARY = path.join(__dirname, '..', 'functions', 'data', 'dictionary.json');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const USAGE =
  'Usage: node review-report.js <review-log.csv> [--out <file>] ' +
  '[--since YYYY-MM-DD] [--until YYYY-MM-DD] [--scheduler <name>]';

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const input = process.argv[2];
  const since = argument('--since');
  const until = argument('--until');
  if (!input || input.startsWith('--') || [since, until].some((date) => date && !DATE.test(date))) {
    console.error(USAGE);
    process.exit(1);
  }
  const out = argument('--out') ?? input.replace(/\.csv$/i, '') + '.md';

  const words = new Map();
  if (fs.existsSync(DICTIONARY)) {
    for (const entry of JSON.parse(fs.readFileSync(DICTIONARY, 'utf8'))) {
      words.set(String(entry.id), { simp: entry.simp, pinyin: entry.pinyin });
    }
  } else {
    console.warn(`No ${DICTIONARY}: the report shows word ids. Run npm run build:dict first.`);
  }

  const report = reviewReport(fs.readFileSync(input, 'utf8'), {
    since,
    until,
    scheduler: argument('--scheduler'),
    words,
  });
  fs.writeFileSync(out, toMarkdown(report));
  console.log(`Wrote the report of ${report.header.reviews} reviews to ${out}`);
}

main();
