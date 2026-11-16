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
 * - A label never stops a split. Each part splits as far as the data goes,
 *   so 賣 in 續 splits into 士 + 罒 + 貝, and 口 into 冂 + 一.
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
 * - `labels`: the labels file: `labels` (part to label; it never stops a split),
 *   `groups` (a group's decomposition to the character it is) and `pieces`
 *   (a character to the names of its unnamed pieces, by path, "1.2") and
 *   `names` (a part to `{ l, y }`: a label and pinyin for a group
 *   character with no entry of its own, 㐫) and `whole` (a list of
 *   "parent > part", for a part that the data names by another form: 𦰩,
 *   which the data calls 堇, in 難. Only these parts do not split)
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
    names: labels.names ?? {},
    whole: new Set(labels.whole ?? []),
    wholeUsed: new Set(),
    groupNames,
    mismatches: [],
    shapes: [],
  };
}

/** The label of a part: the labels file, then the first sense of its dictionary entry. */
function labelOf(context, char) {
  if (char === null) return null;
  if (context.labels[char]) return context.labels[char];
  if (context.names[char]) return context.names[char].l;
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
 * stroke count still splits: see strokeMap.
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
 * or null when it does not split. A label never stops a split: a part that
 * stays whole when it has parts of its own hides them from the learner, and
 * that is worse than a building block that splits into strokes (口 into
 * 冂 + 一). `trail` holds the characters above it, so an entry that holds
 * itself does not loop.
 */
function splitOf(context, char, strokes, trail, extra = []) {
  const entry = context.entries.get(char);
  if (!entry || !entry.decomposition) return null;
  if (strokes.filter((i) => i !== null).length + extra.length < 2) return null;
  const tree = parseIds(entry.decomposition);
  if (!tree.children) return null;
  const loose = annotate(tree, entry.matches, context.pieces[char]);
  const top = (i) => strokes[i];
  const parts = tree.children.flatMap((child) => partsOf(context, child, top, trail));
  const unnamed = [...loose.map(top).filter((i) => i !== null), ...extra].sort((a, b) => a - b);
  if (unnamed.length) parts.push({ c: null, s: unnamed, l: null });
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
  const s = node.strokes.map(top).filter((i) => i !== null);
  if (node.children) {
    const name = context.groupNames.get(node.ids);
    if (!name || trail.includes(name)) {
      return node.children.flatMap((child) => partsOf(context, child, top, trail));
    }
    // The pieces of a group come from the parent's own decomposition, so
    // they always map onto the right strokes, whatever form the group takes.
    const part = makePart(context, name, s);
    const inner = ordered(
      node.children.flatMap((child) => partsOf(context, child, top, [...trail, name])),
    );
    if (inner) part.p = inner;
    return [part];
  }
  if (node.char === null) return [{ c: null, s, l: null }];
  const part = makePart(context, node.char, s);
  if (trail.includes(node.char)) return [part];
  const key = `${trail[trail.length - 1]} > ${node.char}`;
  if (context.whole.has(key)) {
    context.wholeUsed.add(key);
    return [part];
  }
  const map = strokeMap(context, node.char, s, trail);
  if (!map) return [part];
  if (map.moved) {
    // The data names the part by a form whose own parts sit elsewhere: the
    // right side of 聯 is 丝 over 丱, which the data calls 絲, side by side.
    // Its split would put the wrong parts on the strokes.
    context.mismatches.push(`${[...trail, node.char].join(' > ')}: its parts sit elsewhere`);
    return [part];
  }
  if (map.otherShape) {
    // Only a report: a side form (足 in 跑) fails the check as often as a
    // wrong form, and a part that stays whole is worse than a split under a
    // name that is a little off. The labels file's `whole` stops a wrong form.
    context.shapes.push(`${[...trail, node.char].join(' > ')}: the strokes have another shape`);
  }
  const split = splitOf(context, node.char, map.strokes, [...trail, node.char], map.extra);
  if (split) part.p = split;
  return [part];
}

/** One part with no parts of its own yet. */
function makePart(context, char, strokes) {
  const part = { c: char, s: strokes, l: labelOf(context, char) };
  const pinyin = context.entries.get(char)?.pinyin?.[0] ?? context.names[char]?.y;
  if (pinyin) part.y = pinyin;
  return part;
}

/**
 * The strokes of the top character that draw each stroke of the part `char`,
 * from the strokes `given` that the data gives the part. Gives `strokes`, one
 * entry for each stroke of the part alone (null for a stroke that the parent
 * leaves out), `extra`, the given strokes that the part alone does not have,
 * and `otherShape`, true when the given strokes do not have the shape of the
 * part alone. Gives null only when the stroke data cannot pair the strokes,
 * and records it in `context.mismatches`.
 *
 * The data often draws a part in a reduced or longer form: 斤 holds a 下 of
 * 2 strokes, and the 攸 of 修 has 6 strokes, not 7. The part still splits:
 * its strokes and the given strokes are paired by their shape, in stroke
 * order.
 */
function strokeMap(context, char, given, trail) {
  const count = context.strokeCounts[char] ?? context.entries.get(char)?.matches.length;
  const own = context.strokeEnds[char];
  const top = context.strokeEnds[trail[0]];
  const inside = top && given.map((i) => top[i]);
  if (count === undefined || count === given.length) {
    const paired = Boolean(own && inside && own.length === given.length);
    const otherShape = paired && !sameShape(own, inside);
    const moved = paired && partsMoved(context.entries.get(char), own, inside, own.map((_, i) => [i, i]));
    return { strokes: given, extra: [], otherShape, moved };
  }
  // A part that its parent leaves out completely has no strokes to split.
  if (given.length === 0) return null;
  if (!own || !inside || own.length !== count) {
    context.mismatches.push(`${[...trail, char].join(' > ')}: ${given.length} strokes, the stroke data ${count}`);
    return null;
  }
  const pairs = pairStrokes(own, inside);
  const strokes = own.map(() => null);
  for (const [a, b] of pairs) strokes[a] = given[b];
  const used = new Set(pairs.map(([, b]) => b));
  const otherShape = !sameShape(
    pairs.map(([a]) => own[a]),
    pairs.map(([, b]) => inside[b]),
  );
  const moved = partsMoved(context.entries.get(char), own, inside, pairs);
  return { strokes, extra: given.filter((_, b) => !used.has(b)), otherShape, moved };
}

/**
 * How far, at most, the centre of one part of a part may move between the
 * part alone and the part in its parent, after both are scaled to the same
 * size. Measured on the HSK characters: a reduced or side form scores 0.12
 * or less (攸 in 修, 矦 in 候, 车 in 输). A form whose parts sit elsewhere
 * scores 0.19 or more: 絲 for the 丝 over 丱 of 聯 (0.26), 柬 in 练 (0.19),
 * 昜 in 杨 (0.21), 監 in 覽 (0.23).
 */
const LAYOUT_TOLERANCE = 0.18;

/**
 * Whether the top-level parts of `entry` sit elsewhere in the parent than in
 * the part alone. `pairs` pairs the strokes of the part alone (`own`) with
 * the strokes in the parent (`inside`). The centre of each part is the mean
 * of the midpoints of its paired strokes.
 */
function partsMoved(entry, own, inside, pairs) {
  if (!entry) return false;
  const a = normalisedEnds(pairs.map(([i]) => own[i]));
  const b = normalisedEnds(pairs.map(([, j]) => inside[j]));
  const groups = new Map();
  pairs.forEach(([i], k) => {
    const group = entry.matches[i]?.[0];
    if (group === undefined) return;
    groups.set(group, [...(groups.get(group) ?? []), k]);
  });
  if (groups.size < 2) return false;
  const centre = (ends, ks) =>
    [0, 1].map((axis) => ks.reduce((sum, k) => sum + (ends[k][0][axis] + ends[k][1][axis]) / 2, 0) / ks.length);
  return [...groups.values()].some((ks) => {
    const [ca, cb] = [centre(a, ks), centre(b, ks)];
    return Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) > LAYOUT_TOLERANCE;
  });
}

/** The distance between the ends of two normalised strokes. */
const strokeDistance = (a, b) =>
  Math.hypot(a[0][0] - b[0][0], a[0][1] - b[0][1]) + Math.hypot(a[1][0] - b[1][0], a[1][1] - b[1][1]);

/**
 * Pair the strokes of a part alone (`own`) with the strokes that draw it in
 * its parent (`inside`), in stroke order, when the counts differ. Each stroke
 * of the shorter side pairs with one stroke of the longer side. The pairing
 * has the smallest sum of distances between stroke ends. The ends are scaled
 * again over the paired strokes only, and the pairing is made again, because
 * a missing stroke moves the centre and the spread of the rest.
 *
 * Gives `[ownIndex, insideIndex]` pairs.
 */
function pairStrokes(own, inside) {
  const flip = own.length < inside.length;
  const [long, short] = flip ? [inside, own] : [own, inside];
  const shortEnds = normalisedEnds(short);
  let pairs = null;
  for (let round = 0; round < 3; round++) {
    const scaled = pairs === null
      ? normalisedEnds(long)
      : long.map((_, i) => normalisedEndsAt(long, pairs, i));
    pairs = alignInOrder(long.length, short.length, (i, j) => strokeDistance(scaled[i], shortEnds[j]));
  }
  return pairs.map(([i, j]) => (flip ? [j, i] : [i, j]));
}

/**
 * The normalised ends of stroke `i` of `strokes`, scaled over the strokes of
 * the last pairing and the stroke itself.
 */
function normalisedEndsAt(strokes, pairs, i) {
  const set = [...new Set([...pairs.map(([k]) => k), i])].sort((a, b) => a - b);
  return normalisedEnds(set.map((k) => strokes[k]))[set.indexOf(i)];
}

/**
 * The pairing in order of `short` strokes with `long` strokes (short <= long)
 * that has the smallest sum of `cost(longIndex, shortIndex)`.
 */
function alignInOrder(long, short, cost) {
  const best = Array.from({ length: long + 1 }, () => new Array(short + 1).fill(Infinity));
  const back = Array.from({ length: long + 1 }, () => new Array(short + 1).fill(false));
  for (let i = 0; i <= long; i++) best[i][0] = 0;
  for (let i = 1; i <= long; i++) {
    for (let j = 1; j <= Math.min(i, short); j++) {
      const skip = best[i - 1][j];
      const take = best[i - 1][j - 1] + cost(i - 1, j - 1);
      if (take <= skip) {
        best[i][j] = take;
        back[i][j] = true;
      } else best[i][j] = skip;
    }
  }
  const pairs = [];
  for (let i = long, j = short; j > 0; i--) {
    if (back[i][j]) {
      pairs.unshift([i - 1, j - 1]);
      j--;
    }
  }
  return pairs;
}

/**
 * How far, at most, the end of a stroke of a part in its parent may lie from
 * the same end of the part alone, in units of the spread of the part's stroke
 * ends, before the build reports the part. Measured on all of Make Me a Hanzi:
 * the 堇 of 僅 and 勤 scores 0.17 or less, and the variant 𦰩 that the data
 * calls 堇 in 難 and 漢 scores 0.42 or more.
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
 * Whether two lists of paired strokes have the same shape: each end lies
 * within SHAPE_TOLERANCE of its partner, after both are scaled to the same
 * size. The data can name a part by a character whose form is not the one
 * drawn: the left side of 難 is 𦰩, which the data calls 堇, and its bottom is
 * 大, not the 土 of 堇. The stroke count is the same, so only the shape shows it.
 */
function sameShape(own, inside) {
  const a = normalisedEnds(own);
  const b = normalisedEnds(inside);
  return a.every((ends, i) =>
    ends.every((p, k) => Math.hypot(p[0] - b[i][k][0], p[1] - b[i][k][1]) <= SHAPE_TOLERANCE),
  );
}

/** The name of the breakdown file of a character: its code point in hex, "7919" for 礙. */
const breakdownFileName = (char) => char.codePointAt(0).toString(16);

/**
 * The breakdown file of each character of `chars` that Make Me a Hanzi has.
 * Gives the files by name, the characters with no data, the parts whose
 * strokes disagree with their own stroke count, and the part characters that
 * no source gives a label (⺈ has no definition): the labels file needs them.
 * Also gives the labels of parts that are in no tree (`unused`): a typo, or a
 * part that only shows inside a part that does not split. `fallback` gives the
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
      if (part.c !== null && !context.labels[part.c] && !context.names[part.c]) fallback.add(part.c);
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
  const unusedWhole = [...context.whole].filter((key) => !context.wholeUsed.has(key)).sort();
  return {
    files,
    missing,
    mismatches: context.mismatches,
    shapes: context.shapes,
    unusedWhole,
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
