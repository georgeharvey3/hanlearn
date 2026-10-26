/**
 * Convert CC-CEDICT to a static JSON file for client-side dictionary lookups.
 *
 * This creates a compact JSON array that can be served statically,
 * eliminating the need for Firestore storage of the dictionary.
 *
 * Usage:
 *   node build-dictionary.js
 *
 * Output:
 *   ../web-client/public/dictionary.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * The SHA-256 of the one cedict_ts.u8 the app ships (2026-01-02).
 *
 * An entry's ID is its position in this file, and each userWords document
 * uses that ID as its document ID. A file with one line more or less moves
 * every later ID, and existing words then collide with other entries. So the
 * file is frozen: a new CEDICT needs a migration of the userWords IDs first.
 * See #427.
 */
const CEDICT_SHA256 = 'fca2b8d7912c0bb0f4ac87e47692a197bcdefb4fd33a088bd6b5c2d8747c0c86';

/**
 * Parse a CC-CEDICT line
 * Format: 繁體 简体 [pin1 yin1] /meaning1/meaning2/
 */
function parseCedictLine(line) {
  // Skip comments and empty lines
  if (line.startsWith('#') || line.startsWith('%') || line.trim() === '') {
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

async function buildDictionary() {
  const cedictPath = path.join(__dirname, 'cedict_ts.u8');
  const outputPath = path.join(__dirname, '..', 'web-client', 'public', 'dictionary.json');
  const functionsOutputPath = path.join(__dirname, '..', 'functions', 'data', 'dictionary.json');
  const charDefinitionsPath = path.join(
    __dirname,
    '..',
    'functions',
    'data',
    'char-definitions.json'
  );

  if (!fs.existsSync(cedictPath)) {
    console.error('cedict_ts.u8 not found.');
    console.error('Download CC-CEDICT from: https://www.mdbg.net/chinese/dictionary?page=cc-cedict');
    process.exit(1);
  }

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(cedictPath)).digest('hex');
  if (sha256 !== CEDICT_SHA256) {
    console.error('cedict_ts.u8 changed (SHA-256 ' + sha256 + ').');
    console.error('Dictionary IDs are line positions, and userWords document IDs use them.');
    console.error('Migrate the userWords IDs before you change the file. See issue #427.');
    process.exit(1);
  }

  console.log('Parsing CC-CEDICT...');

  const fileStream = fs.createReadStream(cedictPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const words = [];
  let id = 1;

  for await (const line of rl) {
    const word = parseCedictLine(line);
    if (word) {
      words.push({ id: id, simp: word.simp, trad: word.trad, pinyin: word.pinyin, meaning: word.meaning });
      id++;
    }
  }

  console.log('Parsed ' + words.length + ' entries');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write as compact JSON (no pretty printing to save space)
  console.log('Writing dictionary.json...');
  const json = JSON.stringify(words);
  fs.writeFileSync(outputPath, json);

  // Also write to functions/data/ for Cloud Functions
  const functionsOutputDir = path.dirname(functionsOutputPath);
  if (!fs.existsSync(functionsOutputDir)) {
    fs.mkdirSync(functionsOutputDir, { recursive: true });
  }
  fs.writeFileSync(functionsOutputPath, json);
  console.log('Also wrote to: ' + functionsOutputPath);

  // Write a single-character subset for the decomposeCharacter Cloud Function.
  // Decomposition components are always single characters, so this function
  // does not need the full dictionary in memory.
  console.log('Writing char-definitions.json...');
  const charDefinitions = {};
  for (const word of words) {
    for (const form of [word.simp, word.trad]) {
      if ([...form].length === 1 && !charDefinitions[form]) {
        charDefinitions[form] = { pinyin: word.pinyin, meaning: word.meaning };
      }
    }
  }
  fs.writeFileSync(charDefinitionsPath, JSON.stringify(charDefinitions));
  console.log(
    'Wrote ' +
      Object.keys(charDefinitions).length +
      ' characters to: ' +
      charDefinitionsPath
  );

  // Calculate file sizes
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log('');
  console.log('Output: ' + outputPath);
  console.log('Size: ' + sizeMB + ' MB');
  console.log('Entries: ' + words.length);
  console.log('');
  console.log('Done! The dictionary will be served from /dictionary.json');
}

buildDictionary().catch(console.error);
