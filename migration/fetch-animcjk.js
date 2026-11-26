/**
 * Download the AnimCJK source of the component breakdown into
 * components/source/:
 *
 * - animcjk.json: the "acjk" decomposition of each character of the four
 *   AnimCJK sets (simplified Chinese, traditional Chinese, Japanese, Korean),
 *   at one pinned commit. It also holds `order` and `meanings`: see below
 * - animcjk-COPYING.txt: the AnimCJK notice
 *
 * An acjk text counts the strokes of the AnimCJK drawing of a character. The
 * app draws the Hanzi Writer data. So this script compares the two drawings
 * of each character, with strokeOrder of componentBreakdown.js, and writes
 * the result to `order`:
 *
 * - no entry: the same strokes in the same order
 * - a list: the same strokes in another order. The list gives the Hanzi
 *   Writer stroke of each AnimCJK stroke
 * - null: other strokes. The build does not use this text for the character
 *   itself. It can still use it for a part with the same stroke count
 *
 * `meanings` gives `[definition, pinyin]` for each character that Make Me a
 * Hanzi does not have, for the label of a part.
 *
 * The script reads the committed stroke-medians.json, so run
 * fetch-makemeahanzi.js first. build-dictionary.js reads only the committed
 * files, with no network.
 *
 * Prerequisites: Node.js 18 or later.
 *
 * Usage:
 *   node fetch-animcjk.js
 */

const fs = require('fs');
const path = require('path');
const { parseMakeMeAHanzi, strokeOrder } = require('./componentBreakdown');
const { endsOf } = require('./strokeMedians');

/** The AnimCJK commit of the committed file. */
const ANIMCJK_COMMIT = 'c63765b150cbd567c71d05cf4a4f8d00b57045c9';

/** The file name suffix of each set. */
const SETS = { hans: 'ZhHans', hant: 'ZhHant', ja: 'Ja', ko: 'Ko' };

const SOURCE_DIR = path.join(__dirname, 'components', 'source');

async function download(file) {
  const url = `https://raw.githubusercontent.com/parsimonhi/animCJK/${ANIMCJK_COMMIT}/${file}`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The JSON lines of an AnimCJK text file. */
const linesOf = (buffer) =>
  buffer
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => JSON.parse(line));

async function main() {
  const medians = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'stroke-medians.json'), 'utf8')).medians;
  const ends = Object.fromEntries(Object.entries(medians).map(([char, lines]) => [char, endsOf(lines)]));
  const entries = parseMakeMeAHanzi(fs.readFileSync(path.join(SOURCE_DIR, 'dictionary.txt'), 'utf8'));
  const sets = {};
  const order = {};
  const meanings = {};
  for (const [set, suffix] of Object.entries(SETS)) {
    sets[set] = {};
    order[set] = {};
    for (const entry of linesOf(await download(`dictionary${suffix}.txt`))) {
      if (!entry.acjk) continue;
      sets[set][entry.character] = entry.acjk;
      if (!entries.has(entry.character) && !meanings[entry.character] && entry.definition) {
        meanings[entry.character] = [entry.definition, entry.pinyin?.[0] ?? null];
      }
    }
    const drawn = new Set();
    for (const graphic of linesOf(await download(`graphics${suffix}.txt`))) {
      drawn.add(graphic.character);
      const reference = ends[graphic.character];
      if (!reference || !sets[set][graphic.character]) continue;
      const own = graphic.medians.map((median) => [...median[0], ...median[median.length - 1]]);
      const map = strokeOrder(own, reference);
      if (map === null) order[set][graphic.character] = null;
      else if (map.some((j, i) => j !== i)) order[set][graphic.character] = map;
    }
    // A text with no drawing cannot be compared, so the build must not use it
    // for the character itself.
    for (const char of Object.keys(sets[set])) {
      if (ends[char] && !drawn.has(char)) order[set][char] = null;
    }
  }
  const out = path.join(SOURCE_DIR, 'animcjk.json');
  fs.writeFileSync(
    out,
    JSON.stringify({ source: `animCJK@${ANIMCJK_COMMIT}`, sets, order, meanings }) + '\n',
  );
  for (const set of Object.keys(SETS)) {
    console.log(`${set}: ${Object.keys(sets[set]).length} texts, ${Object.keys(order[set]).length} with other strokes or another order`);
  }
  console.log(`Wrote: ${out}`);
  fs.writeFileSync(path.join(SOURCE_DIR, 'animcjk-COPYING.txt'), await download('licenses/COPYING.txt'));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
