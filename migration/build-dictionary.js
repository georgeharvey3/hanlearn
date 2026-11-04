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
 *   ../web-client/public/sentences/ (the example sentences, see #465)
 *   sentences/coverage.md (the coverage report, on a local run only)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ranksOf, resolveCatalogue } = require('./premadeCatalogue');
const { buildExampleSentences, unfilledOf } = require('./exampleSentences');

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
  const { catalogue, ranks } = resolveHsk(words);
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
  return { catalogue, ranks };
}

/**
 * Resolve the HSK lists against the dictionary: the catalogue of premade lists
 * and the HSK rank `q` of each entry. Writes nothing.
 */
function resolveHsk(words) {
  const hskDir = path.join(__dirname, 'hsk');
  const source = HSK_LISTS.map((list) => ({
    id: list.id,
    name: list.name,
    words: JSON.parse(fs.readFileSync(path.join(hskDir, 'source', list.file), 'utf8')).map(
      (word) => ({
        simp: word.s,
        q: word.q,
        forms: word.f.map((form) => ({ trad: form.t, pinyin: form.i.n })),
      }),
    ),
  }));
  const overrides = JSON.parse(fs.readFileSync(path.join(hskDir, 'overrides.json'), 'utf8'));
  const catalogue = resolveCatalogue(source, overrides, words);
  return { catalogue, ranks: ranksOf(source, overrides, catalogue) };
}

/** The level of each list of HSK_LISTS: 1 to 6, and 7 for HSK 7–9. */
const levelOfList = (index) => Math.min(index + 1, 7);

/** The committed generated sentences of #468, or an empty file. */
const GENERATED_PATH = path.join(__dirname, 'sentences', 'generated.json');

/**
 * The inputs of buildExampleSentences, from the committed generated sentences
 * and the resolved HSK lists. Also gives the generated file as it is on disk,
 * which the gaps and accept scripts read and write.
 */
function sentenceInputs(words, catalogue, ranks) {
  const generatedFile = fs.existsSync(GENERATED_PATH)
    ? JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf8'))
    : { source: 'generated', records: [], rounds: {} };

  const hsk = catalogue.flatMap((list, i) =>
    list.entries.map((entry) => ({
      simp: entry.simp,
      level: levelOfList(i),
      entry,
      q: ranks.get(entry.id),
    })),
  );
  return {
    inputs: {
      dictionary: words,
      hsk,
      generated: generatedFile.records,
      unfilled: unfilledOf(generatedFile),
    },
    generatedFile,
  };
}

/**
 * Write the example sentence files from the committed generated sentences,
 * with no network and no AI. A local run also writes the coverage report to
 * sentences/coverage.md. CI only prints it.
 *
 * Fails the build on a malformed generated record, on a generated sentence
 * that fails the grader, and on a sentence file over 2 MB.
 */
function buildSentences(words, catalogue, ranks, outputDir) {
  const { inputs } = sentenceInputs(words, catalogue, ranks);
  const result = buildExampleSentences(inputs);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, content] of Object.entries(result.files)) {
    fs.writeFileSync(path.join(outputDir, name + '.json'), JSON.stringify(content));
  }
  fs.writeFileSync(path.join(outputDir, 'ATTRIBUTION.txt'), ATTRIBUTION);
  fs.writeFileSync(path.join(outputDir, 'LICENSE.txt'), LICENSE);

  console.log(
    'Wrote ' + Object.keys(result.files).length + ' sentence files and ' +
      result.count + ' sentences to: ' + outputDir,
  );
  console.log('');
  console.log(result.report);
  if (!process.env.CI) {
    const reportPath = path.join(__dirname, 'sentences', 'coverage.md');
    fs.writeFileSync(reportPath, result.report);
    console.log('Also wrote: ' + reportPath);
  }
}

/** The text of ATTRIBUTION.txt: the source of each part of a sentence file. */
const ATTRIBUTION = [
  'Claude Code generated the Chinese and the English of each example sentence',
  'for HanLearn (see ADR 0020). No third-party licence applies to that text.',
  '',
  'The segments, pinyin and glosses come from CC-CEDICT (https://cc-cedict.org),',
  'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).',
].join('\n') + '\n';

/** The text of LICENSE.txt: the licence of the files. */
const LICENSE = [
  'The example sentence files in this directory are licensed under CC BY-SA 4.0',
  '(https://creativecommons.org/licenses/by-sa/4.0/), because the segment pinyin',
  'and glosses come from CC-CEDICT (https://cc-cedict.org), which is share-alike.',
  'This licence covers these data files only, not the HanLearn app.',
  '',
  'ATTRIBUTION.txt names the source of each part of the files.',
].join('\n') + '\n';

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

/**
 * The entries of cedict_ts.u8, numbered by their position in the file. Exits
 * when the file is missing or is not the frozen file.
 */
function readCedict() {
  const cedictPath = path.join(__dirname, 'cedict_ts.u8');
  if (!fs.existsSync(cedictPath)) {
    console.error('cedict_ts.u8 not found.');
    console.error('Download CC-CEDICT from: https://www.mdbg.net/chinese/dictionary?page=cc-cedict');
    process.exit(1);
  }
  const content = fs.readFileSync(cedictPath);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  if (sha256 !== CEDICT_SHA256) {
    console.error('cedict_ts.u8 changed (SHA-256 ' + sha256 + ').');
    console.error('Dictionary IDs are line positions, and userWords document IDs use them.');
    console.error('Migrate the userWords IDs before you change the file. See issue #427.');
    process.exit(1);
  }
  const words = [];
  let id = 1;
  for (const line of content.toString('utf8').split(/\r?\n/)) {
    const word = parseCedictLine(line);
    if (word) {
      words.push({ id: id, simp: word.simp, trad: word.trad, pinyin: word.pinyin, meaning: word.meaning });
      id++;
    }
  }
  return words;
}

function buildDictionary() {
  const outputPath = path.join(__dirname, '..', 'web-client', 'public', 'dictionary.json');
  const functionsOutputPath = path.join(__dirname, '..', 'functions', 'data', 'dictionary.json');
  const charDefinitionsPath = path.join(
    __dirname,
    '..',
    'functions',
    'data',
    'char-definitions.json'
  );

  console.log('Parsing CC-CEDICT...');
  const words = readCedict();
  console.log('Parsed ' + words.length + ' entries');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Writing the premade lists...');
  const { catalogue, ranks } = buildCatalogue(words, path.join(outputDir, 'premade-lists'));

  console.log('Writing the example sentences...');
  buildSentences(words, catalogue, ranks, path.join(outputDir, 'sentences'));

  // Write as compact JSON (no pretty printing to save space). An HSK word
  // carries the frequency rank `q` of the source, which the dictionary search
  // ranks by; CC-CEDICT has no frequency of its own.
  console.log('Writing dictionary.json...');
  const json = JSON.stringify(
    words.map((word) => (ranks.has(word.id) ? { ...word, q: ranks.get(word.id) } : word)),
  );
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

if (require.main === module) {
  try {
    buildDictionary();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { readCedict, resolveHsk, sentenceInputs, GENERATED_PATH };
