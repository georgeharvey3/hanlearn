/**
 * Grade the candidate sentences of a Claude Code generation session with the
 * rules of the build, and add the passes to sentences/generated.json. Prints
 * each reject with its reason, so that the session can correct it. See issue
 * #468 and sentences/GENERATE.md.
 *
 * Each call is one round for each word of its candidates. A word that is
 * still short after 3 rounds stays unfilled, and the coverage report lists it.
 *
 * Usage:
 *   node sentence-accept.js <candidates.json>...
 *
 * A candidates file is a JSON array of { word, simp, english }.
 */

const fs = require('fs');
const path = require('path');
const { readCedict, resolveHsk, sentenceInputs, GENERATED_PATH } = require('./build-dictionary');
const { acceptCandidates } = require('./exampleSentences');

const LICENCE = {
  name: 'None',
  url: null,
  attribution: 'Sentences and translations that Claude Code generated for HanLearn. No third-party licence applies.',
};

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The text of the generated file: one record on each line, in a fixed order. */
function formatGenerated(records, rounds) {
  const sorted = [...records].sort((a, b) => compare(a.headword, b.headword) || compare(a.sourceId, b.sourceId));
  const sortedRounds = Object.fromEntries(Object.entries(rounds).sort(([a], [b]) => compare(a, b)));
  const head = JSON.stringify({ source: 'generated', licence: LICENCE, rounds: sortedRounds }).slice(0, -1);
  return `${head},"records":[\n${sorted.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node sentence-accept.js <candidates.json>...');
    process.exit(1);
  }
  const candidates = files.flatMap((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  withLock(() => accept(candidates));
}

/**
 * Run fn while this process holds the lock of the generated file. A session
 * can run the accept script in parallel, and each run reads, grades and
 * writes the whole file.
 */
function withLock(fn) {
  const lock = path.join(path.dirname(GENERATED_PATH), 'scratch', 'generated.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started > 10 * 60 * 1000) {
        throw new Error(`Waited 10 minutes for ${lock}. If no accept script runs, remove it.`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  try {
    fn();
  } finally {
    fs.rmdirSync(lock);
  }
}

function accept(candidates) {
  const words = readCedict();
  const { catalogue, ranks } = resolveHsk(words);
  const { inputs, generatedFile } = sentenceInputs(words, catalogue, ranks);
  const result = acceptCandidates(inputs, candidates, generatedFile.rounds ?? {});

  const records = [...generatedFile.records, ...result.records];
  fs.writeFileSync(GENERATED_PATH, formatGenerated(records, result.rounds));

  for (const reject of result.rejects) {
    console.log(`REJECT ${reject.word} ${reject.simp} : ${reject.reason}`);
  }
  const failed = Object.entries(result.rounds).filter(([, count]) => count >= 3).map(([word]) => word);
  const newlyFailed = failed.filter((word) => !((generatedFile.rounds ?? {})[word] >= 3));
  console.log('');
  console.log(`${result.records.length} passed, ${result.rejects.length} rejected, of ${candidates.length} candidates.`);
  console.log(`The generated file holds ${records.length} sentences: ${GENERATED_PATH}`);
  const retry = result.short.filter(({ word }) => result.rounds[word] < 3);
  if (retry.length > 0) {
    console.log(`Still short: ${retry.map(({ word, needed }) => `${word} (${needed}, round ${result.rounds[word]})`).join(', ')}`);
  }
  if (newlyFailed.length > 0) console.log(`Unfilled after 3 rounds: ${newlyFailed.join(', ')}`);
}

main();
