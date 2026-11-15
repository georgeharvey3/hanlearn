/**
 * The pure rules of clean-saved-meanings.js (#488): which userWords documents
 * take the clean meaning of their dictionary entry.
 *
 * A userWords document ID is the ID of its dictionary entry. The plan sets
 * `wordData.meaning` to the clean meaning of that entry. It never reads or
 * changes `amendedMeaning`, the learner's own text.
 */

/**
 * The plan of the migration.
 *
 * Inputs:
 *   docs        [{ path, id, data }]: the userWords documents
 *   dictionary  the entries of dictionary.json: { id, simp, trad, pinyin, meaning }
 *
 * Returns { updates, unchanged, missing }:
 *   updates    [{ path, simp, from, to }]: the documents whose meaning changes
 *   unchanged  the count of documents that already hold the clean meaning
 *   missing    [{ path, simp, reason }]: the documents with no matching entry,
 *              which the migration does not change
 */
function planMeaningUpdates(docs, dictionary) {
  const byId = new Map(dictionary.map((entry) => [String(entry.id), entry]));
  const updates = [];
  const missing = [];
  let unchanged = 0;
  for (const { path, id, data } of docs) {
    const word = data?.wordData;
    const simp = word?.simp ?? '';
    const entry = byId.get(String(id));
    if (!entry) {
      missing.push({ path, simp, reason: 'no dictionary entry with this ID' });
      continue;
    }
    if (!word || entry.simp !== word.simp || entry.trad !== word.trad || entry.pinyin !== word.pinyin) {
      missing.push({ path, simp, reason: `the entry with this ID is ${entry.simp} [${entry.pinyin}]` });
      continue;
    }
    if (word.meaning === entry.meaning) {
      unchanged++;
      continue;
    }
    updates.push({ path, simp, from: word.meaning, to: entry.meaning });
  }
  return { updates, unchanged, missing };
}

module.exports = { planMeaningUpdates };
