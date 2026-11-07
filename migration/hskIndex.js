/**
 * The HSK index of the Dashboard's HSK coverage card (#271): one row for each
 * word of the premade lists, much smaller than the seven list files.
 *
 * Pure: build-dictionary.js writes the index next to the premade lists, then
 * checks the written files against each other.
 */

/**
 * The index of the catalogue. Each row is [id, simp, pinyin, list], where
 * `list` is the position of the word's premade list in `lists`.
 */
function hskIndexOf(catalogue) {
  return {
    lists: catalogue.map((list) => ({ id: list.id, name: list.name })),
    words: catalogue.flatMap((list, i) =>
      list.entries.map((entry) => [entry.id, entry.simp, entry.pinyin, i]),
    ),
  };
}

/**
 * Throws when the index does not agree with the premade lists: a row that
 * differs, a row too many or too few, or an entry in two lists. The card
 * counts each HSK word once, so an entry in two lists would count twice.
 */
function checkHskIndex(index, catalogue) {
  const problems = [];
  const expected = hskIndexOf(catalogue);
  if (JSON.stringify(index.lists) !== JSON.stringify(expected.lists)) {
    problems.push('the lists differ from the premade lists');
  }
  if (index.words.length !== expected.words.length) {
    problems.push(
      `${index.words.length} rows, but the premade lists have ${expected.words.length} words`,
    );
  }
  expected.words.forEach((row, i) => {
    if (JSON.stringify(index.words[i]) !== JSON.stringify(row)) {
      const list = catalogue[row[3]].id;
      problems.push(
        `${list}: row ${i} is ${JSON.stringify(index.words[i])}, not ${JSON.stringify(row)}`,
      );
    }
  });
  const seen = new Map();
  for (const [id, , , list] of expected.words) {
    if (seen.has(id) && seen.get(id) !== list) {
      problems.push(
        `entry ${id} is in two lists: ${catalogue[seen.get(id)].id} and ${catalogue[list].id}`,
      );
    }
    seen.set(id, list);
  }
  if (problems.length > 0) {
    throw new Error(
      'The HSK index does not agree with the premade lists:\n' +
        problems.map((problem) => `  ${problem}`).join('\n'),
    );
  }
}

module.exports = { hskIndexOf, checkHskIndex };
