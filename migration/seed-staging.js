/**
 * Seed the staging project: a test account with words in two lists, the
 * chengyus, and the dictionary entries of the chengyu characters.
 *
 * stagingSeed.js holds the data. The script refuses the production project.
 * A second run writes the same documents again. See issue #46.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. `npm run build:dict` at the repo root, which writes the dictionary
 *   3. A key of the staging service account, saved as
 *      `service-account-staging.json` in this directory
 *      (staging Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   STAGING_TEST_PASSWORD=<password> node seed-staging.js [--key <file>]
 *
 * The password is not in the repository, because the staging site is public.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { assertNotProduction, buildSeed, parseChengyus } = require('./stagingSeed');

const TEST_USER = { uid: 'staging-test-user', email: 'test@hanlearn.test', username: 'test' };
const BATCH_SIZE = 500;

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Write the documents in batches, which Firestore limits to 500 writes. */
async function writeAll(db, collectionPath, docs) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { id, data } of docs.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection(collectionPath).doc(id), data);
    }
    await batch.commit();
  }
}

/** Create the test account, or set its password when it exists. */
async function upsertUser(auth, password) {
  try {
    await auth.updateUser(TEST_USER.uid, { email: TEST_USER.email, password });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: TEST_USER.uid, email: TEST_USER.email, password });
  }
}

async function main() {
  const password = process.env.STAGING_TEST_PASSWORD;
  if (!password) {
    console.error('Usage: STAGING_TEST_PASSWORD=<password> node seed-staging.js [--key <file>]');
    process.exit(1);
  }

  const keyPath = argument('--key') ?? path.join(__dirname, 'service-account-staging.json');
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  assertNotProduction(serviceAccount.project_id);

  const root = path.join(__dirname, '..');
  const dictionary = JSON.parse(
    fs.readFileSync(path.join(root, 'web-client/public/dictionary.json'), 'utf8'),
  );
  const chengyus = parseChengyus(
    fs.readFileSync(path.join(root, 'web-client/src/data/chengyus.ts'), 'utf8'),
  );
  const now = new Date();
  const seed = buildSeed({ dictionary, chengyus, now });

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  const db = admin.firestore();

  await upsertUser(admin.auth(), password);
  await db.doc(`users/${TEST_USER.uid}`).set({
    email: TEST_USER.email,
    username: TEST_USER.username,
    createdAt: now,
  });
  await writeAll(db, `users/${TEST_USER.uid}/wordLists`, seed.lists);
  await writeAll(db, `users/${TEST_USER.uid}/userWords`, seed.userWords);
  await writeAll(db, 'chengyus', seed.chengyus);
  await writeAll(db, 'words', seed.words);

  console.log(
    `Seeded ${serviceAccount.project_id}: ${seed.userWords.length} words in ` +
      `${seed.lists.length + 1} lists, ${seed.chengyus.length} chengyus and ` +
      `${seed.words.length} character entries. Log in as ${TEST_USER.email}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
