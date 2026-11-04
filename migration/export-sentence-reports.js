/**
 * Export the reports of example sentences of all learners to a CSV file, one
 * row per sentence, the most reported first. See issue #469.
 *
 * A learner reports a sentence from the sentence stages. The report goes to
 * `users/{userId}/sentenceReports/{sentenceId}`. To fix a sentence, change or
 * remove it in `sentences/generated.json`, or add a gloss override to
 * `sentences/gloss-overrides.json`, and run `npm run build:dict`.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key saved as `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node export-sentence-reports.js [--out <file>]
 *
 * The default output is `sentence-reports.csv` in this directory. It holds no
 * user ids, only a count of the learners who reported each sentence.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const COLUMNS = [
  "sentenceId",
  "word",
  "sentence",
  "english",
  "stages",
  "reports",
  "lastReported",
];

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
const field = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows) =>
  `${[COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => field(row[c])).join(","))].join("\n")}\n`;

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** One row per sentence: the reports of all learners, the most reported first. */
function reportRows(reports) {
  const bySentence = new Map();
  for (const report of reports) {
    const row = bySentence.get(report.sentenceId) ?? {
      sentenceId: report.sentenceId,
      word: report.word,
      sentence: report.sentence,
      english: report.english,
      stages: new Set(),
      reports: 0,
      lastReported: "",
    };
    row.reports += 1;
    row.stages.add(report.stage);
    const at = report.reportedAt?.toDate?.().toISOString() ?? "";
    if (at > row.lastReported) row.lastReported = at;
    bySentence.set(report.sentenceId, row);
  }
  return [...bySentence.values()]
    .sort(
      (a, b) => b.reports - a.reports || (a.sentenceId < b.sentenceId ? -1 : 1),
    )
    .map((row) => ({ ...row, stages: [...row.stages].sort().join(" ") }));
}

async function main() {
  const out = argument("--out") ?? path.join(__dirname, "sentence-reports.csv");

  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, "service-account.json"), "utf8"),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const snapshot = await admin
    .firestore()
    .collectionGroup("sentenceReports")
    .get();
  const rows = reportRows(snapshot.docs.map((doc) => doc.data()));

  fs.writeFileSync(out, toCsv(rows));
  console.log(
    `Wrote ${rows.length} sentences from ${snapshot.size} reports to ${out}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
