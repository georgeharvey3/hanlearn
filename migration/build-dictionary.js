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
 *   ../web-client/public/premade-lists/ (the catalogue of premade lists, and
 *     hsk-index.json, the HSK index of the Dashboard)
 *   ../web-client/public/sentences/ (the example sentences, see #465)
 *   ../web-client/public/breakdowns/ (the component breakdowns, see #528)
 *   sentences/coverage.md (the coverage report, on a local run only)
 *   components/wiktionary-differences.md (the parts that differ from
 *     Wiktionary, see #563, on a local run only)
 *   dictionary/emptied-entries.md (the entries that the clean of #488 empties)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ranksOf, resolveCatalogue } = require('./premadeCatalogue');
const { checkHskIndex, hskIndexOf } = require('./hskIndex');
const { buildExampleSentences, unfilledOf } = require('./exampleSentences');
const { buildBreakdowns, compareWithWiktionary, parseMakeMeAHanzi } = require('./componentBreakdown');
const { cleanDictionary, isUnclean } = require('./cleanMeaning');

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
  writeHskIndex(catalogue, outputDir);
  console.log(
    'Wrote ' + catalogue.length + ' premade lists to: ' + outputDir +
      ' (' + index.map((list) => list.name + ': ' + list.size).join(', ') + ')',
  );
  return { catalogue, ranks };
}

/**
 * Write the HSK index of the Dashboard's coverage card (#271), then check it
 * against the list files as written. Fails the build when the two disagree.
 */
function writeHskIndex(catalogue, outputDir) {
  const indexPath = path.join(outputDir, 'hsk-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(hskIndexOf(catalogue)));
  const written = JSON.parse(fs.readFileSync(path.join(outputDir, 'index.json'), 'utf8')).lists.map(
    (list) => ({
      id: list.id,
      name: list.name,
      entries: JSON.parse(fs.readFileSync(path.join(outputDir, list.id + '.json'), 'utf8')),
    }),
  );
  checkHskIndex(JSON.parse(fs.readFileSync(indexPath, 'utf8')), written);
  console.log('Wrote the HSK index: ' + indexPath + ' (' + fs.statSync(indexPath).size + ' bytes)');
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

/** The committed Tatoeba sentences of native Mandarin writers (#482). */
const TATOEBA_PATH = path.join(__dirname, 'sentences', 'tatoeba.json');

/**
 * The committed gloss overrides of #479: the pinyin and the gloss that one
 * segment text shows, for an error that a person finds in use.
 */
const GLOSS_OVERRIDES_PATH = path.join(__dirname, 'sentences', 'gloss-overrides.json');

/**
 * The committed block list of #485: the bad Tatoeba sentences, and the credits
 * of a sentence to a word that it does not really hold.
 */
const BLOCKED_PATH = path.join(__dirname, 'sentences', 'blocked.json');

/**
 * The inputs of buildExampleSentences, from the committed generated and
 * Tatoeba sentences and the resolved HSK lists. Also gives the generated file
 * as it is on disk, which the gaps and accept scripts read and write.
 */
function sentenceInputs(words, catalogue, ranks) {
  const generatedFile = fs.existsSync(GENERATED_PATH)
    ? JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf8'))
    : { source: 'generated', records: [], rounds: {} };
  const tatoebaFile = JSON.parse(fs.readFileSync(TATOEBA_PATH, 'utf8'));
  const glossOverrides = JSON.parse(fs.readFileSync(GLOSS_OVERRIDES_PATH, 'utf8')).overrides;
  const blocked = JSON.parse(fs.readFileSync(BLOCKED_PATH, 'utf8')).entries;

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
      tatoeba: tatoebaFile.records,
      unfilled: unfilledOf(generatedFile),
      glossOverrides,
      blocked,
    },
    generatedFile,
    tatoebaFile,
  };
}

/**
 * Write the example sentence files from the committed generated and Tatoeba
 * sentences, with no network and no AI. A local run also writes the coverage
 * report to sentences/coverage.md. CI only prints it.
 *
 * Fails the build on a malformed record, on a bad block entry, on a generated
 * sentence that fails the grader, and on a sentence file over 2 MB.
 */
function buildSentences(words, catalogue, ranks, outputDir) {
  const { inputs, tatoebaFile } = sentenceInputs(words, catalogue, ranks);
  const result = buildExampleSentences(inputs);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, content] of Object.entries(result.files)) {
    fs.writeFileSync(path.join(outputDir, name + '.json'), JSON.stringify(content));
  }
  fs.writeFileSync(
    path.join(outputDir, 'ATTRIBUTION.txt'),
    attributionText(tatoebaFile) + result.attribution.join('\n') + '\n',
  );
  fs.writeFileSync(path.join(outputDir, 'LICENSE.txt'), licenseText(tatoebaFile));

  console.log(
    'Wrote ' + Object.keys(result.files).length + ' sentence files, ' +
      result.count + ' sentences (one for each word) and ' + result.attribution.length +
      ' Tatoeba credits to: ' + outputDir,
  );
  console.log('');
  console.log(result.report);
  if (!process.env.CI) {
    const reportPath = path.join(__dirname, 'sentences', 'coverage.md');
    fs.writeFileSync(reportPath, result.report);
    console.log('Also wrote: ' + reportPath);
  }
}

/**
 * The head of ATTRIBUTION.txt: the source of each part of a sentence file.
 * One line for each shipped Tatoeba sentence follows it.
 */
const attributionText = ({ downloaded, licence }) => [
  'The example sentences come from two sources (see ADR 0020):',
  '',
  '- Tatoeba (https://tatoeba.org), downloaded ' + downloaded + ': ' + licence.name +
    ' (' + licence.url + ').',
  '  ' + licence.attribution,
  '  Each line at the end of this file names one sentence: its id in these files,',
  '  the Tatoeba sentence and its owner, and the English sentence and its owner.',
  '- Claude Code generated the Chinese and the English of the other sentences',
  '  for HanLearn. No third-party licence applies to that text.',
  '',
  'The segments, pinyin and glosses come from CC-CEDICT (https://cc-cedict.org),',
  'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).',
  '',
  'Tatoeba sentences:',
  '',
].join('\n') + '\n';

/** The text of LICENSE.txt: the licence of the files. */
const licenseText = ({ licence }) => [
  'The example sentence files in this directory are licensed under CC BY-SA 4.0',
  '(https://creativecommons.org/licenses/by-sa/4.0/), because the segment pinyin',
  'and glosses come from CC-CEDICT (https://cc-cedict.org), which is share-alike.',
  'This licence covers these data files only, not the HanLearn app.',
  '',
  'The Tatoeba sentences are also under ' + licence.name,
  '(' + licence.url + ').',
  '',
  'ATTRIBUTION.txt names the source of each part of the files, and the owners',
  'of each Tatoeba sentence.',
].join('\n') + '\n';

/** The committed sources of the component breakdown (#528). */
const COMPONENTS_DIR = path.join(__dirname, 'components');

/**
 * Write one component breakdown file for each character of the HSK words,
 * from the committed AnimCJK and Make Me a Hanzi data, the definitions file
 * and the labels file, with no network. Prints the number of characters that
 * each source defines, and the lists that a person can review.
 *
 * Fails the build when:
 *
 * - a named part of 2 or more strokes has no definition, because the part
 *   then splits into strokes with no name. The definitions file needs it
 * - a part has the name of a character above it, because a character never
 *   holds itself
 * - the definitions file holds a text that no breakdown uses
 * - the labels file gives a label to a part that is in no breakdown
 * - the origins file gives an origin to a character with no breakdown file
 */
function buildComponentBreakdowns(catalogue, outputDir) {
  const sourceDir = path.join(COMPONENTS_DIR, 'source');
  const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));
  const chars = catalogue.flatMap((list) =>
    list.entries.flatMap((entry) => [...entry.simp, ...entry.trad]),
  );
  const result = buildBreakdowns({
    chars,
    entries: parseMakeMeAHanzi(fs.readFileSync(path.join(sourceDir, 'dictionary.txt'), 'utf8')),
    strokeCounts: readJson(sourceDir, 'stroke-counts.json').counts,
    strokeEnds: readJson(sourceDir, 'stroke-ends.json').ends,
    animcjk: readJson(sourceDir, 'animcjk.json'),
    definitions: readJson(COMPONENTS_DIR, 'definitions.json').definitions,
    labels: readJson(COMPONENTS_DIR, 'labels.json'),
    origins: readJson(COMPONENTS_DIR, 'origins.json').origins,
  });
  if (result.unresolved.length) {
    throw new Error(
      'These parts have no definition with their stroke count. Add each one to ' +
        'migration/components/definitions.json: ' + result.unresolved.join(', '),
    );
  }
  if (result.selfNamed.length) {
    throw new Error(
      'These parts have the name of a character above them, and a character never holds itself: ' +
        result.selfNamed.join(', '),
    );
  }
  if (result.unusedDefinitions.length) {
    throw new Error(
      'migration/components/definitions.json holds definitions that no breakdown uses: ' +
        result.unusedDefinitions.join(' '),
    );
  }
  if (result.unused.length) {
    throw new Error(
      'migration/components/labels.json labels parts that are in no breakdown: ' +
        result.unused.join(' '),
    );
  }
  if (result.unknownOrigins.length) {
    throw new Error(
      'migration/components/origins.json gives an origin to characters with no breakdown file: ' +
        result.unknownOrigins.join(' '),
    );
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  let bytes = 0;
  for (const [name, content] of Object.entries(result.files)) {
    const json = JSON.stringify(content);
    bytes += Buffer.byteLength(json);
    fs.writeFileSync(path.join(outputDir, name + '.json'), json);
  }
  fs.writeFileSync(
    path.join(outputDir, 'ATTRIBUTION.txt'),
    breakdownAttributionText(
      fs.readFileSync(path.join(sourceDir, 'animcjk-COPYING.txt'), 'utf8'),
      fs.readFileSync(path.join(sourceDir, 'COPYING'), 'utf8'),
    ),
  );
  fs.copyFileSync(path.join(sourceDir, 'LGPL'), path.join(outputDir, 'LICENSE.txt'));
  fs.copyFileSync(path.join(sourceDir, 'GPL'), path.join(outputDir, 'GPL.txt'));

  const count = Object.keys(result.files).length;
  console.log(
    'Wrote ' + count + ' component breakdowns (' + Math.round(bytes / Math.max(count, 1)) +
      ' bytes each on average) to: ' + outputDir,
  );
  if (result.missing.length) {
    console.log('No definition in any source, so no breakdown: ' + result.missing.join(' '));
  }
  const bySource = {};
  for (const source of Object.values(result.sources)) {
    bySource[source ?? 'none'] = (bySource[source ?? 'none'] ?? 0) + 1;
  }
  console.log('Characters by the source of their definition: ' + JSON.stringify(bySource));
  console.log('Pieces with no name that split into strokes: ' + result.unnamed.join(', '));
  console.log('Parts drawn in another stroke order than the part alone: ' + result.reordered.length);
  console.log('AnimCJK texts in use with another operand count: ' + result.irregular.length);
  console.log('Parts with no label in any source: ' + result.unlabelled.join(' '));
  console.log('Parts that still use the fallback label: ' + result.fallback.length);
  writeWiktionaryDifferences(Object.values(result.files));
  writeOriginMismatches(result.originMismatches);
}

/** The report of the origins that do not fit their breakdown (#572). */
const ORIGIN_MISMATCHES_PATH = path.join(COMPONENTS_DIR, 'origin-mismatches.md');

/**
 * Write the origins that do not fit their breakdown. A mismatch never fails
 * the build: a person reads the report, then adds an override to
 * origins.json or accepts the source. A local run writes the report. CI only
 * prints the count.
 */
function writeOriginMismatches(mismatches) {
  console.log('Origins that do not fit their breakdown: ' + mismatches.length);
  if (process.env.CI) return;
  const rows = (side) =>
    mismatches.filter((m) => m.side === side).map((m) => `| ${m.char} | ${m.part} |`);
  const table = (side) => ['| Character | Part |', '| --- | --- |', ...rows(side)];
  const report = [
    '# Origin mismatches',
    '',
    '`npm run build:dict` writes this file. Do not edit it.',
    '',
    'The tables list each origin that does not fit the component breakdown of',
    'its character. For each row, add an override to `origins.json`, or accept',
    'the source. The origin line shows a part that does not fit in plain text.',
    '',
    '## Story',
    '',
    'The story names a character that is no part of the breakdown.',
    '',
    ...table('story'),
    '',
    '## Meaning',
    '',
    'The stroke match finds no part for the meaning part that the data names.',
    '',
    ...table('meaning'),
    '',
    '## Sound',
    '',
    'The stroke match finds no part for the sound part that the data names.',
    '',
    ...table('sound'),
    '',
  ].join('\n');
  fs.writeFileSync(ORIGIN_MISMATCHES_PATH, report);
  console.log('Wrote the mismatches to: ' + ORIGIN_MISMATCHES_PATH);
}

/** The report of the parts whose own parts differ from Wiktionary (#563). */
const WIKTIONARY_DIFFERENCES_PATH = path.join(COMPONENTS_DIR, 'wiktionary-differences.md');

/**
 * Compare each named part of each breakdown, at every level, with its
 * Wiktionary composition. The differences never fail the build: a person reads them,
 * then corrects definitions.json or accepts the source. A local run writes
 * the report. CI only prints the count.
 */
function writeWiktionaryDifferences(breakdowns) {
  const wiktionary = JSON.parse(
    fs.readFileSync(path.join(COMPONENTS_DIR, 'source', 'wiktionary.json'), 'utf8'),
  );
  const result = compareWithWiktionary(breakdowns, wiktionary.compositions);
  console.log(
    'Splits that differ from Wiktionary: ' + result.differences.length +
      ' (no composition: ' + result.absent.length + ', composition that does not parse: ' +
      result.malformed.length + ')',
  );
  if (process.env.CI) return;
  fs.writeFileSync(WIKTIONARY_DIFFERENCES_PATH, wiktionaryDifferencesReport(result, wiktionary.dump));
  console.log('Wrote the differences to: ' + WIKTIONARY_DIFFERENCES_PATH);
}

/**
 * The text of wiktionary-differences.md. The splits in the most characters
 * come first, because one correction fixes all of them.
 */
function wiktionaryDifferencesReport(result, dump) {
  const parts = (list) => list.map((c) => c ?? '？').join(' ');
  const chars = (list) => (list.length ? list.join(' ') : 'none');
  const tops = (list) =>
    list.length > 8 ? list.slice(0, 8).join(' ') + ' and ' + (list.length - 8) + ' more' : list.join(' ');
  const table = (strokes) => [
    '| Part | Breakdown | Wiktionary | In |',
    '| --- | --- | --- | --- |',
    ...result.differences
      .filter((d) => d.strokes === strokes)
      .sort((a, b) => b.tops.length - a.tops.length)
      .map((d) => `| ${d.char} | ${parts(d.parts)} | ${d.composition} | ${tops(d.tops)} |`),
  ];
  return [
    '# Wiktionary differences',
    '',
    '`npm run build:dict` writes this file. Do not edit it.',
    '',
    'The table lists each named part, at any level of the component breakdown,',
    'whose parts are not the parts of its Wiktionary composition. A top',
    'character is a named part too. "In" gives the HSK characters that hold the',
    'split. For each row, correct `definitions.json`, or accept the source.',
    '',
    'The compositions come from Wiktionary (https://en.wiktionary.org), through',
    'Wiktextract (https://kaikki.org), from the dump dated ' + dump + '. They are',
    'available under CC BY-SA 4.0: see `source/wiktionary-NOTICE.txt`.',
    '',
    '## Parts',
    '',
    'The breakdown splits the part into other parts than Wiktionary.',
    '',
    ...table(false),
    '',
    '## Strokes',
    '',
    'The breakdown splits the part into strokes, so it names no wrong part.',
    'Wiktionary often writes the strokes as other forms.',
    '',
    ...table(true),
    '',
    'No composition: ' + chars(result.absent),
    '',
    'A composition that does not parse: ' + chars(result.malformed),
    '',
  ].join('\n');
}

/**
 * The text of ATTRIBUTION.txt of the breakdown files. AnimCJK and Make Me a
 * Hanzi each ask for their notice, and the Unihan notice in LICENSE.txt asks
 * for a notice that the data is modified.
 */
const breakdownAttributionText = (animcjk, makeMeAHanzi) => [
  'The component breakdown files in this directory are derived from the',
  'dictionary files of AnimCJK (https://github.com/parsimonhi/animCJK) and from',
  'dictionary.txt of Make Me a Hanzi (https://github.com/skishore/makemeahanzi).',
  'HanLearn modified the data: each file holds the tree of the parts of one',
  'character, the strokes of each part, a label, and the origin of the',
  'character. Some parts come from migration/components/definitions.json of',
  'HanLearn. The labels come from migration/components/labels.json of HanLearn,',
  'then from the definitions of Make Me a Hanzi and AnimCJK. The origins come',
  'from the etymology of Make Me a Hanzi, and from',
  'migration/components/origins.json of HanLearn.',
  '',
  'HanLearn checks the parts against the compositions of Wiktionary',
  '(https://en.wiktionary.org), CC BY-SA 4.0, through Wiktextract',
  '(https://kaikki.org). These files hold no Wiktionary data.',
  '',
  'You can redistribute and/or modify these files under the terms of the GNU',
  'Lesser General Public License, version 3 or later (LICENSE.txt), which adds',
  'to the GNU General Public License, version 3 (GPL.txt).',
  '',
  'The AnimCJK notice:',
  '',
  animcjk.trim(),
  '',
  'The Make Me a Hanzi notice:',
  '',
  makeMeAHanzi.trim(),
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

/** The review file of the entries that the clean empties. */
const EMPTIED_PATH = path.join(__dirname, 'dictionary', 'emptied-entries.md');

/**
 * The entries of cedict_ts.u8 with their clean meaning (#488), and the
 * entries with no sense left. Those are not in words, so no search, list or
 * sentence shows them.
 */
function readCleanCedict() {
  const { words, emptied } = cleanDictionary(readCedict());
  return { words: words.filter((word) => word.meaning !== ''), emptied };
}

/**
 * Write the emptied entries to dictionary/emptied-entries.md for review, on
 * a local run. CI only prints their count.
 */
function writeEmptied(emptied) {
  console.log(emptied.length + ' entries have no clean sense; the dictionary leaves them out.');
  if (process.env.CI) return;
  fs.mkdirSync(path.dirname(EMPTIED_PATH), { recursive: true });
  fs.writeFileSync(EMPTIED_PATH, emptiedReport(emptied, hskRanks()));
  console.log('Wrote the emptied entries to: ' + EMPTIED_PATH);
}

/**
 * The HSK level and the rank `q` of each word of the HSK source, by its
 * simplified form and pinyin ("爱 ai4"): the lowest level, and the best rank
 * at that level.
 */
function hskRanks() {
  const ranks = new Map();
  HSK_LISTS.forEach((list, i) => {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'hsk', 'source', list.file), 'utf8'));
    for (const word of source) {
      const level = levelOfList(i);
      for (const form of word.f) {
        const key = word.s + ' ' + form.i.n.toLowerCase();
        const known = ranks.get(key);
        if (!known || level < known.level || (level === known.level && word.q < known.q)) {
          ranks.set(key, { level, q: word.q });
        }
      }
    }
  });
  return ranks;
}

/**
 * The text of dictionary/emptied-entries.md: one row for each emptied entry,
 * sorted by HSK level, then by the rank `q`, then in CC-CEDICT order. An
 * entry outside HSK comes last.
 */
function emptiedReport(emptied, ranks) {
  const rankOf = (entry) =>
    ranks.get(entry.simp + ' ' + entry.pinyin.toLowerCase()) ?? { level: Infinity, q: Infinity };
  const rows = [...emptied].sort((a, b) => {
    const ra = rankOf(a.entry);
    const rb = rankOf(b.entry);
    return ra.level - rb.level || ra.q - rb.q || a.entry.id - b.entry.id;
  });
  const cell = (text) => String(text).replace(/\|/g, '\\|');
  const level = (entry) => {
    const rank = rankOf(entry).level;
    return rank === Infinity ? '' : rank === 7 ? '7–9' : String(rank);
  };
  return [
    '# Emptied dictionary entries',
    '',
    'The build writes this file (#488). The rule of `migration/cleanMeaning.js` left no',
    'sense in these entries, so the build leaves them out of the dictionary. Review the',
    'list when the clean rule changes.',
    '',
    'Count: ' + rows.length,
    '',
    '| HSK | Traditional | Simplified | Pinyin | Raw meaning | Reason |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(({ entry, reason }) =>
      '| ' + [level(entry), entry.trad, entry.simp, entry.pinyin, entry.meaning, reason].map(cell).join(' | ') + ' |',
    ),
    '',
  ].join('\n');
}

/** The chengyu character table that build-chengyu-char-meanings.mjs generates. */
const CHENGYU_CHAR_MEANINGS_PATH = path.join(__dirname, '..', 'web-client', 'src', 'data', 'chengyuCharMeanings.ts');

/**
 * The rows of the chengyu character table as Prettier writes it: a bare or
 * quoted key, and a value in ' or ".
 */
const chengyuRowsOf = (table) =>
  [...table.matchAll(/^\s*'?([^\s':]+)'?: (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"),$/gmu)].map(
    ([, char, single, double]) => ({ char, meaning: single ?? double }),
  );

/**
 * The check of #488: fail the build when a meaning that the app shows holds a
 * Chinese character or a pinyin reference. It reads the files as written.
 */
function checkClean(words, outputDir) {
  const problems = [];
  const check = (where, text) => {
    if (isUnclean(text)) problems.push(where + ': ' + text);
  };
  for (const word of words) check('dictionary.json ' + word.id + ' ' + word.simp, word.meaning);

  const listsDir = path.join(outputDir, 'premade-lists');
  for (const { id } of JSON.parse(fs.readFileSync(path.join(listsDir, 'index.json'), 'utf8')).lists) {
    for (const entry of JSON.parse(fs.readFileSync(path.join(listsDir, id + '.json'), 'utf8'))) {
      check('premade list ' + id + ' ' + entry.simp, entry.meaning);
    }
  }

  const sentencesDir = path.join(outputDir, 'sentences');
  for (const name of fs.readdirSync(sentencesDir).filter((file) => /^[0-9a-f]+\.json$/.test(file))) {
    const file = JSON.parse(fs.readFileSync(path.join(sentencesDir, name), 'utf8'));
    for (const [word, sentences] of Object.entries(file)) {
      for (const sentence of sentences) {
        for (const segment of sentence.segments ?? []) {
          check('sentences/' + name + ' ' + word + ' segment ' + segment.s, segment.e);
        }
      }
    }
  }

  const rows = chengyuRowsOf(fs.readFileSync(CHENGYU_CHAR_MEANINGS_PATH, 'utf8'));
  if (rows.length === 0) problems.push('chengyuCharMeanings.ts: no row read; the check does not know the format');
  for (const { char, meaning } of rows) check('chengyuCharMeanings.ts ' + char, meaning);

  if (problems.length > 0) {
    throw new Error(
      'A meaning holds Chinese (#488):\n' + problems.slice(0, 50).map((line) => '  ' + line).join('\n') +
        (problems.length > 50 ? '\n  and ' + (problems.length - 50) + ' more' : ''),
    );
  }
  console.log('Checked: no meaning holds a Chinese character or a pinyin reference.');
}

function buildDictionary() {
  const outputPath = path.join(__dirname, '..', 'web-client', 'public', 'dictionary.json');
  const functionsOutputPath = path.join(__dirname, '..', 'functions', 'data', 'dictionary.json');

  console.log('Parsing CC-CEDICT...');
  const { words, emptied } = readCleanCedict();
  console.log('Parsed ' + words.length + ' entries with a clean meaning');
  writeEmptied(emptied);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Writing the premade lists...');
  const { catalogue, ranks } = buildCatalogue(words, path.join(outputDir, 'premade-lists'));

  console.log('Writing the example sentences...');
  buildSentences(words, catalogue, ranks, path.join(outputDir, 'sentences'));

  console.log('Writing the component breakdowns...');
  buildComponentBreakdowns(catalogue, path.join(outputDir, 'breakdowns'));

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

  checkClean(words, outputDir);

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

module.exports = { readCedict, readCleanCedict, emptiedReport, chengyuRowsOf, resolveHsk, sentenceInputs, GENERATED_PATH, BLOCKED_PATH };
