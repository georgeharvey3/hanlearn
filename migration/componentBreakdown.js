/**
 * The component breakdown of a character (#527, #528): the tree of its parts,
 * the strokes of each part, the meaning clue and the sound clue, and a label
 * for each part. buildBreakdowns is pure: it reads and writes no file.
 * build-dictionary.js reads the sources and writes one breakdown file for
 * each HSK character.
 *
 * The build does not find a part by its shape, and it has no tolerance to
 * tune. It reads **definitions**. A definition gives one character, drawn
 * with a known number of strokes, as a list of parts, and it gives each part
 * its strokes. The sources are:
 *
 * - AnimCJK. Its "acjk" text gives the parts of a character in stroke order,
 *   with the stroke count of each part as that character draws it. It names
 *   a part by the form that the character has: 𢇇 in 聯, not 絲.
 * - Make Me a Hanzi (`dictionary.txt`), the data behind Hanzi Writer. Each
 *   entry gives one level of parts, and the part of each stroke.
 * - The definitions file, for the forms that neither source has.
 *
 * The tree follows five rules:
 *
 * - Every part splits until it is one stroke. A label never stops a split.
 * - A part takes the definition of its character that has the same number of
 *   strokes. A definition with another number of strokes is another form,
 *   and the part never takes it.
 * - The strokes of a part pair with the strokes of its definition in stroke
 *   order. Two strokes change places only on a proof: see strokesFor.
 * - A group with no name of its own is not a step. Its pieces join the split
 *   directly (覽 = 臣 + 𠂉 + 一 + 皿 + 見). The labels file can name a group.
 * - A part with no definition splits into its strokes. The build of the
 *   dictionary stops on such a part that has a name: the definitions file
 *   needs its definition.
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
 * The sources of a definition, in the order that a top character tries them.
 * The four AnimCJK sets come first: simplified and traditional Chinese, then
 * Japanese and Korean, which draw many traditional characters the same way.
 */
const SOURCES = ['file', 'hans', 'hant', 'ja', 'ko', 'makemeahanzi'];

/** The AnimCJK sets among the sources. */
const ANIMCJK_SETS = ['hans', 'hant', 'ja', 'ko'];

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

const isDigit = (c) => c !== undefined && c >= '0' && c <= '9';
const isLetter = (c) => c !== undefined && c >= 'a' && c <= 'z';
const ascending = (a, b) => a - b;

/**
 * Parse one AnimCJK "acjk" text: `續⿰糹.6賣15`. Gives `{ char, strokes, root,
 * irregular }`. `strokes` is the stroke count of the character. A node of the
 * tree is `{ c, alt?, s, kids, partial? }`:
 *
 * - `c`: the character of the node, null for a group with no name
 * - `alt`: a second character for the same node (the `~` mark)
 * - `s`: the indices of its strokes, in the stroke order of the character
 * - `kids`: its nodes, or null when the text gives a stroke count only
 * - `ids`: for a group, its text with no counts and no marks
 *
 * The text gives the strokes in order, so each count takes the next strokes.
 * These marks follow a character:
 *
 * - `.`: the radical. The build does not use it.
 * - `:`: the component is split, and other strokes come between its pieces
 *   (`可⿹丁:1口.3丁:1`). The pieces of one component join, wherever the text
 *   has them. A letter after the mark tells two such components apart. When
 *   the text does not split or name every piece, `kids` is null and
 *   `partial` holds the pieces.
 * - `::`: the strokes belong to two components (`臼.⿱𠀉:3彐:2𠀉::彐:1`).
 *
 * Some texts of the source do not follow the operand count of an operator:
 * `党⿳龸5兄⿱口3儿.2` has 2 operands, and `衣.亠2𧘇4` has no operator. The
 * strokes of each named node are still exact, because the counts are in
 * stroke order. The parser reads such a text and sets `irregular`. Throws
 * when a text has no stroke count where it needs one.
 */
function parseAcjk(text) {
  const cs = [...text];
  let i = 0;
  let next = 0;
  let irregular = false;
  const split = new Map(); // "char:letter" to the split component
  const pending = new Map(); // a component that an overlap made, with no place yet
  const open = []; // the characters of the nodes that the parser is inside

  const fail = (what) => {
    throw new Error(`${what} at ${i} in ${text}`);
  };
  const count = () => {
    let digits = '';
    while (isDigit(cs[i])) digits += cs[i++];
    if (digits === '') fail('stroke count expected');
    const s = [];
    for (let k = 0; k < Number(digits); k++) s.push(next++);
    return s;
  };
  const head = () => {
    const h = { c: null, alt: null, key: null, overlap: null, overlapKey: null };
    if (cs[i] === undefined) fail('component expected');
    if (cs[i] in OPERATORS || isDigit(cs[i])) return h;
    h.c = cs[i++];
    if (cs[i] === '~') {
      i++;
      h.alt = h.c;
      h.c = cs[i++];
      if (h.c === undefined) fail('character expected');
    }
    if (cs[i] === '.') i++;
    if (cs[i] === ':' && cs[i + 1] === ':') {
      i += 2;
      h.overlap = cs[i++];
      if (cs[i] === '.') i++;
      if (cs[i] !== ':') fail('split mark expected after an overlap');
    }
    if (cs[i] === ':') {
      i++;
      const letter = isLetter(cs[i]) ? cs[i++] : '';
      h.key = `${h.c}:${letter}`;
      if (h.overlap) h.overlapKey = `${h.overlap}:${letter}`;
    }
    return h;
  };
  // The body of a node: a count, a decomposition, or, after a split mark,
  // another component (`十:丨.1`).
  const body = (node, afterSplit) => {
    if (isDigit(cs[i])) {
      node.s = count();
      node.kids = null;
    } else if (cs[i] in OPERATORS) {
      const op = cs[i++];
      if (node.c !== null) open.push(node.c);
      node.op = op;
      node.kids = operands(OPERATORS[op]);
      if (node.c !== null) open.pop();
    } else if (afterSplit && cs[i] !== undefined) {
      const inner = item();
      node.kids = inner ? [inner] : [];
    } else fail('stroke count or decomposition expected');
    return node;
  };
  const component = (c, key) => {
    const node = { c, pieces: [] };
    split.set(key, node);
    return node;
  };
  // Read one component. Gives its node, or null when the component joined a
  // split component that the text opened before.
  const item = () => {
    const h = head();
    if (h.c === null) return body({ c: null }, false);
    const piece = body({ c: null }, h.key !== null);
    if (h.overlap) {
      let placed = null;
      const first = split.get(h.key);
      if (first) first.pieces.push(piece);
      else if (open.includes(h.c)) placed = piece;
      else {
        placed = component(h.c, h.key);
        placed.pieces.push(piece);
      }
      const second = split.get(h.overlapKey);
      if (second) second.pieces.push(piece);
      else if (!open.includes(h.overlap)) {
        const node = pending.get(h.overlap) ?? { c: h.overlap, pieces: [] };
        node.pieces.push(piece);
        pending.set(h.overlap, node);
      }
      return placed;
    }
    if (pending.has(h.c)) {
      // The component takes the strokes of an earlier overlap (介 in 养).
      const node = pending.get(h.c);
      pending.delete(h.c);
      node.pieces.push(piece);
      if (h.key !== null) split.set(h.key, node);
      return node;
    }
    if (h.key !== null) {
      const known = split.get(h.key);
      if (known) {
        known.pieces.push(piece);
        return null;
      }
      const node = component(h.c, h.key);
      node.pieces.push(piece);
      return node;
    }
    piece.c = h.c;
    if (h.alt) piece.alt = h.alt;
    return piece;
  };
  const operands = (n) => {
    const list = [];
    while (list.length < n) {
      if (i >= cs.length) {
        irregular = true;
        break;
      }
      const node = item();
      if (node) list.push(node);
    }
    return list;
  };

  const h = head();
  if (h.c === null || h.key !== null) fail('character expected');
  let root;
  if (isDigit(cs[i]) || cs[i] in OPERATORS) root = body({ c: h.c }, false);
  else {
    irregular = true;
    root = { c: h.c, kids: [] };
  }
  while (i < cs.length) {
    const node = item();
    if (!node) continue;
    irregular = true;
    if (root.kids === null) fail('text after the stroke count');
    root.kids.push(node);
  }
  if (pending.size) fail('overlap with no second component');

  // Give each node its strokes, and each split component its pieces.
  const finish = (node) => {
    if (node.pieces) {
      for (const piece of node.pieces) finish(piece);
      node.s = [...new Set(node.pieces.flatMap((piece) => piece.s))].sort(ascending);
      const whole = node.pieces.every((piece) => piece.kids !== null);
      node.kids = whole ? node.pieces : null;
      if (!whole) node.partial = node.pieces;
      delete node.pieces;
    } else if (node.kids) {
      for (const kid of node.kids) finish(kid);
      node.s = [...new Set(node.kids.flatMap((kid) => kid.s))].sort(ascending);
    }
    if (node.c === null && node.op) node.ids = node.op + node.kids.map((kid) => kid.c ?? kid.ids ?? UNNAMED).join('');
  };
  finish(root);
  if (root.s.length !== next) fail('strokes outside the character');
  return { char: h.c, strokes: next, root, irregular };
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
 * The parts of a list of parsed nodes. A group with no name is not a step:
 * its pieces join the list. A group that `groupNames` names is a part.
 * A part is `{ c, alt?, s, parts, partial? }`.
 */
function partsOfNodes(nodes, groupNames) {
  return nodes.flatMap((node) => {
    const name = node.c ?? (node.ids ? groupNames.get(node.ids) : undefined) ?? null;
    if (name === null) {
      if (node.kids) return partsOfNodes(node.kids, groupNames);
      return node.s.length ? [{ c: null, s: node.s, parts: null }] : [];
    }
    const part = { c: name, s: node.s, parts: node.kids ? partsOfNodes(node.kids, groupNames) : null };
    if (node.alt) part.alt = node.alt;
    if (node.partial) part.partial = partsOfNodes(node.partial, groupNames);
    return [part];
  });
}

/** The definition that an acjk text gives: `{ char, source, strokes, parts, irregular, text }`. */
function acjkDefinition(text, source, groupNames) {
  const parsed = parseAcjk(text);
  return {
    char: parsed.char,
    source,
    strokes: parsed.strokes,
    parts: parsed.root.kids ? partsOfNodes(parsed.root.kids, groupNames) : null,
    irregular: parsed.irregular,
    text,
  };
}

/**
 * The definition that a Make Me a Hanzi entry gives: its decomposition, with
 * the strokes that `matches` gives each piece. The strokes of no piece make
 * one unnamed part. Gives null for an entry with no decomposition.
 */
function makeMeAHanziDefinition(entry, groupNames) {
  if (!entry.decomposition) return null;
  const tree = parseIds(entry.decomposition);
  const definition = {
    char: entry.character,
    source: 'makemeahanzi',
    strokes: entry.matches.length,
    parts: null,
    irregular: false,
    text: entry.decomposition,
  };
  if (!tree.children) return definition;
  const walk = (node, path) => {
    const s = entry.matches.flatMap((match, i) =>
      match && match.length >= path.length && path.every((p, k) => match[k] === p) ? [i] : [],
    );
    if (!node.children) return { c: node.char, s, kids: null };
    return { c: null, ids: node.ids, s, kids: node.children.map((child, k) => walk(child, [...path, k])) };
  };
  const named = partsOfNodes(walk(tree, []).kids, groupNames).filter((part) => part.c !== null && part.s.length);
  const used = new Set(named.flatMap((part) => part.s));
  const loose = entry.matches.map((_, i) => i).filter((i) => !used.has(i));
  if (loose.length) named.push({ c: null, s: loose, parts: null });
  if (named.length > 1) definition.parts = named.sort((a, b) => a.s[0] - b.s[0]);
  return definition;
}

/**
 * The stroke of `reference` that each stroke of `own` is, when the two lists
 * draw the same character with the same strokes: `map[i]` is the index in
 * `reference` of stroke `i` of `own`. Each stroke is `[x0, y0, x1, y1]`, the
 * first and last point of its median line, and both lists use one coordinate
 * space. Gives null when the counts differ, or when the strokes do not pair
 * one to one: each stroke must be the nearest stroke of its partner.
 *
 * fetch-animcjk.js uses this to tell which AnimCJK drawings have the strokes
 * of the Hanzi Writer data, and in which order.
 */
function strokeOrder(own, reference) {
  if (own.length !== reference.length) return null;
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(a[2] - b[2], a[3] - b[3]);
  const nearest = (stroke, list) =>
    list.reduce((best, other, j) => (distance(stroke, other) < distance(stroke, list[best]) ? j : best), 0);
  const map = own.map((stroke) => nearest(stroke, reference));
  const back = reference.map((stroke) => nearest(stroke, own));
  return map.every((j, i) => back[j] === i) ? map : null;
}

/**
 * The context of the build of all breakdowns.
 *
 * - `entries`: the Make Me a Hanzi map of parseMakeMeAHanzi
 * - `strokeCounts`: the number of strokes of each character in the Hanzi
 *   Writer stroke data, which the app draws
 * - `strokeEnds`: the first and last point of the median line of each stroke
 *   in the same data, `[x0, y0, x1, y1]`, with y up. Optional: see strokesFor
 * - `animcjk`: the AnimCJK file that fetch-animcjk.js writes. `sets` gives the
 *   acjk text of each character of each set. `order` gives, for a character
 *   that the set does not draw with the strokes of Hanzi Writer in the same
 *   order, the Hanzi Writer stroke of each stroke, or null when the strokes
 *   differ. `meanings` gives `[definition, pinyin]` for a character that Make
 *   Me a Hanzi does not have
 * - `definitions`: the acjk texts of the definitions file. A text for a top
 *   character counts the strokes in the order of Hanzi Writer
 * - `labels`: the labels file: `labels` (part to label), `groups` (the text
 *   of a group to the character that it is) and `names` (a part to
 *   `{ l, y }`: a label and pinyin for a part that no source has an entry for)
 */
function breakdownContext({
  entries,
  strokeCounts,
  strokeEnds = {},
  animcjk = {},
  definitions = [],
  labels = {},
}) {
  const groupNames = groupNamesOf(entries);
  for (const [ids, char] of Object.entries(labels.groups ?? {})) groupNames.set(ids, char);
  const context = {
    entries,
    strokeCounts,
    strokeEnds,
    groupNames,
    order: animcjk.order ?? {},
    meanings: animcjk.meanings ?? {},
    labels: labels.labels ?? {},
    names: labels.names ?? {},
    definitions: new Map(),
    malformed: [],
    unresolved: new Set(),
    unnamed: new Set(),
    reordered: new Set(),
    strokeNames: new Map(),
    used: new Set(),
  };
  const add = (definition) => {
    if (!context.definitions.has(definition.char)) context.definitions.set(definition.char, []);
    context.definitions.get(definition.char).push(definition);
  };
  for (const text of definitions) add(acjkDefinition(text, 'file', groupNames));
  for (const set of ANIMCJK_SETS) {
    for (const [char, text] of Object.entries(animcjk.sets?.[set] ?? {})) {
      // A text that does not parse gives no definition. The build names it
      // only when a breakdown needs it: see `unresolved`.
      try {
        const definition = acjkDefinition(text, set, groupNames);
        if (definition.char !== char) throw new Error(`${text} is not ${char}`);
        add(definition);
      } catch (error) {
        context.malformed.push(`${set}: ${error.message}`);
      }
    }
  }
  for (const entry of entries.values()) {
    const definition = makeMeAHanziDefinition(entry, groupNames);
    if (definition) add(definition);
  }
  return context;
}

/** The label of a part: the labels file, then the first sense of a dictionary entry. */
function labelOf(context, char) {
  if (char === null) return null;
  if (context.labels[char]) return context.labels[char];
  if (context.names[char]) return context.names[char].l;
  return (
    firstSense(context.entries.get(char)?.definition) ?? firstSense(context.meanings[char]?.[0])
  );
}

/** The pinyin of a part, when a source has it. */
const pinyinOf = (context, char) =>
  context.entries.get(char)?.pinyin?.[0] ?? context.names[char]?.y ?? context.meanings[char]?.[1];

/**
 * The definition of `char` with `strokes` strokes that splits it. The source
 * of the parent comes first, because one source keeps one stroke order.
 */
function definitionOf(context, char, strokes, prefer) {
  const list = (context.definitions.get(char) ?? []).filter(
    (definition) => definition.strokes === strokes && definition.parts,
  );
  // Make Me a Hanzi stays last: it names a part by a form that has an entry,
  // and that is not always the form drawn.
  const rank = (definition) => {
    if (definition.source === prefer && ANIMCJK_SETS.includes(prefer)) return 0;
    return SOURCES.indexOf(definition.source);
  };
  return list.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * The definition that splits a top character, and the Hanzi Writer stroke of
 * each of its strokes. An AnimCJK definition counts the strokes of the
 * AnimCJK drawing. It applies only when that drawing has the strokes of Hanzi
 * Writer, and `order` gives their order. A definition of the file and a Make
 * Me a Hanzi entry count the strokes of Hanzi Writer. Gives null with no such
 * definition of the same stroke count.
 */
function topDefinition(context, char) {
  const count = context.strokeCounts[char];
  const identity = [...Array(count).keys()];
  for (const source of SOURCES) {
    const definition = (context.definitions.get(char) ?? []).find(
      (candidate) => candidate.source === source && candidate.strokes === count && candidate.parts,
    );
    if (!definition) continue;
    if (!ANIMCJK_SETS.includes(source)) return { definition, map: identity };
    const order = context.order[source]?.[char];
    if (order === null) continue;
    return { definition, map: order ?? identity };
  }
  return null;
}

/**
 * The breakdown of one character: `{ c, p }`, where `p` is its parts, or
 * null for a character of one stroke. Each part is `{ c, s, l, y?, r?, p? }`:
 * the character (null for a piece with no name), the indices of its strokes
 * in the top character, its label (null with no name), its pinyin, its role
 * in its parent's etymology ('meaning' or 'sound') and its own parts. Only a
 * part of one stroke has no parts.
 *
 * Throws when the Hanzi Writer stroke data has no character, because the
 * strokes of the file are the strokes of that data.
 */
function breakdownOf(context, char) {
  const count = context.strokeCounts[char];
  if (count === undefined) throw new Error(`${char}: no Hanzi Writer stroke data`);
  const top = topDefinition(context, char);
  if (top) context.used.add(top.definition);
  const strokes = [...Array(count).keys()];
  const node = { c: char, s: strokes, parts: top?.definition.parts ?? null };
  // The key of the top character is in the trail, so that it takes no
  // definition by its name: only topDefinition knows the stroke order.
  const key = `${char}/${count}`;
  const map = top ? strokesFor(context, char, key, top.definition, top.map) : strokes;
  const p = splitOf(context, char, node, map, top?.definition.source ?? null, [key]);
  return { c: char, p };
}

/**
 * The parts of `node`, or null for one stroke. `node.s` counts the strokes of
 * the definition that holds the node, and `map` gives the stroke of the top
 * character `top` for each stroke of that definition. `source` is the source
 * of that definition. `trail` holds the keys of the nodes above that took a
 * definition by name, so that no definition holds itself.
 *
 * The node splits by the first of these that exists: the parts that its
 * parent's definition gives it, the definition of its character with the same
 * number of strokes, the pieces of a split component, and its strokes.
 */
function splitOf(context, top, node, map, source, trail, clues = []) {
  if (node.s.length < 2) return null;
  let parts = node.parts;
  let from = source;
  let within = map;
  // The strokes of the node in the top character, in the stroke order of the node.
  const strokes = node.s.map((i) => map[i]);
  const key = node.c === null ? null : `${node.c}/${strokes.length}`;
  if (!parts && key !== null && !trail.includes(key)) {
    const definition = definitionOf(context, node.c, strokes.length, source);
    if (definition) {
      context.used.add(definition);
      parts = definition.parts;
      from = definition.source;
      within = strokesFor(context, top, key, definition, strokes);
    }
  }
  if (!parts && node.partial) parts = node.partial;
  const below = key === null || trail.includes(key) ? trail : [...trail, key];
  // A part that is the same strokes under another name is not a step.
  if (parts && parts.length === 1 && parts[0].s.length === strokes.length) {
    const inner = { ...parts[0], c: parts[0].c ?? node.c };
    return splitOf(context, top, inner, within, from, below, clues);
  }
  if (!parts) {
    if (node.c === null) context.unnamed.add(`${top} > a piece of ${strokes.length} strokes`);
    else context.unresolved.add(`${top} > ${key}`);
    parts = strokes.map((_, i) => ({ c: null, s: [i], parts: null }));
    within = strokes;
  }
  const own = cluesOf(context, node.c, strokes);
  return parts
    .map((part) => {
      const made = makePart(context, part, part.s.map((i) => within[i]));
      const role = roleOf(made, own, clues);
      if (role) made.r = role;
      const inner = splitOf(context, top, part, within, from, below, [...own, ...clues]);
      if (inner) made.p = inner;
      return made;
    })
    .sort((a, b) => a.s[0] - b.s[0]);
}

/**
 * The name of each stroke of a definition, where the definition splits down
 * to a named stroke: 一 and 丨 for the two strokes of 十. Null for a stroke
 * with no name.
 */
function strokeNamesOf(context, definition) {
  if (context.strokeNames.has(definition)) return context.strokeNames.get(definition);
  const names = new Array(definition.strokes).fill(null);
  // The list is in the map before the walk, so a definition that holds
  // itself reads the empty list and stops.
  context.strokeNames.set(definition, names);
  const walk = (parts, at) => {
    for (const part of parts) {
      if (part.s.length === 1) {
        names[at(part.s[0])] = part.c;
        continue;
      }
      // The same order as splitOf: the parts in place, a definition by
      // name, then the pieces of a split component.
      if (part.parts) {
        walk(part.parts, at);
        continue;
      }
      const inner = part.c === null ? null : definitionOf(context, part.c, part.s.length, definition.source);
      if (inner) strokeNamesOf(context, inner).forEach((name, i) => (names[at(part.s[i])] = name));
      else if (part.partial) walk(part.partial, at);
    }
  };
  walk(definition.parts, (i) => i);
  return names;
}

/**
 * Whether a stroke with the ends `[x0, y0, x1, y1]`, y up, can have the name.
 * Four names give a direction: 一 runs across, 丨 and 亅 run down, and 丿
 * runs down to the left. Any stroke can have another name.
 */
function strokeFits(name, ends) {
  const [dx, dy] = [ends[2] - ends[0], ends[3] - ends[1]];
  if (name === '一') return dx > 0 && Math.abs(dx) > Math.abs(dy);
  if (name === '丨' || name === '亅') return dy < 0 && Math.abs(dy) > Math.abs(dx);
  if (name === '丿') return dx < 0 && dy < 0;
  return true;
}

/**
 * The stroke of the top character for each stroke of a definition.
 * `strokes` holds the strokes in the order that the top character draws
 * them, and the definition counts the strokes in the order of its own
 * drawing. The two orders are the same in almost all parts, so stroke `i` of
 * the definition is `strokes[i]`.
 *
 * Two strokes change places only on a proof that both are in the wrong
 * place: neither one fits its own name, and each one fits the name of the
 * other. 里 draws the 田 at its top as 丨 𠃍 一 一 丨, and 田 alone is
 * 丨 𠃍 一 丨 一, so the 丨 and the last 一 of 田 each get the stroke of the
 * other. The nearest pairs go first, and a stroke is in one pair only.
 *
 * A pair inside one part of the definition does not change places here. The
 * order inside a part belongs to that part: it pairs its own strokes when
 * the build reaches it. The pair still counts, so neither stroke can pair
 * with a stroke of another part.
 *
 * One stroke that does not fit its name proves nothing. A source can name a
 * stroke loosely: AnimCJK calls the dot in 監 一. Such a stroke stays.
 */
function strokesFor(context, top, key, definition, strokes) {
  const ends = context.strokeEnds[top];
  if (!ends) return strokes;
  const names = strokeNamesOf(context, definition);
  const fits = (i, j) => strokeFits(names[i], ends[strokes[j]]);
  const wrong = strokes.map((_, i) => i).filter((i) => !fits(i, i));
  const pairs = wrong
    .flatMap((i) => wrong.filter((j) => j > i && fits(i, j) && fits(j, i)).map((j) => [i, j]))
    .sort((a, b) => a[1] - a[0] - (b[1] - b[0]) || a[0] - b[0]);
  const inOnePart = (i, j) => definition.parts.some((part) => part.s.includes(i) && part.s.includes(j));
  const paired = [...strokes];
  const taken = new Set();
  let moved = false;
  for (const [i, j] of pairs) {
    if (taken.has(i) || taken.has(j)) continue;
    taken.add(i).add(j);
    if (inOnePart(i, j)) continue;
    [paired[i], paired[j]] = [paired[j], paired[i]];
    moved = true;
  }
  if (!moved) return strokes;
  context.reordered.add(`${top} > ${key}`);
  return paired;
}

/** One part with no parts of its own yet. `s` holds its strokes in the top character. */
function makePart(context, part, s) {
  const made = { c: part.c, s: [...s].sort(ascending), l: labelOf(context, part.c) };
  if (made.l === null && part.alt) made.l = labelOf(context, part.alt);
  const pinyin = part.c === null ? undefined : pinyinOf(context, part.c) ?? (part.alt && pinyinOf(context, part.alt));
  if (pinyin) made.y = pinyin;
  return made;
}

/**
 * The clues of `char`: the part that gives its meaning and the part that
 * gives its sound, as Make Me a Hanzi names them. Each clue is
 * `{ char, role, strokes }`. `strokes` is the text of the strokes that the
 * Make Me a Hanzi entry gives the clue, in the top character, or null when
 * the entry does not count the strokes of the node or does not hold the clue.
 * `strokes` holds the strokes of the node, as in splitOf.
 */
function cluesOf(context, char, strokes) {
  const entry = char === null ? undefined : context.entries.get(char);
  if (!entry?.etymology) return [];
  const sets = new Map();
  if (entry.matches.length === strokes.length && entry.decomposition) {
    const walk = (node, path) => {
      const name = node.char ?? context.groupNames.get(node.ids);
      if (name && path.length) {
        const s = entry.matches.flatMap((match, i) =>
          match && match.length >= path.length && path.every((p, k) => match[k] === p) ? [strokes[i]] : [],
        );
        if (!sets.has(name)) sets.set(name, s.sort(ascending).join(','));
      }
      (node.children ?? []).forEach((child, k) => walk(child, [...path, k]));
    };
    walk(parseIds(entry.decomposition), []);
  }
  return Object.entries(ROLE).flatMap(([key, role]) => {
    const clue = entry.etymology[key];
    return clue ? [{ char: clue, role, strokes: sets.get(clue) ?? null }] : [];
  });
}

/**
 * The role of a part: 'meaning' or 'sound', or null. `own` holds the clues
 * of the character directly above the part, and `above` the clues of the
 * characters higher up. A part has the role of a clue of its parent when it
 * is that character. It has the role of any clue when it is the strokes that
 * Make Me a Hanzi gives the clue. So the 𧾷 of 跑 is the meaning clue that
 * the data calls 足, and the 心 of 德 keeps its role under 𢛳, which Make Me
 * a Hanzi does not have as a step.
 */
function roleOf(made, own, above) {
  if (made.c === null) return null;
  const strokes = made.s.join(',');
  const clue =
    own.find((c) => c.char === made.c || c.strokes === strokes) ??
    above.find((c) => c.strokes === strokes);
  return clue?.role ?? null;
}

/** The name of the breakdown file of a character: its code point in hex, "7919" for 礙. */
const breakdownFileName = (char) => char.codePointAt(0).toString(16);

/**
 * The breakdown file of each character of `chars` that has a definition.
 * Gives the files by name, and these lists for the build to print or stop on:
 *
 * - `missing`: the characters with no definition in any source
 * - `unresolved`: the named parts of 2 or more strokes that no definition
 *   splits, as "top > part/strokes". Each one splits into its strokes. The
 *   definitions file needs a definition for it
 * - `unnamed`: the pieces of 2 or more strokes with no name. Each one splits
 *   into its strokes
 * - `reordered`: the parts that the top character draws in another stroke
 *   order than the part alone: see strokesFor
 * - `irregular`: the acjk texts in use that do not follow the operand counts
 * - `sources`: the source of the definition of each top character, null for a
 *   character that no definition splits
 * - `unlabelled`: the part characters that no source gives a label
 * - `fallback`: the parts that the labels file does not label: they show the
 *   first sense of a dictionary, or no label
 * - `unused`: the labels of parts that are in no tree (a typo)
 * - `unusedDefinitions`: the texts of the definitions file that no breakdown
 *   uses
 */
function buildBreakdowns({ chars, entries, strokeCounts, strokeEnds, animcjk, definitions, labels }) {
  const context = breakdownContext({ entries, strokeCounts, strokeEnds, animcjk, definitions, labels });
  const files = {};
  const missing = [];
  const sources = {};
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
    if (!context.definitions.has(char)) {
      missing.push(char);
      continue;
    }
    sources[char] = topDefinition(context, char)?.definition.source ?? null;
    const breakdown = breakdownOf(context, char);
    collect(breakdown.p);
    files[breakdownFileName(char)] = breakdown;
  }
  const fileDefinitions = [...context.definitions.values()].flat().filter((d) => d.source === 'file');
  return {
    files,
    missing,
    sources,
    unresolved: [...context.unresolved].sort(),
    unnamed: [...context.unnamed].sort(),
    reordered: [...context.reordered].sort(),
    irregular: [...context.used].filter((d) => d.irregular).map((d) => `${d.source}: ${d.text}`).sort(),
    unlabelled: [...unlabelled].sort(),
    fallback: [...fallback].sort(),
    unused: Object.keys(context.labels).filter((char) => !seen.has(char)).sort(),
    unusedDefinitions: fileDefinitions.filter((d) => !context.used.has(d)).map((d) => d.text),
  };
}

/**
 * The composition text of one Wiktextract entry, or null. The Han char
 * template gives it as `ids`. Wiktextract keeps the arguments of only some
 * templates, so the text of the gloss is the second place to look: the
 * composition is its last field, `…, composition ⿰女子)`.
 */
function wiktionaryComposition(entry) {
  if (entry.pos !== 'character') return null;
  const template = (entry.head_templates ?? []).find((t) => t.name === 'Han char' && t.args?.ids);
  if (template) return template.args.ids;
  for (const sense of entry.senses ?? []) {
    for (const gloss of sense.glosses ?? []) {
      const match = /composition (.+)\)$/.exec(gloss);
      if (match) return match[1];
    }
  }
  return null;
}

/**
 * The operators of a Wiktionary composition: the Ideographic Description
 * Characters of Unicode 15.1 too, and ㇯, which takes one part away from another.
 */
const WIKTIONARY_OPERATORS = { ...OPERATORS, '⿼': 2, '⿽': 2, '⿾': 1, '⿿': 1, '㇯': 2 };

/**
 * The alternatives of a Wiktionary composition, as trees of `{ char }` and
 * `{ op, children }`. A composition can give more than one, each with an
 * optional list of regions: `⿰龺月 or ⿰龺⿵⺆⺀`, `⿱亽㇇(G) or ⿱亼㇇(HTJKV)`,
 * `⿱一二,⿱𠄟一`. A space before a list of regions or after a comma does not
 * count. Gives null when the text does not parse.
 */
function parseComposition(text) {
  const cs = [...text];
  const stop = new Set([undefined, '(', ')', ',', ' ']);
  let i = 0;
  const read = () => {
    const c = cs[i++];
    if (stop.has(c)) throw new Error(`malformed composition: ${text}`);
    if (!(c in WIKTIONARY_OPERATORS)) return { char: c };
    const children = [];
    for (let n = 0; n < WIKTIONARY_OPERATORS[c]; n++) children.push(read());
    return { op: c, children };
  };
  const alternatives = [];
  const space = () => {
    while (cs[i] === ' ' && cs.slice(i, i + 4).join('') !== ' or ') i += 1;
  };
  try {
    while (i < cs.length) {
      space();
      alternatives.push(read());
      space();
      if (cs[i] === '(') {
        const end = cs.indexOf(')', i);
        if (end < 0) return null;
        i = end + 1;
      }
      if (cs[i] === ',') i += 1;
      else if (cs.slice(i, i + 4).join('') === ' or ') i += 4;
      else if (i < cs.length) return null;
    }
  } catch {
    return null;
  }
  return alternatives.length ? alternatives : null;
}

/**
 * The forms of one part. Each group holds a full form, its side forms and
 * the code points of the same form in other blocks: the sources name the
 * meat radical 月 or ⺼, and the jade radical 王 or 𤣩. NFKC joins the
 * Kangxi Radicals block and the compatibility ideographs first.
 *
 * A group never joins two characters that both stand alone. 肉 and 月, or
 * 玉 and 王, stay apart, so that a breakdown that names the wrong one of
 * them is in the report.
 */
const SAME_PART = [
  '人亻𠆢⺅', '水氵氺⺡⺢', '手扌龵⺘', '心忄㣺⺗', '言讠訁⻈', '金钅釒', '食饣飠𩙿', '糸纟糹',
  '艸艹⺾⺿⻀', '辵辶⻌⻍⻎', '刀刂リ⺉', '犬犭⺨', '示礻⺬⺭', '衣衤⻂', '火灬⺣', '攴攵', '网罒',
  '爪爫⺤', '爿丬', '足𧾷⻊', '川巛', '襾覀', '牛牜', '王𤣩', '竹⺮𥫗', '羊𦍌⺶⺷', '長镸', '卩㔾',
  '歹歺', '月⺼', '雨⻗', '阝⻏⻖', '冂⺆', '小⺌⺍', '卜⺊', '彐⺕', '贝⻉', '车⻋', '长⻓',
  '门⻔', '页⻚', '风⻛', '飞⻜', '马⻢', '鱼⻥', '鸟⻦', '齐⻬', '齿⻮', '龙⻰', '龟⻳',
];
const FULL_FORM = new Map(SAME_PART.flatMap((forms) => [...forms].map((form) => [form, [...forms][0]])));

/** One name for each form of a part. A piece with no name matches no part. */
const samePart = (char) => {
  if (char === null) return UNNAMED;
  const form = char.normalize('NFKC');
  return FULL_FORM.get(form) ?? form;
};

/**
 * The top-level parts of a composition tree. A group is not a step, the same
 * rule as the tree: its parts join the list. A ㇯ group takes one part away
 * from another, so it is one part with no name, and it matches no part. A
 * tree of one character has no parts.
 */
const compositionParts = (tree) => {
  const parts = (node) => {
    if (node.op === '㇯') return [null];
    return node.op ? node.children.flatMap(parts) : [node.char];
  };
  return tree.op ? parts(tree) : [];
};

/**
 * Compare the top-level parts of each breakdown with the Wiktionary
 * composition of its character (#563). `breakdowns` holds `{ c, p }` as
 * breakdownOf gives it, and `compositions` the composition text of each
 * character. Gives:
 *
 * - `differences`: `{ char, parts, composition }` for each character whose
 *   parts match no alternative of its composition
 * - `absent`: the characters with no composition
 * - `malformed`: the characters whose composition does not parse
 */
function compareWithWiktionary(breakdowns, compositions) {
  // The parts of each alternative of the composition of a part, by its name.
  const splits = new Map();
  const splitsOf = (name) => {
    if (!splits.has(name)) {
      const trees = compositions[name] ? parseComposition(compositions[name]) ?? [] : [];
      splits.set(name, trees.map((tree) => compositionParts(tree).map(samePart)).filter((parts) => parts.length));
    }
    return splits.get(name);
  };
  const differences = [];
  const absent = [];
  const malformed = [];
  for (const { c: char, p } of breakdowns) {
    const composition = compositions[char];
    if (composition === undefined) {
      absent.push(char);
      continue;
    }
    const alternatives = parseComposition(composition);
    if (alternatives === null) {
      malformed.push(char);
      continue;
    }
    const parts = (p ?? []).map((part) => part.c);
    const same = alternatives.some((tree) => sameParts(parts.map(samePart), compositionParts(tree).map(samePart), splitsOf));
    if (!same) differences.push({ char, parts, composition });
  }
  return { differences, absent, malformed };
}

/**
 * Whether two lists of parts name the same strokes. The parts that both
 * lists hold cancel. Then a part splits into the parts of its own
 * composition when the other list holds one of them (劳 = 艹 冖 力 and
 * ⿱𫇦力, because 𫇦 = ⿱艹冖). The lists match when no part is left. The
 * number of splits has a limit, so a composition that holds its own
 * character stops there.
 */
const MAX_SPLITS = 32;

function sameParts(a, b, splitsOf) {
  const left = [[...a], [...b]];
  for (let round = 0; round < MAX_SPLITS; round++) {
    for (const part of [...left[0]]) {
      const j = left[1].indexOf(part);
      if (j >= 0) {
        left[1].splice(j, 1);
        left[0].splice(left[0].indexOf(part), 1);
      }
    }
    if (left[0].length === 0 && left[1].length === 0) return true;
    const split = () => {
      for (const [side, other] of [[0, 1], [1, 0]]) {
        for (const [i, part] of left[side].entries()) {
          const pieces = splitsOf(part).find((list) => list.some((piece) => left[other].includes(piece)));
          if (pieces) {
            left[side].splice(i, 1, ...pieces);
            return true;
          }
        }
      }
      return false;
    };
    if (!split()) return false;
  }
  return false;
}

module.exports = {
  breakdownContext,
  compareWithWiktionary,
  breakdownFileName,
  buildBreakdowns,
  breakdownOf,
  firstSense,
  groupNamesOf,
  parseAcjk,
  parseIds,
  parseMakeMeAHanzi,
  strokeOrder,
  wiktionaryComposition,
};
