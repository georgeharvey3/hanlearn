/**
 * The component breakdown of a character (#527, #528): the tree of its parts,
 * the strokes of each part, the meaning clue and the sound clue, and a label
 * for each part. The source is Make Me a Hanzi (`dictionary.txt`), the data
 * behind Hanzi Writer. buildBreakdowns is pure: it reads and writes no file.
 * build-dictionary.js reads the sources and writes one breakdown file for
 * each HSK character.
 *
 * The tree follows three rules:
 *
 * - A group with no name of its own is not a step. Its pieces join the split
 *   directly (疑 = 匕 + 矢 + ？ + 疋). A group that is a real character stays a
 *   step (㐫 in 脑).
 * - Splitting stops at a building block with a label (口, 匕, 矢), so 口
 *   never splits into 冂 + 一. The stop list is the labels file.
 * - An unnamed piece never blocks a split. It is a part of its own with no
 *   label.
 */

/** The Ideographic Description Characters, with the number of their operands. */
const OPERATORS = {
  '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2,
  '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2,
};

/** The mark of an unnamed piece in a Make Me a Hanzi decomposition. */
const UNNAMED = '？';

/** The role of a part in the etymology of its parent. */
const ROLE = { semantic: 'meaning', phonetic: 'sound' };

/**
 * The tree of an Ideographic Description Sequence. A leaf is `{ char }`, with
 * `char` null for an unnamed piece; a group is `{ op, children, ids }`, where
 * `ids` is the text of the group. Throws on a malformed sequence.
 */
function parseIds(ids) {
  const chars = [...ids];
  let i = 0;
  const read = () => {
    if (i >= chars.length) throw new Error(`malformed decomposition: ${ids}`);
    const start = i;
    const c = chars[i++];
    if (!(c in OPERATORS)) return { char: c === UNNAMED ? null : c };
    const children = [];
    for (let n = 0; n < OPERATORS[c]; n++) children.push(read());
    return { op: c, children, ids: chars.slice(start, i).join('') };
  };
  const tree = read();
  if (i !== chars.length) throw new Error(`malformed decomposition: ${ids}`);
  return tree;
}

/** Parse the lines of `dictionary.txt` into a map from each character to its entry. */
function parseMakeMeAHanzi(text) {
  const entries = new Map();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const entry = JSON.parse(line);
    entries.set(entry.character, entry);
  }
  return entries;
}

/**
 * The character of each decomposition that only one entry has and that holds
 * no unnamed piece. A group with this text is that character (#527: 㐫).
 */
function groupNamesOf(entries) {
  const names = new Map();
  const shared = new Set();
  for (const [char, entry] of entries) {
    const ids = entry.decomposition;
    if (!ids || [...ids].length < 3 || ids.includes(UNNAMED)) continue;
    if (names.has(ids)) shared.add(ids);
    else names.set(ids, char);
  }
  for (const ids of shared) names.delete(ids);
  return names;
}

/** The first sense of a definition: "culprit; murder; bad, sad" gives "culprit". */
const firstSense = (definition) => {
  if (!definition) return null;
  const sense = definition.split(/[;,]/)[0].replace(/\([^)]*\)/g, '').trim();
  return sense === '' ? null : sense;
};

/**
 * The context of the build of all breakdowns.
 *
 * - `entries`: the Make Me a Hanzi map of parseMakeMeAHanzi
 * - `strokeCounts`: the number of strokes of each character in the Hanzi
 *   Writer stroke data
 * - `strokeEnds`: the first and last point of the median line of each stroke
 *   in the same data, `[x0, y0, x1, y1]`. Optional: with none, a part's shape
 *   is not checked
 * - `labels`: the labels file: `labels` (part to label; also the stop list),
 *   `groups` (a group's decomposition to the character it is) and `pieces`
 *   (a character to the names of its unnamed pieces, by path, "1.2")
 */
function breakdownContext({ entries, strokeCounts, strokeEnds = {}, labels = {} }) {
  const groupNames = groupNamesOf(entries);
  for (const [ids, char] of Object.entries(labels.groups ?? {})) groupNames.set(ids, char);
  return {
    entries,
    strokeCounts,
    strokeEnds,
    labels: labels.labels ?? {},
    pieces: labels.pieces ?? {},
    groupNames,
    mismatches: [],
  };
}

/** The label of a part: the labels file, then the first sense of its dictionary entry. */
function labelOf(context, char) {
  if (char === null) return null;
  if (context.labels[char]) return context.labels[char];
  return firstSense(context.entries.get(char)?.definition);
}

/**
 * Give each node of a decomposition the indices of its strokes. A stroke
 * whose match is null belongs to the one unnamed piece, or to the piece that
 * the labels file names in its place. With no such piece, or more than one,
 * the loose strokes are returned: they make a piece of their own.
 */
function annotate(tree, matches, pieceNames = {}) {
  const blanks = [];
  const walk = (node, path, above) => {
    node.strokes = matches.flatMap((match, i) =>
      match && match.length >= path.length && path.every((p, k) => match[k] === p) ? [i] : [],
    );
    if (node.children) {
      node.children.forEach((child, k) => walk(child, [...path, k], [...above, node]));
    } else if (node.char === null) {
      node.char = pieceNames[path.join('.')] ?? null;
      blanks.push([node, ...above]);
    }
  };
  walk(tree, [], []);
  const loose = matches.flatMap((match, i) => (match === null ? [i] : []));
  if (loose.length === 0 || blanks.length !== 1) return loose;
  for (const node of blanks[0]) node.strokes = [...node.strokes, ...loose].sort((a, b) => a - b);
  return [];
}

/**
 * The breakdown of one character: `{ c, p }`, where `p` is its parts, or
 * null when the character does not split. Each part is
 * `{ c, s, l, y?, r?, p? }`: the character (null for an unnamed piece), the
 * indices of its strokes in the top character, its label (null for an
 * unnamed piece), its pinyin, its role in its parent's etymology ('meaning'
 * or 'sound') and its own parts.
 *
 * Throws when the Hanzi Writer stroke data has no character, or disagrees on
 * the stroke count of the character, because every index of the file would
 * then point at the wrong stroke. A part whose strokes disagree with its own
 * stroke count does not split, and goes to `context.mismatches`: the data
 * often draws a reduced form (斤 holds a 下 of 2 strokes), and its own parts
 * cannot map onto the strokes of the parent.
 */
function breakdownOf(context, char) {
  const entry = context.entries.get(char);
  if (!entry) return { c: char, p: null };
  const count = context.strokeCounts[char];
  if (count === undefined) throw new Error(`${char}: no Hanzi Writer stroke data`);
  if (entry.matches.length !== count) {
    throw new Error(
      `${char}: Make Me a Hanzi gives ${entry.matches.length} strokes, Hanzi Writer ${count}`,
    );
  }
  const strokes = entry.matches.map((_, i) => i);
  return { c: char, p: splitOf(context, char, strokes, [char]) };
}

/**
 * The parts of a character whose strokes in the top character are `strokes`,
 * or null when it does not split. A part with a label is a building block,
 * and `partsOf` does not split it. The top character always splits: most
 * HSK characters (是, 道) are also a labelled part of another character.
 * `trail` holds the characters above it, so an entry that holds itself does
 * not loop.
 */
function splitOf(context, char, strokes, trail) {
  const entry = context.entries.get(char);
  if (!entry || !entry.decomposition || strokes.length < 2) return null;
  const tree = parseIds(entry.decomposition);
  if (!tree.children) return null;
  const loose = annotate(tree, entry.matches, context.pieces[char]);
  const top = (i) => strokes[i];
  const parts = tree.children.flatMap((child) => partsOf(context, child, top, trail));
  if (loose.length) parts.push({ c: null, s: loose.map(top), l: null });
  const etymology = entry.etymology ?? {};
  for (const part of parts) {
    for (const [key, role] of Object.entries(ROLE)) {
      if (part.c !== null && etymology[key] === part.c) part.r = role;
    }
  }
  return ordered(parts);
}

/** The parts with strokes, in the order of their first stroke; null for fewer than 2. */
function ordered(parts) {
  const kept = parts.filter((part) => part.s.length > 0);
  return kept.length > 1 ? kept.sort((a, b) => a.s[0] - b.s[0]) : null;
}

/**
 * The parts that one node of a decomposition gives. A leaf gives one part.
 * A group that is a real character gives one part, split by its own pieces;
 * any other group gives its pieces directly. `top` maps a stroke index of the
 * character whose decomposition this is to the top character.
 */
function partsOf(context, node, top, trail) {
  const s = node.strokes.map(top);
  if (node.children) {
    const name = context.groupNames.get(node.ids);
    if (!name || trail.includes(name)) {
      return node.children.flatMap((child) => partsOf(context, child, top, trail));
    }
    const part = makePart(context, name, s);
    if (
      strokesAgree(context, name, s.length, trail) &&
      !context.labels[name] &&
      shapesAgree(context, name, s, trail)
    ) {
      const inner = ordered(
        node.children.flatMap((child) => partsOf(context, child, top, [...trail, name])),
      );
      if (inner) part.p = inner;
    }
    return [part];
  }
  if (node.char === null) return [{ c: null, s, l: null }];
  const part = makePart(context, node.char, s);
  if (
    !trail.includes(node.char) &&
    strokesAgree(context, node.char, s.length, trail) &&
    !context.labels[node.char] &&
    shapesAgree(context, node.char, s, trail)
  ) {
    const split = splitOf(context, node.char, s, [...trail, node.char]);
    if (split) part.p = split;
  }
  return [part];
}

/** One part with no parts of its own yet. */
function makePart(context, char, strokes) {
  const part = { c: char, s: strokes, l: labelOf(context, char) };
  const pinyin = context.entries.get(char)?.pinyin?.[0];
  if (pinyin) part.y = pinyin;
  return part;
}

/**
 * Whether the strokes that the data gives a part agree with the part's own
 * stroke count. Records a disagreement in `context.mismatches`.
 */
function strokesAgree(context, char, given, trail) {
  const count = context.strokeCounts[char] ?? context.entries.get(char)?.matches.length;
  if (count === undefined || count === given) return true;
  context.mismatches.push(`${[...trail, char].join(' > ')}: ${given} strokes, the stroke data ${count}`);
  return false;
}

/**
 * How far, at most, the end of a stroke of a part in its parent may lie from
 * the same end of the part alone, in units of the spread of the part's stroke
 * ends. Measured on all of Make Me a Hanzi: the 堇 of 僅 and 勤 scores 0.17 or
 * less, and the variant 𦰩 that the data calls 堇 in 難 and 漢 scores 0.42 or
 * more. At 0.35, 1.9% of the parts that split stop, and nearly all of them are
 * a real change of form (算 in 篡, 既 in 廄). The rest are a part stretched
 * by its parent: a step less, never a wrong part.
 */
const SHAPE_TOLERANCE = 0.35;

/**
 * The stroke ends of a set of strokes, centred on their mean and scaled by
 * their spread on each axis. A part drawn narrow or short in its parent then
 * has the same ends as the part alone.
 */
function normalisedEnds(ends) {
  const points = ends.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x1, y1]]);
  const mean = (k) => points.reduce((sum, p) => sum + p[k], 0) / points.length;
  const spread = (k, mu) =>
    Math.max(Math.sqrt(points.reduce((sum, p) => sum + (p[k] - mu) ** 2, 0) / points.length), 1);
  const [mx, my] = [mean(0), mean(1)];
  const [sx, sy] = [spread(0, mx), spread(1, my)];
  return ends.map(([x0, y0, x1, y1]) => [
    [(x0 - mx) / sx / 4, (y0 - my) / sy / 4],
    [(x1 - mx) / sx / 4, (y1 - my) / sy / 4],
  ]);
}

/**
 * Whether the strokes `strokes` of the top character have the shape of the
 * part `char` alone. The data can name a part by a character whose form is
 * not the one drawn: the left side of 難 is 𦰩, which the data calls 堇, and
 * the split of 堇 would show 土 for the 大 of 𦰩. The stroke count is the same,
 * so only the shape shows it. Records a disagreement in `context.mismatches`.
 */
function shapesAgree(context, char, strokes, trail) {
  const own = context.strokeEnds[char];
  const top = context.strokeEnds[trail[0]];
  if (!own || !top || own.length !== strokes.length) return true;
  const inside = normalisedEnds(strokes.map((i) => top[i]));
  const alone = normalisedEnds(own);
  const far = inside.some((ends, i) =>
    ends.some((p, k) => Math.hypot(p[0] - alone[i][k][0], p[1] - alone[i][k][1]) > SHAPE_TOLERANCE),
  );
  if (!far) return true;
  context.mismatches.push(`${[...trail, char].join(' > ')}: the strokes have another shape`);
  return false;
}

/** The name of the breakdown file of a character: its code point in hex, "7919" for 礙. */
const breakdownFileName = (char) => char.codePointAt(0).toString(16);

/**
 * The breakdown file of each character of `chars` that Make Me a Hanzi has.
 * Gives the files by name, the characters with no data, the parts whose
 * strokes disagree with their own stroke count, and the part characters that
 * no source gives a label (⺈ has no definition): the labels file needs them.
 * Also gives the labels of parts that are in no tree (`unused`): a typo, or a
 * part that only shows inside a part that a label stops. `fallback` gives the
 * parts that the labels file does not label: they show the dictionary's first
 * sense, or no label.
 */
function buildBreakdowns({ chars, entries, strokeCounts, strokeEnds, labels }) {
  const context = breakdownContext({ entries, strokeCounts, strokeEnds, labels });
  const files = {};
  const missing = [];
  const unlabelled = new Set();
  const fallback = new Set();
  const seen = new Set();
  const collect = (parts) => {
    for (const part of parts ?? []) {
      if (part.c !== null) seen.add(part.c);
      if (part.c !== null && part.l === null) unlabelled.add(part.c);
      if (part.c !== null && !context.labels[part.c]) fallback.add(part.c);
      collect(part.p);
    }
  };
  for (const char of [...new Set(chars)].sort()) {
    if (!entries.has(char)) {
      missing.push(char);
      continue;
    }
    const breakdown = breakdownOf(context, char);
    collect(breakdown.p);
    files[breakdownFileName(char)] = breakdown;
  }
  const unused = Object.keys(context.labels).filter((char) => !seen.has(char)).sort();
  return {
    files,
    missing,
    mismatches: context.mismatches,
    unlabelled: [...unlabelled].sort(),
    fallback: [...fallback].sort(),
    unused,
  };
}

module.exports = {
  breakdownContext,
  breakdownFileName,
  buildBreakdowns,
  breakdownOf,
  firstSense,
  groupNamesOf,
  parseIds,
  parseMakeMeAHanzi,
};
