/**
 * Write the distractors of the Comprehend tab to sentences/distractors.json
 * (#601). Run it after a change to the example sentences: build:dict fails
 * when the sentence that the tab shows has no distractors.
 *
 * Runs the sentence build of build-dictionary.js in memory, embeds the English
 * of each built sentence with the pinned model of embedder.js, and chooses 3
 * distractors for each with the rule of distractors.js. The pairs of
 * sentences/blocked-distractors.json are skipped.
 *
 * Usage:
 *   npm --prefix migration install       (once, for the model library)
 *   node migration/write-distractors.js
 *
 * The first run downloads the model (about 600 MB). A run takes about 10
 * minutes on a laptop CPU.
 */

const fs = require('fs');
const path = require('path');
const { readCleanCedict, resolveHsk, sentenceInputs } = require('./build-dictionary');
const { buildExampleSentences } = require('./exampleSentences');
const { chooseDistractors, formatDistractors, parseBlockedPairs } = require('./distractors');
const { MODEL, createEmbedder } = require('./embedder');

const DISTRACTORS_PATH = path.join(__dirname, 'sentences', 'distractors.json');
const BLOCKED_DISTRACTORS_PATH = path.join(__dirname, 'sentences', 'blocked-distractors.json');

/** A progress line that rewrites itself. */
const progress = (label) => {
  let shown = 0;
  return (done, total) => {
    if (done < total && done - shown < 500) return;
    shown = done;
    process.stdout.write(`\r${label}: ${done} / ${total}`);
    if (done === total) process.stdout.write('\n');
  };
};

async function main() {
  const { words } = readCleanCedict();
  const { catalogue, ranks } = resolveHsk(words);
  const { inputs } = sentenceInputs(words, catalogue, ranks);
  const { files } = buildExampleSentences(inputs);
  const blocked = parseBlockedPairs(JSON.parse(fs.readFileSync(BLOCKED_DISTRACTORS_PATH, 'utf8')).entries);

  console.log(`Loading ${MODEL.name} at ${MODEL.revision}...`);
  const embed = await createEmbedder({ onProgress: progress('Embedded') });
  const { distractors, short } = await chooseDistractors(files, embed, blocked, progress('Chose'));

  fs.writeFileSync(DISTRACTORS_PATH, formatDistractors(MODEL, distractors));
  console.log(`Wrote the distractors of ${Object.keys(distractors).length} sentences to ${DISTRACTORS_PATH}`);
  if (short.length > 0) {
    console.log(`${short.length} sentences have fewer than 3 distractors:`);
    for (const { id, found } of short) console.log(`  ${id}: ${found}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
