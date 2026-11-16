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
 *   character with no entry of its own, 㐫) and `search` (a list of
 *   "parent > part", for a part that the data names by another form with
 *   its parts in the same places: 𦰩, which the data calls 堇, in 難. The
 *   build looks for its parts by shape)
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
    search: new Set(labels.search ?? []),
    searchUsed: new Set(),
    cuts: [],
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
  return [leafPart(context, node.char, s, trail)];
}

/**
 * One named part with the strokes `s` of the top character, split as far as
 * the data goes. A part never stays whole because of its form:
 *
 * - When its own parts sit elsewhere in the parent, or the labels file lists
 *   it in `search`, the data names it by a form that the parent does not
 *   draw. The right side of 聯 is 丝 over 丱, which the data calls 絲, side
 *   by side. The build then looks for its parts by shape (shapeCut).
 * - Otherwise, or when the search finds no sure cut, its own split goes onto
 *   the paired strokes. A split under a name that is a little off is better
 *   than a part that stays whole.
 */
function leafPart(context, char, s, trail) {
  const part = makePart(context, char, s);
  if (trail.includes(char)) return part;
  const where = [...trail, char].join(' > ');
  const map = strokeMap(context, char, s, trail);
  if (!map) return part;
  const key = `${trail[trail.length - 1]} > ${char}`;
  const listed = context.search.has(key);
  if (listed) context.searchUsed.add(key);
  if (map.moved || listed) {
    const cut = shapeCut(context, s, trail[0], char);
    if (cut) {
      context.cuts.push(`${where}: ${cut.map((seg) => seg.c).join(' + ')}`);
      const inner = ordered(cut.map((seg) => leafPart(context, seg.c, seg.s, [...trail, char])));
      if (inner) part.p = inner;
      return part;
    }
  }
  if (map.otherShape || map.moved) {
    context.shapes.push(`${where}: the strokes have another shape`);
  }
  const split = splitOf(context, char, map.strokes, [...trail, char], map.extra);
  if (split) part.p = split;
  return part;
}

/**
 * How well a run of strokes must match a component for a sure cut: the mean
 * distance of its stroke ends, after both are scaled to the same size. The
 * cut of 聯 matches by 0.07 or less (幺 + 幺 + 丱), and 廿 + 口 + 夫 for the 𦰩
 * of 難 by 0.11 or less. At 0.09, 口 fails in 漢, and the cut becomes
 * 廿 + 冖 + 三 + 人.
 */
const CUT_TOLERANCE = 0.12;

/**
 * The cost of a rare component in the search, per stroke: 0.1 first, then
 * 0.3. A low cost finds the rare 丱 in 聯; a high cost finds 口 + 夫 in 難
 * where the low cost finds the rare 旲.
 */
const RARITY_COSTS = [0.1, 0.3];

/**
 * How much worse than the best fit another component may fit and still win
 * the tie-break, as a ratio: 夫 (0.076) wins over 夬 (0.063) in 漢, and 又
 * (0.040) does not win over 冂 (0.009) in 網.
 */
const TIE_RATIO = 1.5;

/** The decompositions that must use a component before a cut can use it: 丱 has 2, 刁 has 1. */
const MIN_USES = 2;

/** The cost of each run, so that a cut prefers fewer, larger components. */
const RUN_COST = 0.6;

/**
 * The components that a cut can use, by stroke count: each character that
 * a decomposition of the data uses, with 2 or more strokes and stroke ends.
 * `uses` is the number of decompositions that use it, at least MIN_USES.
 */
function componentsOf(context) {
  if (context.components) return context.components;
  const uses = new Map();
  for (const entry of context.entries.values()) {
    for (const ch of [...(entry.decomposition ?? '')]) uses.set(ch, (uses.get(ch) ?? 0) + 1);
  }
  const components = new Map();
  for (const [ch, n] of uses) {
    const own = context.strokeEnds[ch];
    if (!own || own.length < 2 || n < MIN_USES || !context.entries.has(ch)) continue;
    if (!components.has(own.length)) components.set(own.length, []);
    components.get(own.length).push({ c: ch, ends: normalisedEnds(own), uses: n });
  }
  context.components = components;
  return components;
}

/**
 * Cut the strokes `strokes` of the top character `topChar` into runs in stroke order,
 * each run drawn by one component. Gives the runs as `{ c, s }`, or null when
 * no cut is sure: each run must match its component within CUT_TOLERANCE, no
 * stroke may stay out of a run, and the cut must have 2 or more runs.
 */
function shapeCut(context, strokes, topChar, named) {
  const family = descendantsOf(context, named);
  const top = context.strokeEnds[topChar];
  if (!top || strokes.length < 4) return null;
  const ends = strokes.map((i) => top[i]);
  const components = componentsOf(context);
  for (const rarity of RARITY_COSTS) {
    const n = ends.length;
    const best = new Array(n + 1).fill(Infinity);
    const from = new Array(n + 1).fill(null);
    best[0] = 0;
    for (let j = 2; j <= n; j++) {
      for (let i = 0; i <= j - 2; i++) {
        if (best[i] === Infinity || j - i === n) continue;
        const inside = normalisedEnds(ends.slice(i, j));
        const fits = [];
        for (const component of components.get(j - i) ?? []) {
          const d = endDistances(component.ends, inside);
          if (d.max > SHAPE_TOLERANCE || d.mean > CUT_TOLERANCE) continue;
          fits.push({ c: component.c, uses: component.uses, mean: d.mean, score: d.mean + rarity / Math.sqrt(component.uses) });
        }
        if (fits.length === 0) continue;
        // Of the components that fit about as well as the best, one of the
        // parts that the data gives the named part (月, not ⺼, in the 明 of
        // 厭), then the most used one (夫, not the rarer 夬, in 漢).
        const closest = Math.min(...fits.map((fit) => fit.mean));
        const rank = (fit) => [family.has(fit.c) ? 1 : 0, fit.uses, -fit.score];
        const match = fits
          .filter((fit) => fit.mean <= closest * TIE_RATIO + 0.005)
          .reduce((x, y) => {
            const [rx, ry] = [rank(x), rank(y)];
            const k = rx.findIndex((v, n) => v !== ry[n]);
            return k !== -1 && ry[k] > rx[k] ? y : x;
          });
        const cost = best[i] + RUN_COST + match.score * (j - i);
        if (cost < best[j]) {
          best[j] = cost;
          from[j] = [i, match.c];
        }
      }
    }
    if (best[n] === Infinity) continue;
    const cut = [];
    for (let j = n; j > 0; ) {
      const [i, c] = from[j];
      cut.unshift({ c, s: strokes.slice(i, j) });
      j = i;
    }
    return cut;
  }
  return null;
}

/** Every character in the decomposition of `char`, at any depth. */
function descendantsOf(context, char, found = new Set()) {
  for (const ch of [...(context.entries.get(char)?.decomposition ?? '')]) {
    if (found.has(ch) || !context.entries.has(ch)) continue;
    found.add(ch);
    descendantsOf(context, ch, found);
  }
  return found;
}

/** The largest and the mean distance between the ends of paired normalised strokes. */
function endDistances(a, b) {
  let max = 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    for (let e = 0; e < 2; e++) {
      const d = Math.hypot(a[i][e][0] - b[i][e][0], a[i][e][1] - b[i][e][1]);
      max = Math.max(max, d);
      sum += d;
    }
  }
  return { max, mean: sum / (2 * a.length) };
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
 * size, before the build looks for its parts by shape. Measured on the HSK
 * characters: a reduced or side form scores 0.12 or less (攸 in 修, 矦 in 候,
 * 车 in 输). A form whose parts sit elsewhere scores 0.19 or more: 絲 for the
 * 丝 over 丱 of 聯 (0.26), 柬 in 练 (0.19), 昜 in 杨 (0.21), 監 in 覽 (0.23).
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
  const unusedSearch = [...context.search].filter((key) => !context.searchUsed.has(key)).sort();
  return {
    files,
    missing,
    mismatches: context.mismatches,
    shapes: context.shapes,
    cuts: context.cuts,
    unusedSearch,
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
