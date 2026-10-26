/**
 * Resolve the premade lists of the catalogue to dictionary entries.
 *
 * Pure: build-dictionary.js reads the files and writes the result, so the
 * build that numbers the dictionary also writes the catalogue, and the two
 * cannot disagree.
 */

/** CC-CEDICT writes ü as u:, and the source writes it as ü. */
const samePinyin = (pinyin) => pinyin.toLowerCase().replace(/u:|ü/g, 'v');

/** CC-CEDICT capitalizes the pinyin of a proper noun. */
const isProperNoun = (entry) => /^[A-Z]/.test(entry.pinyin);

/**
 * The entries of one source word after the rules: the proper nouns go, then the
 * entries with another pinyin, then the ones with another traditional form.
 * Each rule applies only while more than one entry is left.
 *
 * If no entry is a common noun, the proper nouns stay. If no entry has the
 * pinyin of the source, the rules stop: the source and the dictionary disagree
 * on the reading, so the traditional form alone must not choose, and the
 * override table names the entry.
 */
function candidatesOf(word, entries) {
  const pinyins = new Set(word.forms.map((form) => samePinyin(form.pinyin)));
  const trads = new Set(word.forms.map((form) => form.trad));
  let left = entries;
  const common = left.filter((entry) => !isProperNoun(entry));
  if (common.length > 0) left = common;
  if (left.length > 1) {
    const sameReading = left.filter((entry) => pinyins.has(samePinyin(entry.pinyin)));
    if (sameReading.length === 0) return left;
    left = sameReading;
  }
  if (left.length > 1) {
    const sameForm = left.filter((entry) => trads.has(entry.trad));
    if (sameForm.length > 0) left = sameForm;
  }
  return left;
}

/**
 * The key of a source word in the override table: its simplified form and its
 * readings, for example "都 [du1|dou1]". A change to the readings in the source
 * changes the key, so the build asks a person again.
 */
const keyOf = (word) =>
  `${word.simp} [${[...new Set(word.forms.map((form) => form.pinyin))].join('|')}]`;

/** How the override table names an entry, for example "都 [dou1]". */
const nameOf = (entry) => `${entry.trad} [${entry.pinyin}]`;

/** The words of a source list that the override table does not exclude. */
const keptWords = (list, overrides) =>
  list.words.filter((word) => !overrides.exclude.includes(keyOf(word)));

/**
 * Turn the source lists into the catalogue: each word becomes one dictionary
 * entry. The override table names the entry of a word that the rules leave
 * ambiguous, and lists the words to leave out.
 *
 * Throws, naming every word that resolves to no entry or to more than one, and
 * every override that names no entry of its word.
 */
function resolveCatalogue(source, overrides, dictionary) {
  const bySimp = new Map();
  for (const entry of dictionary) {
    if (!bySimp.has(entry.simp)) bySimp.set(entry.simp, []);
    bySimp.get(entry.simp).push(entry);
  }
  const problems = [];

  const resolve = (word) => {
    const key = keyOf(word);
    const entries = bySimp.get(word.simp) ?? [];
    const chosen = overrides.choose[key];
    if (chosen !== undefined) {
      // An override can name any entry of the word, not only one the rules kept.
      const named = entries.filter((entry) => nameOf(entry) === chosen);
      if (named.length === 1) return named[0];
      problems.push(`${key}: the override "${chosen}" names ${named.length} entries`);
      return null;
    }
    const candidates = entries.length > 1 ? candidatesOf(word, entries) : entries;
    if (candidates.length === 1) return candidates[0];
    problems.push(
      candidates.length === 0
        ? `${key}: no entry`
        : `${key}: ${candidates.length} entries (${candidates.map(nameOf).join(', ')})`,
    );
    return null;
  };

  const catalogue = source.map((list) => ({
    id: list.id,
    name: list.name,
    entries: keptWords(list, overrides).map(resolve),
  }));

  // A table entry that matches no source word is stale: the source changed,
  // and a person decides again.
  const keys = new Set(source.flatMap((list) => list.words.map(keyOf)));
  for (const key of [...Object.keys(overrides.choose), ...overrides.exclude]) {
    if (!keys.has(key)) problems.push(`${key}: in the override table, but not in the source`);
  }

  if (problems.length > 0) {
    throw new Error(
      `${problems.length} words of the premade lists do not resolve to one dictionary entry.\n` +
        'Name the entry or exclude the word in migration/hsk/overrides.json:\n' +
        problems.map((problem) => `  ${problem}`).join('\n'),
    );
  }
  return catalogue;
}

/**
 * The frequency rank `q` of the source for each entry of the catalogue, by
 * entry id. The dictionary search ranks the HSK words by it (issue #425).
 * When two source words name one entry, the better rank wins.
 */
function ranksOf(source, overrides, catalogue) {
  const ranks = new Map();
  source.forEach((list, i) => {
    keptWords(list, overrides).forEach((word, j) => {
      const id = catalogue[i].entries[j].id;
      if (word.q !== undefined && !(ranks.get(id) <= word.q)) ranks.set(id, word.q);
    });
  });
  return ranks;
}

module.exports = { resolveCatalogue, ranksOf, keyOf };
