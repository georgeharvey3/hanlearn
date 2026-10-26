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
 *   ../web-client/public/premade-lists/ (the catalogue of premade lists)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { resolveCatalogue } = require('./premadeCatalogue');

/**
 * The HSK 3.0 bands of the catalogue, from drkameleon/complete-hsk-vocabulary
 * (MIT). Bands 7 to 9 are one list in the source, and one list here.
 */
const HSK_LISTS = [
  { id: 'hsk-1', name: 'HSK 1', file: '1.min.json' },
  { id: 'hsk-2', name: 'HSK 2', file: '2.min.json' },
  { id: 'hsk-3', name: 'HSK 3', file: '3.min.json' },
  { id: 'hsk-4', name: 'HSK 4', file: '4.min.json' },
  { id: 'hsk-5', name: 'HSK 5', file: '5.min.json' },
  { id: 'hsk-6', name: 'HSK 6', file: '6.min.json' },
  { id: 'hsk-7-9', name: 'HSK 7–9', file: '7.min.json' },
];

/**
 * Write the catalogue of premade lists: an index of the lists, and one file of
 * dictionary entries for each list. The dictionary is served by Cloud
 * Functions, so each list carries its entries, and adding a list needs no
 * lookup. The app loads the index when the learner opens the catalogue, and a
 * list's file when the learner adds it.
 *
 * Fails the build when a word resolves to no entry or to more than one, and
 * migration/hsk/overrides.json does not settle it.
 */
function buildCatalogue(words, outputDir) {
  const hskDir = path.join(__dirname, 'hsk');
  const source = HSK_LISTS.map((list) => ({
    id: list.id,
    name: list.name,
    words: JSON.parse(fs.readFileSync(path.join(hskDir, 'source', list.file), 'utf8')).map(
      (word) => ({
        simp: word.s,
        forms: word.f.map((form) => ({ trad: form.t, pinyin: form.i.n })),
      }),
    ),
  }));
  const overrides = JSON.parse(fs.readFileSync(path.join(hskDir, 'overrides.json'), 'utf8'));
  const catalogue = resolveCatalogue(source, overrides, words);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  const index = catalogue.map((list) => ({
    id: list.id,
    name: list.name,
    size: list.entries.length,
  }));
  fs.writeFileSync(path.join(outputDir, 'index.json'), JSON.stringify({ lists: index }));
  for (const list of catalogue) {
    fs.writeFileSync(path.join(outputDir, list.id + '.json'), JSON.stringify(list.entries));
  }
  fs.copyFileSync(path.join(hskDir, 'source', 'LICENSE'), path.join(outputDir, 'LICENSE.txt'));
  console.log(
    'Wrote ' + catalogue.length + ' premade lists to: ' + outputDir +
      ' (' + index.map((list) => list.name + ': ' + list.size).join(', ') + ')',
  );
}

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

  console.log('Writing the premade lists...');
  buildCatalogue(words, path.join(outputDir, 'premade-lists'));

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

buildDictionary().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
