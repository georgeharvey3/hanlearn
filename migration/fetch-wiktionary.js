/**
 * Download kaikki's Chinese JSONL and write the Wiktionary source file, sentences/wiktionary.json. sentenceSources.js holds the rules. See
 * issue #466.
 *
 * The download is about 160 MB compressed and 1.2 GB as text, so the script
 * streams it and keeps only the pages that hold a usage example.
 *
 * Prerequisites: Node.js 18 or later.
 *
 * Usage:
 *   node fetch-wiktionary.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const { Readable } = require('stream');
const { formatSourceFile, wiktionaryRecords } = require('./sentenceSources');
const licences = require('./sentenceLicences');

const SOURCE_URL = 'https://kaikki.org/dictionary/Chinese/kaikki.org-dictionary-Chinese.jsonl.gz';

async function main() {
  console.log(`Downloading ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const lines = readline.createInterface({
    input: Readable.fromWeb(response.body).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  const pages = [];
  let total = 0;
  for await (const line of lines) {
    total++;
    if (/"type":\s*"example"/.test(line)) pages.push(line);
  }

  const records = wiktionaryRecords(pages);
  if (records.length === 0) throw new Error('No usage examples found: the kaikki format changed');
  const out = path.join(__dirname, 'sentences', 'wiktionary.json');
  fs.writeFileSync(
    out,
    formatSourceFile({
      source: 'wiktionary',
      downloaded: new Date().toISOString().slice(0, 10),
      licence: licences.wiktionary,
      records,
    }),
  );
  console.log(`Wrote ${records.length} records from ${pages.length} of ${total} pages to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
