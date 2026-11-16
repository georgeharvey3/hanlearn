/**
 * Restore one direction of one word that the app marked wrong by mistake, as
 * if the answer had been a pass. restoreMissedPass.js holds the rule.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key saved as `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node restore-missed-pass.js --uid <userId> --word <simplified> --direction <MP|...>
 *     --date <YYYY-MM-DD> [--write]
 *
 * Without --write it prints the change and writes nothing. It changes only the
 * word: the review log and the day's reviewStats keep the wrong grades.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { restoreMissedPass } = require('./restoreMissedPass');

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const toDate = (value) => (value && typeof value.toDate === 'function' ? value.toDate() : value ?? null);

function show(label, d) {
  const fmt = (x) => (x instanceof Date ? x.toISOString() : x);
  console.log(`${label}:`, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, fmt(v)])));
}

async function main() {
  const uid = argument('--uid');
  const simp = argument('--word');
  const direction = argument('--direction');
  const date = argument('--date');
  const write = process.argv.includes('--write');
  if (!uid || !simp || !direction || !date) {
    console.error(
      'Usage: node restore-missed-pass.js --uid <userId> --word <simplified> ' +
        '--direction <MP> --date <YYYY-MM-DD> [--write]',
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  const user = db.collection('users').doc(uid);
  console.log(`Project: ${serviceAccount.project_id}${write ? '' : ' (dry run)'}`);

  const words = await user.collection('userWords').where('wordData.simp', '==', simp).get();
  if (words.size !== 1) throw new Error(`Expected one word ${simp}, found ${words.size}`);
  const wordDoc = words.docs[0];
  const wordId = Number(wordDoc.id);
  const data = wordDoc.data();
  const current = data.directions?.[direction];
  if (!current) throw new Error(`Word ${simp} has no direction ${direction}`);

  const logs = await user.collection('reviewLog').where('date', '==', date).get();
  const reviews = logs.docs
    .flatMap((doc) => {
      const log = doc.data();
      return (log.reviews ?? [])
        .filter((r) => r.wordId === wordId && r.direction === direction)
        .map((r) => ({
          ...r,
          reviewedAt: toDate(log.reviewedAt),
          before: r.before ? { ...r.before, lastReview: toDate(r.before.lastReview) } : null,
        }));
    })
    .sort((a, b) => a.reviewedAt - b.reviewedAt);

  console.log(`Reviews of ${simp} ${direction} on ${date}:`);
  for (const r of reviews) {
    console.log(`  ${r.reviewedAt.toISOString()} ${r.grade} answer=${JSON.stringify(r.answer ?? null)}`);
  }

  const restored = restoreMissedPass(
    { ...current, dueDate: toDate(current.dueDate), lastReview: toDate(current.lastReview) },
    reviews,
  );
  show('Now', { ...current, dueDate: toDate(current.dueDate), lastReview: toDate(current.lastReview) });
  show('Restored', restored);

  const directions = {
    ...data.directions,
    [direction]: {
      ...restored,
      dueDate: admin.firestore.Timestamp.fromDate(restored.dueDate),
      lastReview: admin.firestore.Timestamp.fromDate(restored.lastReview),
    },
  };
  const all = Object.values(directions);
  const bank = Math.min(...all.map((d) => d.bank));
  const dueDate = all.map((d) => d.dueDate).reduce((a, b) => (a.toMillis() <= b.toMillis() ? a : b));
  console.log(`Word level: ${data.bank} -> ${bank}, due ${toDate(data.dueDate).toISOString()} -> ${dueDate.toDate().toISOString()}`);

  if (!write) {
    console.log('Dry run: nothing written. Add --write to apply.');
    return;
  }
  await wordDoc.ref.update({ directions, bank, dueDate });
  console.log('Written.');
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
