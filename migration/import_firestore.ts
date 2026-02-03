/**
 * Import CC-CEDICT and chengyus to Firestore.
 *
 * Prerequisites:
 *   1. Download service account key from Firebase Console:
 *      Project Settings > Service accounts > Generate new private key
 *   2. Save as `service-account.json` in this directory
 *   3. Download CC-CEDICT from https://www.mdbg.net/chinese/dictionary?page=cc-cedict
 *   4. Extract cedict_ts.u8 to this directory
 *
 * Usage:
 *   npx ts-node import_firestore.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const BATCH_SIZE = 500; // Firestore batch limit

interface WordData {
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

interface ChengyuData {
  characters: string;
  pinyin: string;
  meaning: string;
}

/**
 * Parse a CC-CEDICT line
 * Format: 繁體 简体 [pin1 yin1] /meaning1/meaning2/
 */
function parseCedictLine(line: string): WordData | null {
  // Skip comments and empty lines
  if (line.startsWith('#') || line.trim() === '') {
    return null;
  }

  // Format: 繁體 简体 [pin yin] /meaning1/meaning2/
  const match = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/);
  if (!match) {
    return null;
  }

  return {
    trad: match[1],
    simp: match[2],
    pinyin: match[3],
    meaning: match[4],
  };
}

/**
 * Parse a chengyu line
 * Format: characters/pinyin/meaning
 */
function parseChengyuLine(line: string): ChengyuData | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('/');
  if (parts.length < 3) return null;

  return {
    characters: parts[0],
    pinyin: parts[1],
    meaning: parts.slice(2).join('/'), // In case meaning contains slashes
  };
}

/**
 * Import words from CC-CEDICT file
 */
async function importWords(): Promise<void> {
  const cedictPath = path.join(__dirname, 'cedict_ts.u8');

  if (!fs.existsSync(cedictPath)) {
    console.error('cedict_ts.u8 not found.');
    console.error('Download CC-CEDICT from: https://www.mdbg.net/chinese/dictionary?page=cc-cedict');
    console.error('Extract cedict_ts.u8 to the migration/ directory.');
    return;
  }

  console.log('Importing words from CC-CEDICT...');

  const fileStream = fs.createReadStream(cedictPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;
  let wordId = 1;

  for await (const line of rl) {
    const word = parseCedictLine(line);
    if (!word) continue;

    const docRef = db.collection('words').doc(String(wordId));
    batch.set(docRef, word);

    wordId++;
    count++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed ${count} words...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  Total words imported: ${count}`);
}

/**
 * Import chengyus from chengyus.txt
 */
async function importChengyus(): Promise<void> {
  const chengyuPath = path.join(__dirname, '..', 'api', 'app', 'chengyus.txt');

  if (!fs.existsSync(chengyuPath)) {
    console.error('chengyus.txt not found at api/app/chengyus.txt');
    return;
  }

  console.log('Importing chengyus...');

  const content = fs.readFileSync(chengyuPath, 'utf8');
  const lines = content.split('\n');

  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const chengyu = parseChengyuLine(lines[i]);
    if (!chengyu) continue;

    const docRef = db.collection('chengyus').doc(String(count));
    batch.set(docRef, chengyu);

    count++;

    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      console.log(`  Committed ${count} chengyus...`);
      batch = db.batch();
    }
  }

  // Commit remaining
  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`  Total chengyus imported: ${count}`);
}

async function main(): Promise<void> {
  console.log('Starting Firestore import...\n');

  try {
    await importWords();
    console.log('');

    await importChengyus();
    console.log('');

    console.log('Import complete!');
    console.log('\nNext steps:');
    console.log('1. Create a Firebase account and register');
    console.log('2. Your word bank will start empty - search and add words');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
