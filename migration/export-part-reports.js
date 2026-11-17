/**
 * Export the reports of wrong part meanings of all learners to a CSV file,
 * one row for each report. See issue #533.
 *
 * A learner reports the label of a part from the line of a tapped part in the
 * component breakdown. The report goes to
 * `users/{userId}/partReports/{reportId}`. To fix a label, change it in
 * `components/labels.json` and run `npm run build:dict`. partReportCsv.js
 * holds the rows.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key saved as `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node export-part-reports.js [--out <file>]
 *
 * The default output is `part-reports.csv` in this directory. It holds no
 * user ids.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { partReportCsv } = require('./partReportCsv');

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const out = argument('--out') ?? path.join(__dirname, 'part-reports.csv');

  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const snapshot = await admin.firestore().collectionGroup('partReports').get();
  fs.writeFileSync(out, partReportCsv(snapshot.docs.map((doc) => doc.data())));
  console.log(`Wrote ${snapshot.size} reports to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
