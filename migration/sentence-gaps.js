/**
 * Write the gaps of the example sentences: each HSK word with fewer than 3
 * sentences, for a Claude Code generation session. See issues #468 and #480,
 * and sentences/GENERATE.md.
 *
 * Runs the build of build-dictionary.js in memory, with the generated
 * sentences accepted so far, and writes nothing that the build reads.
 *
 * The gaps come in this order: the words of the learners' word lists, then
 * HSK 1–3, then the other HSK words. The script reads the learners' words from
 * Firestore with the Admin SDK, and only reads.
 *
 * Prerequisites:
 *   1. `npm install` in this directory
 *   2. A service account key saved as `service-account.json` in this directory
 *      (Firebase Console > Project Settings > Service accounts)
 *
 * Usage:
 *   node sentence-gaps.js [--key <file>]
 *   node sentence-gaps.js --no-learners     HSK order only, with no Firestore read
 *
 * Output (git ignores sentences/scratch/):
 *   sentences/scratch/gaps.json       [{ word, hskLevel, lengthCap, needed, pinyin, gloss, has, priority }]
 *   sentences/scratch/hsk-<n>.txt     the words of HSK 1 to 6, one on each line
 */

const fs = require('fs');
const path = require('path');
const { readCleanCedict, resolveHsk, sentenceInputs } = require('./build-dictionary');
const { buildExampleSentences, glossOf, orderGaps, toneMarks } = require('./exampleSentences');

const SCRATCH = path.join(__dirname, 'sentences', 'scratch');

/** The value after a flag, or undefined. */
function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** The simplified words of the word lists of all learners. Reads only. */
async function learnerWords(keyPath) {
  const admin = require('firebase-admin');
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  // The field mask reads one field of each word, not the scheduling state.
  const snapshot = await app.firestore().collectionGroup('userWords').select('wordData.simp').get();
  await app.delete();
  const words = new Set();
  for (const doc of snapshot.docs) {
    const simp = doc.get('wordData.simp');
    if (typeof simp === 'string' && simp !== '') words.add(simp);
  }
  return words;
}

async function main() {
  const learners = process.argv.includes('--no-learners')
    ? new Set()
    : await learnerWords(argument('--key') ?? path.join(__dirname, 'service-account.json'));

  const { words } = readCleanCedict();
  const { catalogue, ranks } = resolveHsk(words);
  const { inputs } = sentenceInputs(words, catalogue, ranks);
  const result = buildExampleSentences(inputs);

  // The entry and the sentences of each gap help the session pick the sense
  // of the word and write sentences that differ from the ones it has.
  const entryOf = new Map();
  for (const word of [...inputs.hsk].sort((a, b) => a.level - b.level)) {
    if (!entryOf.has(word.simp)) entryOf.set(word.simp, word.entry);
  }
  const listed = result.gaps.map((gap) => {
    const entry = entryOf.get(gap.word);
    const file = result.files[gap.word.codePointAt(0).toString(16)];
    return {
      ...gap,
      pinyin: toneMarks(entry.pinyin),
      gloss: glossOf(entry),
      has: ((file && file[gap.word]) ?? []).map((sentence) => sentence.simp),
    };
  });
  const gaps = orderGaps(listed, learners);

  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(
    path.join(SCRATCH, 'gaps.json'),
    '[\n' + gaps.map((gap) => JSON.stringify(gap)).join(',\n') + '\n]\n',
  );
  for (let level = 1; level <= 6; level++) {
    const levelWords = [...new Set(inputs.hsk.filter((w) => w.level === level).map((w) => w.simp))];
    fs.writeFileSync(path.join(SCRATCH, `hsk-${level}.txt`), levelWords.join('\n') + '\n');
  }

  const byLevel = {};
  for (const gap of gaps) byLevel[gap.hskLevel] = (byLevel[gap.hskLevel] ?? 0) + 1;
  const needed = gaps.reduce((sum, gap) => sum + gap.needed, 0);
  console.log(`${gaps.length} HSK words need ${needed} sentences.`);
  const learnerGaps = gaps.filter((gap) => gap.priority === 1).length;
  console.log(`  The learners' words: ${learnerGaps} of ${learners.size} words, first in the file`);
  for (const [level, count] of Object.entries(byLevel)) {
    console.log(`  ${level === '7' ? 'HSK 7–9' : `HSK ${level}`}: ${count} words`);
  }
  console.log(`Wrote: ${path.join(SCRATCH, 'gaps.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
