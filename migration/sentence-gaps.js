/**
 * Write the gaps of the example sentences: each HSK word with fewer than 3
 * sentences, for a Claude Code generation session. See issue #468 and
 * sentences/GENERATE.md.
 *
 * Runs the build of build-dictionary.js in memory, with the generated
 * sentences accepted so far, and writes nothing that the build reads.
 *
 * Usage:
 *   node sentence-gaps.js
 *
 * Output (git ignores sentences/scratch/):
 *   sentences/scratch/gaps.json       [{ word, hskLevel, lengthCap, needed, pinyin, gloss, has }]
 *   sentences/scratch/hsk-<n>.txt     the words of HSK 1 to 6, one on each line
 */

const fs = require('fs');
const path = require('path');
const { readCedict, resolveHsk, sentenceInputs } = require('./build-dictionary');
const { buildExampleSentences, glossOf, toneMarks } = require('./exampleSentences');

const SCRATCH = path.join(__dirname, 'sentences', 'scratch');

function main() {
  const words = readCedict();
  const { catalogue, ranks } = resolveHsk(words);
  const { inputs } = sentenceInputs(words, catalogue, ranks);
  const result = buildExampleSentences(inputs);

  // The entry and the sentences of each gap help the session pick the sense
  // of the word and write sentences that differ from the ones it has.
  const entryOf = new Map();
  for (const word of [...inputs.hsk].sort((a, b) => a.level - b.level)) {
    if (!entryOf.has(word.simp)) entryOf.set(word.simp, word.entry);
  }
  const gaps = result.gaps.map((gap) => {
    const entry = entryOf.get(gap.word);
    const file = result.files[gap.word.codePointAt(0).toString(16)];
    return {
      ...gap,
      pinyin: toneMarks(entry.pinyin),
      gloss: glossOf(entry),
      has: ((file && file[gap.word]) ?? []).map((sentence) => sentence.simp),
    };
  });

  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(
    path.join(SCRATCH, 'gaps.json'),
    '[\n' + gaps.map((gap) => JSON.stringify(gap)).join(',\n') + '\n]\n',
  );
  for (let level = 1; level <= 6; level++) {
    const listed = [...new Set(inputs.hsk.filter((w) => w.level === level).map((w) => w.simp))];
    fs.writeFileSync(path.join(SCRATCH, `hsk-${level}.txt`), listed.join('\n') + '\n');
  }

  const byLevel = {};
  for (const gap of gaps) byLevel[gap.hskLevel] = (byLevel[gap.hskLevel] ?? 0) + 1;
  const needed = gaps.reduce((sum, gap) => sum + gap.needed, 0);
  console.log(`${gaps.length} HSK words need ${needed} sentences.`);
  for (const [level, count] of Object.entries(byLevel)) {
    console.log(`  ${level === '7' ? 'HSK 7–9' : `HSK ${level}`}: ${count} words`);
  }
  console.log(`Wrote: ${path.join(SCRATCH, 'gaps.json')}`);
}

main();
