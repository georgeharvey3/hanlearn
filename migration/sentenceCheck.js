/**
 * The pure rules of the hand check of the Tatoeba credits (#485). A credit is
 * the gift of one shipped Tatoeba sentence to one HSK word. sentence-check.js
 * writes the unchecked credits in batches, a Claude Code session flags the bad
 * ones, and the finished batch goes into sentences/checked.json and
 * sentences/blocked.json. See sentences/CHECK.md.
 */

const BLOCK_SCOPES = ['credit', 'sentence'];

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The shipped Tatoeba credits that no pass checked, in the order of the pass:
 * the credits whose target is inside a longer CC-CEDICT word first, because
 * about 1 in 5 of them is bad. Then by sentence id and word.
 */
function uncheckedCredits(credits) {
  return credits
    .filter((credit) => !credit.checked)
    .sort(
      (a, b) =>
        (a.longer === null) - (b.longer === null) || compareText(a.id, b.id) || compareText(a.word, b.word),
    );
}

/**
 * Apply a finished batch. Every credit of the batch is checked. A credit with
 * `block: 'credit'` blocks the sentence for its word only, and one with
 * `block: 'sentence'` blocks the sentence for every word. Each block needs a
 * `reason`. The block entry keeps the text, so that a person can review it.
 *
 * Returns { checked, blocked, problems }. The caller writes nothing when
 * problems is not empty.
 */
function applyBatch(checked, blocked, batch) {
  const problems = [];
  const nextChecked = Object.fromEntries(Object.entries(checked).map(([id, words]) => [id, [...words]]));
  const nextBlocked = [...blocked];
  const keyOf = (entry) => `${entry.id}\n${entry.word ?? ''}`;
  const known = new Set(nextBlocked.map(keyOf));
  for (const credit of batch) {
    const name = `${credit.id} ${credit.word}`;
    if (credit.block !== undefined) {
      if (!BLOCK_SCOPES.includes(credit.block)) {
        problems.push(`${name}: block must be "credit" or "sentence", not "${credit.block}"`);
        continue;
      }
      if (typeof credit.reason !== 'string' || credit.reason.trim() === '') {
        problems.push(`${name}: a block needs a reason`);
        continue;
      }
      const entry =
        credit.block === 'credit'
          ? { id: credit.id, word: credit.word, reason: credit.reason.trim(), simp: credit.simp }
          : { id: credit.id, reason: credit.reason.trim(), simp: credit.simp };
      if (!known.has(keyOf(entry))) {
        known.add(keyOf(entry));
        nextBlocked.push(entry);
      }
    }
    nextChecked[credit.id] ??= [];
    if (!nextChecked[credit.id].includes(credit.word)) nextChecked[credit.id].push(credit.word);
  }
  for (const words of Object.values(nextChecked)) words.sort(compareText);
  return { checked: nextChecked, blocked: nextBlocked, problems };
}

/** The text of sentences/checked.json: one line for each sentence id. */
function formatChecked(checked) {
  const lines = Object.keys(checked)
    .sort(compareText)
    .map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify([...checked[id]].sort(compareText))}`);
  return `{\n  "credits": {\n${lines.join(',\n')}\n  }\n}\n`;
}

/** The text of sentences/blocked.json: one line for each entry. */
function formatBlocked(blocked) {
  if (blocked.length === 0) return '{\n  "entries": []\n}\n';
  const lines = [...blocked]
    .sort((a, b) => compareText(a.id, b.id) || compareText(a.word ?? '', b.word ?? ''))
    .map((entry) => `    ${JSON.stringify(entry)}`);
  return `{\n  "entries": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

module.exports = { applyBatch, formatBlocked, formatChecked, uncheckedCredits };
