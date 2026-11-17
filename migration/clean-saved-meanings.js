/**
 * Rewrite `wordData.meaning` of each userWords document to the clean meaning
 * of its dictionary entry (#488). `amendedMeaning` never changes.
 * savedMeanings.js holds the rules.
 *
 * The script reads every user's userWords. A dry run, the default, writes
 * nothing: it prints the count of changed words, a sample, and the words with
 * no matching entry. A second run after --write changes nothing.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. `npm run build:dict` at the repo root, which writes the clean dictionary
 *   3. A service account key of the project
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node clean-saved-meanings.js --key <file> [--write]
 *
 * Run it on staging first. Run it on production only after the maintainer
 * approves the staging result.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { planMeaningUpdates } = require('./savedMeanings');

const BATCH_SIZE = 500;
const SAMPLE_SIZE = 20;

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const keyPath = argument('--key');
  if (!keyPath) {
    console.error('Usage: node clean-saved-meanings.js --key <file> [--write]');
    process.exit(1);
  }
  const write = process.argv.includes('--write');
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const dictionary = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'web-client', 'public', 'dictionary.json'), 'utf8'),
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  const db = admin.firestore();

  const snapshot = await db.collectionGroup('userWords').get();
  const docs = snapshot.docs.map((doc) => ({ path: doc.ref.path, id: doc.id, data: doc.data() }));
  const { updates, unchanged, missing } = planMeaningUpdates(docs, dictionary);

  console.log(`Project: ${serviceAccount.project_id}${write ? '' : ' (dry run)'}`);
  console.log(`Words: ${docs.length}. Changed: ${updates.length}. Unchanged: ${unchanged}. No entry: ${missing.length}.`);
  console.log('Sample:');
  for (const { simp, from, to } of updates.slice(0, SAMPLE_SIZE)) {
    console.log(`  ${simp}: "${from}" -> "${to}"`);
  }
  for (const { path: docPath, simp, reason } of missing) {
    console.log(`  Not changed: ${docPath} ${simp}: ${reason}`);
  }
  if (!write) return;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { path: docPath, to } of updates.slice(i, i + BATCH_SIZE)) {
      batch.update(db.doc(docPath), { 'wordData.meaning': to });
    }
    await batch.commit();
  }
  console.log(`Wrote ${updates.length} words.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
