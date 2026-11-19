/**
 * Download the Wiktionary compositions of the characters into
 * components/source/wiktionary.json (#563). build-dictionary.js compares the
 * top-level parts of each breakdown with them, and writes the differences to
 * components/wiktionary-differences.md. The breakdown files hold no
 * Wiktionary data.
 *
 * The data is the Translingual dictionary of Wiktextract on kaikki.org, about
 * 150 MB. kaikki.org keeps only its latest extraction, so the file records
 * the date of the Wiktionary dump and of the extraction. A new run gives the
 * data of a new dump, and the date in the file changes with it.
 *
 * The file keeps the composition of every character entry, not only of the
 * HSK characters. The comparison splits a part by its own composition, and a
 * part can be a character outside HSK (𫇦 in 劳).
 *
 * Prerequisites: Node.js 18 or later.
 *
 * Usage:
 *   node fetch-wiktionary.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const { wiktionaryComposition } = require('./componentBreakdown');

const DATA_URL = 'https://kaikki.org/dictionary/Translingual/kaikki.org-dictionary-Translingual.jsonl';
/** The page that gives the date of the dump and of the extraction. */
const DATES_URL = 'https://kaikki.org/dictionary/rawdata.html';

const SOURCE_DIR = path.join(__dirname, 'components', 'source');

async function get(url) {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

async function main() {
  const page = (await (await get(DATES_URL)).text()).replace(/<[^>]*>/g, ' ');
  const dump = /enwiktionary dump\s+dated (\d{4}-\d{2}-\d{2})/.exec(page)?.[1];
  const extracted = /extracted on (\d{4}-\d{2}-\d{2})/.exec(page)?.[1];
  if (!dump || !extracted) throw new Error(`${DATES_URL}: no dump date or extraction date`);

  const response = await get(DATA_URL);
  const lines = readline.createInterface({ input: Readable.fromWeb(response.body), crlfDelay: Infinity });
  const compositions = {};
  for await (const line of lines) {
    if (line.trim() === '') continue;
    const entry = JSON.parse(line);
    const composition = wiktionaryComposition(entry);
    if (composition !== null && !(entry.word in compositions)) compositions[entry.word] = composition;
  }
  const sorted = Object.fromEntries(Object.entries(compositions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const out = path.join(SOURCE_DIR, 'wiktionary.json');
  fs.writeFileSync(
    out,
    JSON.stringify({ source: DATA_URL, dump, extracted, compositions: sorted }, null, 1) + '\n',
  );
  console.log(`Wrote ${Object.keys(sorted).length} compositions of the dump dated ${dump} to: ${out}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
