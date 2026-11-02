/**
 * Export the sentenceCache collection of production to its source file, sentences/sentence-cache.json. The script only reads: it calls get()
 * on the collection and never writes to Firestore. sentenceSources.js holds
 * the rules. See issue #466.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key of the production project saved as
 *      `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts). A key with
 *      the Cloud Datastore Viewer role is enough.
 *
 * Usage:
 *   node export-sentence-cache.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { cacheRecords, formatSourceFile } = require('./sentenceSources');
const licences = require('./sentenceLicences');

async function main() {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const snapshot = await admin.firestore().collection('sentenceCache').get();
  const records = cacheRecords(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));

  const out = path.join(__dirname, 'sentences', 'sentence-cache.json');
  fs.writeFileSync(
    out,
    formatSourceFile({
      source: 'sentenceCache',
      downloaded: new Date().toISOString().slice(0, 10),
      licence: licences.sentenceCache,
      records,
    }),
  );
  console.log(`Wrote ${records.length} records from ${snapshot.size} words to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
