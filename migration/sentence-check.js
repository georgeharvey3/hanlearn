/**
 * The hand check of the shipped Tatoeba credits (#485). See
 * sentences/CHECK.md for the procedure.
 *
 * Runs the build of build-dictionary.js in memory, with the block list so
 * far, and leaves out the credits of checked.json. A change to the pick or
 * the split gives new credits, and this script lists only those.
 *
 * Usage:
 *   node sentence-check.js [--limit <n>]   print the counts, and write the next
 *                                          batch of unchecked credits (150 by default)
 *   node sentence-check.js --list          print every unchecked credit, one on each line
 *   node sentence-check.js --done          apply the finished batch: mark its credits
 *                                          checked, and add its blocks to blocked.json
 *
 * Output (git ignores sentences/scratch/):
 *   sentences/scratch/check-batch.json     [{ id, word, simp, english, gloss, longer }]
 */

const fs = require('fs');
const path = require('path');
const { readCleanCedict, resolveHsk, sentenceInputs, BLOCKED_PATH } = require('./build-dictionary');
const { buildExampleSentences } = require('./exampleSentences');
const { applyBatch, formatBlocked, formatChecked, uncheckedCredits } = require('./sentenceCheck');

const SENTENCES = path.join(__dirname, 'sentences');
const BATCH_PATH = path.join(SENTENCES, 'scratch', 'check-batch.json');
const CHECKED_PATH = path.join(SENTENCES, 'checked.json');
const DEFAULT_LIMIT = 150;

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The shipped Tatoeba credits of the build, with the block list. */
function shippedCredits() {
  const { words } = readCleanCedict();
  const { catalogue, ranks } = resolveHsk(words);
  const { inputs } = sentenceInputs(words, catalogue, ranks);
  return buildExampleSentences(inputs).credits;
}

function applyFinishedBatch() {
  if (!fs.existsSync(BATCH_PATH)) throw new Error(`No batch to apply: ${BATCH_PATH}`);
  const batch = readJson(BATCH_PATH);
  const result = applyBatch(readJson(CHECKED_PATH).credits, readJson(BLOCKED_PATH).entries, batch);
  if (result.problems.length > 0) {
    throw new Error(`The batch has ${result.problems.length} problems:\n  ${result.problems.join('\n  ')}`);
  }
  fs.writeFileSync(CHECKED_PATH, formatChecked(result.checked));
  fs.writeFileSync(BLOCKED_PATH, formatBlocked(result.blocked));
  fs.rmSync(BATCH_PATH);
  const flagged = batch.filter((credit) => credit.block !== undefined).length;
  console.log(`Checked ${batch.length} credits, and flagged ${flagged}.`);
  console.log(`Wrote: ${CHECKED_PATH}`);
  console.log(`Wrote: ${BLOCKED_PATH}`);
}

function writeNextBatch() {
  const all = shippedCredits();
  const unchecked = uncheckedCredits(all, readJson(CHECKED_PATH).credits);
  if (process.argv.includes('--list')) {
    for (const c of unchecked) console.log([c.id, c.word, c.longer ?? '', c.simp, c.english].join('\t'));
    return;
  }
  const inside = unchecked.filter((credit) => credit.longer !== null).length;
  console.log(`${all.length} shipped Tatoeba credits: ${all.length - unchecked.length} checked, ${unchecked.length} not checked.`);
  console.log(`  Not checked, with the target inside a longer word: ${inside}`);
  if (unchecked.length === 0) return;
  if (fs.existsSync(BATCH_PATH)) {
    throw new Error(`A batch is not applied yet. Run --done, or delete ${BATCH_PATH}.`);
  }
  const limit = Number(argument('--limit') ?? DEFAULT_LIMIT);
  const batch = unchecked.slice(0, limit);
  fs.mkdirSync(path.dirname(BATCH_PATH), { recursive: true });
  fs.writeFileSync(BATCH_PATH, '[\n' + batch.map((credit) => JSON.stringify(credit)).join(',\n') + '\n]\n');
  console.log(`Wrote ${batch.length} credits to: ${BATCH_PATH}`);
}

try {
  if (process.argv.includes('--done')) applyFinishedBatch();
  else writeNextBatch();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
