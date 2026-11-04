/**
 * Turn the raw Tatoeba exports into the records of sentences/tatoeba.json.
 *
 * Pure: fetch-tatoeba.js downloads the files and writes the result. Each
 * record has this shape:
 *
 *   source        'tatoeba'
 *   sourceId      the id of the Mandarin sentence
 *   written       'simp' | 'trad': the script the owner wrote the Chinese in
 *   simp, trad    the Chinese in each script
 *   english       the English translation
 *   owner         the person who wrote the Chinese
 *   englishId     the id of the English sentence
 *   englishOwner  the person who wrote the English
 *   origin        { chinese: 'human', english: 'human' }
 *
 * Only native Mandarin writers count: see #482 and the amendment of ADR 0020.
 */

/** The licence of the Tatoeba sentences. */
const LICENCE = {
  name: 'CC BY 2.0 FR',
  url: 'https://creativecommons.org/licenses/by/2.0/fr/',
  attribution: 'Sentences and translations from Tatoeba (https://tatoeba.org), by the owner of each sentence.',
};

/** The Tatoeba tags that mark a sentence as wrong or doubtful. */
const WRONG_TAGS = new Set(['@needs native check', '@change', '@delete', '@wrong transliteration']);

/** The skill level with which a Tatoeba user gives a language as native. */
const NATIVE = 5;

/** The columns of a tab-separated line. Tatoeba writes a missing value as \N. */
const columns = (line) => line.split('\t').map((value) => (value === '\\N' ? null : value));

/**
 * The characters that belong to one script only, from the dictionary's pairs
 * of forms. A character that differs between the two forms of an entry belongs
 * to its script, unless some entry uses it in the other script too: 后 is the
 * simplified form of 後, but also a traditional word in its own right.
 */
function scriptSets(entries) {
  const simpOnly = new Set();
  const tradOnly = new Set();
  const inSimp = new Set();
  const inTrad = new Set();
  for (const { trad, simp } of entries) {
    const tradChars = [...trad];
    const simpChars = [...simp];
    tradChars.forEach((char) => inTrad.add(char));
    simpChars.forEach((char) => inSimp.add(char));
    if (tradChars.length !== simpChars.length) continue;
    tradChars.forEach((char, i) => {
      if (char !== simpChars[i]) {
        tradOnly.add(char);
        simpOnly.add(simpChars[i]);
      }
    });
  }
  for (const char of inTrad) simpOnly.delete(char);
  for (const char of inSimp) tradOnly.delete(char);
  return { simpOnly, tradOnly };
}

/** True when a text holds a character of each script only. */
function mixesScripts(text, { simpOnly, tradOnly }) {
  const chars = [...text];
  return chars.some((c) => simpOnly.has(c)) && chars.some((c) => tradOnly.has(c));
}

/**
 * The Tatoeba records: Mandarin sentences by a native Mandarin writer, with a
 * direct link to an English sentence. Each input is the lines of one export
 * file of the per-language downloads: `sentences` (cmn_sentences_detailed),
 * `links` (cmn-eng_links), `english` (eng_sentences_detailed),
 * `transcriptions` (cmn_transcriptions), `tags` (cmn_tags) and
 * `userLanguages` (cmn_user_languages).
 */
function tatoebaRecords(input, scripts) {
  const englishById = new Map();
  for (const line of input.english) {
    const [id, , text, owner] = columns(line);
    englishById.set(id, { id, text, owner });
  }

  const englishOf = new Map();
  for (const line of input.links) {
    const [cmn, eng] = columns(line);
    if (!englishById.has(eng)) continue;
    if (!englishOf.has(cmn)) englishOf.set(cmn, []);
    englishOf.get(cmn).push(englishById.get(eng));
  }

  const otherScript = new Map();
  for (const line of input.transcriptions) {
    const [id, , script, , text] = columns(line);
    if (script === 'Hans' || script === 'Hant') otherScript.set(id, { script, text });
  }

  const natives = new Set();
  for (const line of input.userLanguages) {
    const [, value, username] = columns(line);
    if (username && Number(value) === NATIVE) natives.add(username);
  }

  const wrong = new Set();
  for (const line of input.tags) {
    const [id, name] = columns(line);
    if (WRONG_TAGS.has(name)) wrong.add(id);
  }

  const records = [];
  for (const line of input.sentences) {
    const [id, , text, owner] = columns(line);
    if (!natives.has(owner)) continue;
    const translations = englishOf.get(id);
    const other = otherScript.get(id);
    if (!translations || !other || wrong.has(id) || mixesScripts(text, scripts)) continue;
    // A sentence can have several English translations. The lowest id is the
    // oldest, and the choice must not change from one download to the next.
    const english = translations.reduce((a, b) => (Number(b.id) < Number(a.id) ? b : a));
    const written = other.script === 'Hant' ? 'simp' : 'trad';
    records.push({
      source: 'tatoeba',
      sourceId: id,
      written,
      simp: written === 'simp' ? text : other.text,
      trad: written === 'trad' ? text : other.text,
      english: english.text,
      owner,
      englishId: english.id,
      englishOwner: english.owner,
      origin: { chinese: 'human', english: 'human' },
    });
  }
  return records;
}

/** Compare two source ids: numerically where both are numbers. */
function compareIds(a, b) {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The text of the committed source file: its source, download date and
 * licence, then one record per line in a fixed order. A new download then
 * shows as a line diff in a pull request.
 */
function formatSourceFile({ source, downloaded, licence, records }) {
  const sorted = [...records].sort(
    (a, b) =>
      compareIds(a.sourceId, b.sourceId) ||
      compareText(a.simp ?? '', b.simp ?? '') ||
      compareText(a.trad ?? '', b.trad ?? '') ||
      compareText(a.english, b.english),
  );
  const head = JSON.stringify({ source, downloaded, licence }).slice(0, -1);
  const lines = sorted.map((record) => JSON.stringify(record));
  return `${head},"records":[\n${lines.join(',\n')}\n]}\n`;
}

module.exports = { LICENCE, scriptSets, tatoebaRecords, formatSourceFile };
