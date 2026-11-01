/**
 * Turn the raw exports of each sentence source into source records.
 *
 * Pure: the fetch and export scripts download the files and write the result.
 * Every source gives the same record shape, so the build of example sentences
 * (#465) reads the committed copies of all sources in one way:
 *
 *   source        'tatoeba' | 'wiktionary' | 'sentenceCache'
 *   sourceId      the id of the sentence, or the page, in its source
 *   written       'simp' | 'trad': the script the source wrote the Chinese in
 *   simp, trad    the Chinese in each script, or null where the source has none
 *   english       the English translation
 *   owner         the person who wrote the Chinese, or null
 *   origin        { chinese, english }: 'human' or 'machine'
 *
 * Some sources add fields of their own: the Mandarin skill level of the owner
 * and the id and owner of the English sentence (Tatoeba), the page URL
 * (Wiktionary), and the `headword` (Wiktionary and sentenceCache).
 */

/** The Tatoeba tags that mark a sentence as wrong or doubtful. */
const WRONG_TAGS = new Set(['@needs native check', '@change', '@delete', '@wrong transliteration']);

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
 * The Tatoeba records: Mandarin sentences with a direct link to an English
 * sentence. Each input is the lines of one export file of the per-language
 * downloads: `sentences` (cmn_sentences_detailed), `links` (cmn-eng_links),
 * `english` (eng_sentences_detailed), `transcriptions` (cmn_transcriptions),
 * `tags` (cmn_tags) and `userLanguages` (cmn_user_languages).
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

  const levelOf = new Map();
  for (const line of input.userLanguages) {
    const [, value, username] = columns(line);
    if (username) levelOf.set(username, value === null ? null : Number(value));
  }

  const wrong = new Set();
  for (const line of input.tags) {
    const [id, name] = columns(line);
    if (WRONG_TAGS.has(name)) wrong.add(id);
  }

  const records = [];
  for (const line of input.sentences) {
    const [id, , text, owner] = columns(line);
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
      ownerLevel: owner ? (levelOf.get(owner) ?? null) : null,
      englishId: english.id,
      englishOwner: english.owner,
      origin: { chinese: 'human', english: 'human' },
    });
  }
  return records;
}

/**
 * The tags of a kaikki example that mark another variety than Mandarin, or a
 * classical text. Wiktionary gives Cantonese, Wu and Hokkien examples with
 * their own romanization in `roman`, so `roman` alone does not mark Mandarin.
 */
const NOT_MANDARIN_TAGS = new Set(['Cantonese', 'Guangzhou-Cantonese', 'Jyutping', 'Classical-Chinese']);
const NOT_MANDARIN_RAW_TAG = /Literary|Wugniu|Pe̍h-ōe-jī/;

/**
 * Hanyu Pinyin: Latin letters with the four tone marks, digits and
 * punctuation. The examples of the smaller varieties (Teochew, Hakka, Eastern
 * Min and others) carry no tag that the rule above knows, but their
 * romanizations use tone numbers in superscript or other diacritics.
 */
const PINYIN = /^[\sa-zA-Z0-9āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜ.,;:!?'"()[\]\-–—…/·・×“”‘’]*$/;

/** True when a kaikki example is a Mandarin usage example with a translation. */
function isMandarinExample(example) {
  if (example.type !== 'example' || !example.english || !example.text || !example.roman) {
    return false;
  }
  if ((example.tags ?? []).some((tag) => NOT_MANDARIN_TAGS.has(tag))) return false;
  if ((example.raw_tags ?? []).some((tag) => NOT_MANDARIN_RAW_TAG.test(tag))) return false;
  return PINYIN.test(example.roman.normalize('NFC'));
}

/** A Han character. */
const HAN = /\p{Script=Han}/u;

const scriptOf = (example) =>
  (example.tags ?? []).includes('Simplified-Chinese') ? 'simp' : 'trad';

/**
 * The Wiktionary records: the Mandarin usage examples of each page of kaikki's
 * Chinese JSONL, one line per page. Wiktionary gives an example as a
 * traditional record followed by its simplified record, with the same
 * romanization and English. It gives one record, without a simplified
 * partner, when the two forms are the same. The page is the source id,
 * because Wiktionary credits the authors of a page, not of an example.
 */
function wiktionaryRecords(lines) {
  const records = [];
  const seen = new Set();
  for (const line of lines) {
    const entry = JSON.parse(line);
    const word = entry.word;
    // A few pages are punctuation, such as " " or "( )". No segment can match them.
    if (!HAN.test(word)) continue;
    for (const sense of entry.senses ?? []) {
      const examples = (sense.examples ?? []).filter(isMandarinExample);
      for (let i = 0; i < examples.length; i++) {
        const first = examples[i];
        const next = examples[i + 1];
        const forms = { simp: null, trad: null };
        forms[scriptOf(first)] = first.text;
        if (
          next &&
          scriptOf(first) === 'trad' &&
          scriptOf(next) === 'simp' &&
          next.roman === first.roman &&
          next.english === first.english
        ) {
          forms.simp = next.text;
          i++;
        }
        const key = [word, forms.simp, forms.trad, first.english].join('\t');
        if (seen.has(key)) continue;
        seen.add(key);
        records.push({
          source: 'wiktionary',
          sourceId: word,
          written: forms.trad === null ? 'simp' : 'trad',
          simp: forms.simp,
          trad: forms.trad,
          english: first.english,
          owner: null,
          headword: word,
          url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Chinese`,
          origin: { chinese: 'human', english: 'human' },
        });
      }
    }
  }
  return records;
}

/**
 * The sentenceCache records. Each document of the collection is one word, with
 * the sentences that Gemini wrote for it in simplified Chinese. The source id
 * is the word and the position of the sentence.
 */
function cacheRecords(docs) {
  const records = [];
  for (const { id: word, data } of docs) {
    (data.sentences ?? []).forEach((sentence, index) => {
      if (!sentence.chinese || !sentence.english) return;
      records.push({
        source: 'sentenceCache',
        sourceId: `${word}#${index}`,
        written: 'simp',
        simp: sentence.chinese,
        trad: null,
        english: sentence.english,
        owner: null,
        headword: word,
        origin: { chinese: 'machine', english: 'machine' },
      });
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
 * The text of a committed source file: its source, download date and licence,
 * then one record per line in a fixed order. A new download then shows as a
 * line diff in a pull request.
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

module.exports = {
  scriptSets,
  tatoebaRecords,
  wiktionaryRecords,
  cacheRecords,
  formatSourceFile,
};
