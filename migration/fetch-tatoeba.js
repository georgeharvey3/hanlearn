/**
 * Download the Tatoeba exports and write the Tatoeba source file,
 * sentences/tatoeba.json. sentenceSources.js holds the rules. See issue #466.
 *
 * Prerequisites: Node.js 18 or later, and `bunzip2` on the PATH.
 *
 * Usage:
 *   node fetch-tatoeba.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { formatSourceFile, scriptSets, tatoebaRecords } = require('./sentenceSources');
const licences = require('./sentenceLicences');

const BASE = 'https://downloads.tatoeba.org/exports/per_language';

const FILES = {
  sentences: 'cmn/cmn_sentences_detailed.tsv.bz2',
  links: 'cmn/cmn-eng_links.tsv.bz2',
  english: 'eng/eng_sentences_detailed.tsv.bz2',
  transcriptions: 'cmn/cmn_transcriptions.tsv.bz2',
  tags: 'cmn/cmn_tags.tsv.bz2',
  userLanguages: 'cmn/cmn_user_languages.tsv.bz2',
};

/** The lines of one bzip2 export. */
async function download(file) {
  const response = await fetch(`${BASE}/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const compressed = Buffer.from(await response.arrayBuffer());
  const text = execFileSync('bunzip2', ['-c'], {
    input: compressed,
    maxBuffer: 1024 * 1024 * 1024,
  }).toString('utf8');
  return text.split('\n').filter((line) => line !== '');
}

/** The trad and simp forms of each CC-CEDICT entry. */
function cedictForms() {
  const text = fs.readFileSync(path.join(__dirname, 'cedict_ts.u8'), 'utf8');
  const forms = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^(\S+) (\S+) \[/);
    if (match && !line.startsWith('#')) forms.push({ trad: match[1], simp: match[2] });
  }
  return forms;
}

async function main() {
  const input = {};
  for (const [key, file] of Object.entries(FILES)) {
    console.log(`Downloading ${file}`);
    input[key] = await download(file);
  }
  const records = tatoebaRecords(input, scriptSets(cedictForms()));
  const out = path.join(__dirname, 'sentences', 'tatoeba.json');
  fs.writeFileSync(
    out,
    formatSourceFile({
      source: 'tatoeba',
      downloaded: new Date().toISOString().slice(0, 10),
      licence: licences.tatoeba,
      records,
    }),
  );
  console.log(`Wrote ${records.length} records from ${input.sentences.length} sentences to ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
