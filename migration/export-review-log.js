/**
 * Export the review log of one learner to a CSV file, one row per review.
 *
 * The columns are the format of the FSRS optimizer, plus the columns of the
 * calibration and of the review of the study design. reviewLogCsv.js holds
 * the rules. See issue #397.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key saved as `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node export-review-log.js --uid <userId> [--out <file>]
 *
 * The default output is `review-log-<userId>.csv` in this directory. The file
 * holds the answers that the learner typed, so it stays out of git.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { reviewLogRows, toCsv } = require('./reviewLogCsv');

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const uid = argument('--uid');
  if (!uid) {
    console.error('Usage: node export-review-log.js --uid <userId> [--out <file>]');
    process.exit(1);
  }
  const out = argument('--out') ?? path.join(__dirname, `review-log-${uid}.csv`);

  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const snapshot = await admin
    .firestore()
    .collection('users')
    .doc(uid)
    .collection('reviewLog')
    .get();
  const rows = reviewLogRows(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));

  fs.writeFileSync(out, toCsv(rows));
  console.log(`Wrote ${rows.length} reviews from ${snapshot.size} sessions to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
