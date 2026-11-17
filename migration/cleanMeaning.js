/**
 * The clean meaning of a CC-CEDICT entry (#488): the meaning without its
 * Chinese characters and its notes that are not meaning. The build applies it
 * once, so every screen and Cloud Function reads clean data.
 *
 * The rule, for each sense (the text between two "/"):
 *
 *   1. A pointer sense ("variant of X", "abbr. for X", "used in X", a bare
 *      X, ...) is replaced by the clean senses of its target: the entry with
 *      the forms and the pinyin that the pointer names. A pointer to a
 *      pointer is followed once more at most. A pointer with no target gives
 *      no sense.
 *   2. A parenthesis that holds a Chinese character or a pinyin reference
 *      goes: examples, measure words, pronunciations and usage notes. A sense
 *      that is only one such parenthesis keeps its English instead.
 *   3. A reference in the text (繁|简[pin1 yin1], 简[pin1 yin1], bare
 *      characters, [pin1 yin1]) goes, and the English around it stays. The
 *      words that only named it ("CL:", "also pr.", "see also", "same as")
 *      go with it.
 *   4. An empty sense goes.
 *
 * A sense with no Chinese stays as it is. Labels such as "(fig.)" and
 * "(literary)" stay, and so do classifier senses.
 */

/** A Chinese character, and the marks that CC-CEDICT writes inside a reference. */
const HAN_CHAR = '\\p{Script=Han}\\u3400-\\u9FFF〇・·，';
const HAN = new RegExp(`[${HAN_CHAR}]`, 'u');

/** A pinyin reference: "[pin1 yin1]". */
const PINYIN = '\\[[^\\]]*\\]';

/** One reference: 繁|简[pin1 yin1], 简[pin1 yin1], 繁|简 or 简. */
const REF = `[${HAN_CHAR}]+(?:\\|[${HAN_CHAR}]+)?(?:\\s?${PINYIN})?`;

/** A list of references: "X[...], Y[...] and Z[...]". */
const REFS = `${REF}(?:\\s*(?:,|;|\\band\\b|\\bor\\b|\\+)\\s*${REF})*`;

/**
 * The phrases of a pointer sense: the sense means what its target means. The
 * references follow the phrase, with at most a note in parentheses after them.
 */
const POINTER_PHRASE = [
  '(?:(?:old|erhua|japanese|erroneous|archaic|euphemistic|taiwan|ancient|obsolete|non-standard|dialectal|later|literary|modern|korean|traditional|unofficial|common|original|alternative)\\s+)*variant of',
  'erhua form of',
  'abbr\\. (?:for|of)',
  'see',
  'used in',
  'same as',
  'equivalent (?:of|to)',
  '(?:mandarin|dialectal|taiwan|single-character|cantonese) equivalent(?: of|:)',
  '(?:another|old|alternative|short|former|ancient|formal) (?:name|term) (?:for|of)',
  'now written',
  'used erroneously for',
  'interchangeable with',
].join('|');
const POINTER = new RegExp(
  `^\\s*(?:(?:${POINTER_PHRASE})\\s*:?\\s*)?(${REFS})\\s*(?:\\([^)]*\\))?\\s*[.,;]?\\s*$`,
  'iu',
);
const ONE_REF = new RegExp(REF, 'gu');

/** The mark of a removed reference, while the words around it are tidied. */
const MARK = '\u0001';

/**
 * The words that only introduce a reference. When the reference goes and
 * nothing follows it, these go with it: "author of 抱朴子" gives "author".
 */
const CONNECTOR_PHRASE = [
  'see(?: also)?',
  'cf\\.?',
  'compare',
  'also(?: written| called| known as| read| used| as)?',
  'abbr\\.(?: (?:to|for|of))?',
  'written(?: as)?',
  'same as',
  'similar to',
  'equivalent to',
  'synonym (?:of|for)',
  'used in',
  'used for',
  'contrasted with',
  'as opposed to',
  'e\\.g\\.?',
  'i\\.e\\.?',
  'as in',
  'such as',
  'notably',
  'namely:?',
  'acronym (?:from|for)',
  'CL:',
];

/** The single words that introduce a reference. Alone, they still mean something. */
const PREPOSITION = [
  'of',
  'for',
  'by',
  'as',
  'to',
  'from',
  'with',
  'in',
  'like',
  'than',
  'called',
  'named',
  'or',
  'and',
];
const CONNECTOR = [...CONNECTOR_PHRASE, ...PREPOSITION, `(?:${POINTER_PHRASE})`].join('|');

/** A list of marks: "M, M and M" is one mark. */
const MARK_LIST = new RegExp(`${MARK}(?:\\s*(?:,|;|\\band\\b|\\bor\\b|\\+|/)\\s*${MARK})+`, 'gu');

/** A mark with nothing after it but punctuation, and the words that introduce it. */
const TRAILING_MARK = new RegExp(
  `(?:\\s*\\b(?:${CONNECTOR})\\s*)*${MARK}(?:\\s*etc\\.?)?(?=\\s*(?:[,;.()"]|$))`,
  'giu',
);

/** The text that names a removed reference, and means nothing alone. */
const DANGLING = new RegExp(
  `^(?:${[...CONNECTOR_PHRASE, `(?:${POINTER_PHRASE})`].join('|')}|CL:?|(?:[\\w-]+ )?pr\\.)$`,
  'iu',
);

/** A measure-word note or a pronunciation note left after its references go. */
const CL_NOTE = /\bCL:[\s,;]*(?=$|[;)])/giu;
const PR_NOTE = /\b(?:(?:also|Taiwan|colloquial|Beijing|old|dialect(?:al)?|commonly|formerly|usually|literary|Cantonese|Tai-lo|Tw)\s+)*pr\.(?:\s*(?:,|or|and)\s*)*(?=$|[;),])/giu;

/** The most pointers that one sense follows: the pointer and one more. */
const MAX_DEPTH = 2;

/**
 * The parentheses of a text, outermost only, as [start, end] with end after
 * the ")". An unbalanced "(" runs to the end of the text.
 */
function parenthesesOf(text) {
  const spans = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === ')' && depth > 0) {
      depth--;
      if (depth === 0) spans.push([start, i + 1]);
    }
  }
  if (depth > 0) spans.push([start, text.length]);
  return spans;
}

/** True when a text holds a Chinese character or a pinyin reference. */
const holdsChinese = (text) => HAN.test(text) || /\[[^\]]*\]/.test(text);

/** Remove each parenthesis that holds a Chinese character or a pinyin reference. */
function withoutChineseParentheses(text) {
  let out = text;
  for (const [start, end] of parenthesesOf(text).reverse()) {
    if (holdsChinese(text.slice(start, end))) out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

/** The parts of a text divided by ";" outside parentheses. */
function partsOf(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
    else if (text[i] === ';' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Tidy the commas, spaces and quotes that a removed reference leaves. */
function tidy(text) {
  let out = text;
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(/\(\s*[,;:]*\s*\)/g, '')
      .replace(/""|''/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+([,;:.)])/g, '$1')
      .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
      .replace(/(?:,|;|:|\+)\s*(?=\)|$)/g, '')
      .replace(/(\()\s*(?:,|;|:)\s*/g, '$1')
      .replace(/^\s*(?:[,;:.]|\+)\s*/, '')
      .trim();
  }
  return out;
}

/** Remove the references of a text: steps 3 and 4, with no parenthesis left to remove. */
function withoutReferences(text) {
  let out = text.replace(new RegExp(REF, 'gu'), MARK).replace(new RegExp(PINYIN, 'g'), MARK);
  out = out.replace(MARK_LIST, MARK).replace(TRAILING_MARK, '').replaceAll(MARK, ' ');
  out = tidy(out.replace(CL_NOTE, '').replace(PR_NOTE, ''));
  return partsOf(out)
    .map((part) => tidy(part.replace(CL_NOTE, '').replace(PR_NOTE, '')))
    .filter((part) => part !== '' && !DANGLING.test(part) && !holdsChinese(part))
    .join('; ');
}

/** Clean one sense that is not a pointer: steps 2 to 4. */
function cleanText(text) {
  const sense = text.trim();
  if (!holdsChinese(sense)) return sense;
  const spans = parenthesesOf(sense);
  // A sense that is only a parenthesis is a note with no other meaning:
  // "(particle in old Chinese similar to 啊)". It keeps its English.
  if (spans.length === 1 && spans[0][0] === 0 && spans[0][1] === sense.length) {
    const inner = withoutReferences(withoutChineseParentheses(sense.slice(1, -1)));
    return inner === '' ? '' : `(${inner})`;
  }
  return withoutReferences(withoutChineseParentheses(sense));
}

/** The parts of a reference: { trad, simp, pinyin }, trad and pinyin undefined when it has none. */
function readRef(ref) {
  const match = ref.match(
    new RegExp(`^([${HAN_CHAR}]+)(?:\\|([${HAN_CHAR}]+))?(?:\\s?\\[([^\\]]*)\\])?$`, 'u'),
  );
  if (!match) return null;
  const [, first, second, pinyin] = match;
  return second === undefined
    ? { trad: undefined, simp: first, pinyin }
    : { trad: first, simp: second, pinyin };
}

/** The pinyin of a reference or an entry, in one spelling: "lu : 3" is "lu:3". */
const pinyinKey = (pinyin) => pinyin.toLowerCase().replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ').trim();
const toneless = (pinyin) => pinyinKey(pinyin).replace(/\d/g, '');

/**
 * The entries that a reference names: the same forms and pinyin. A pinyin
 * that differs only in case, spacing or tone also matches, when no exact
 * match exists. A reference with no pinyin names the first entry with its
 * forms. One form matches the simplified or the traditional.
 */
function targetsOf(ref, lookup, self) {
  const parsed = readRef(ref);
  if (!parsed) return [];
  const forms = lookup(parsed.simp).filter(
    (entry) =>
      entry !== self &&
      (parsed.trad === undefined
        ? entry.simp === parsed.simp || entry.trad === parsed.simp
        : entry.trad === parsed.trad && entry.simp === parsed.simp),
  );
  if (parsed.pinyin === undefined) return forms.slice(0, 1);
  for (const key of [(p) => p, pinyinKey, toneless]) {
    const matches = forms.filter((entry) => key(entry.pinyin) === key(parsed.pinyin));
    if (matches.length > 0) return matches;
  }
  return [];
}

/**
 * The clean senses of an entry, and the problems of its pointers: 'no target'
 * for a pointer with no target, 'too deep' for a pointer chain that stops.
 */
function cleanSenses(entry, lookup, depth, problems) {
  const senses = [];
  const add = (sense) => {
    if (sense !== '' && !senses.includes(sense)) senses.push(sense);
  };
  for (const raw of entry.meaning.split('/')) {
    // A pronunciation note before a pointer is not meaning: "Taiwan pr. used in X".
    const pointer = raw.replace(/^\s*(?:[\w-]+ )?pr\.\s*/, '').match(POINTER);
    if (!pointer) {
      add(cleanText(raw));
      continue;
    }
    if (depth >= MAX_DEPTH) {
      problems.push('too deep');
      continue;
    }
    const refs = pointer[1].match(ONE_REF);
    const targets = [...new Set(refs.flatMap((ref) => targetsOf(ref, lookup, entry)))];
    if (targets.length === 0) {
      problems.push('no target');
      continue;
    }
    for (const target of targets) {
      for (const sense of cleanSenses(target, lookup, depth + 1, problems)) add(sense);
    }
  }
  return senses;
}

/**
 * The clean meaning of one entry, its senses divided by "/", and the reason
 * when no sense is left.
 *
 * Inputs:
 *   entry   a CC-CEDICT entry: { trad, simp, pinyin, meaning }
 *   lookup  (form) => the entries whose simplified or traditional form is form
 *
 * Returns { meaning, reason }: reason is null when the meaning is not empty.
 */
function cleanEntry(entry, lookup) {
  const problems = [];
  const meaning = cleanSenses(entry, lookup, 0, problems).join('/');
  if (meaning !== '') return { meaning, reason: null };
  const reason = problems.includes('no target')
    ? 'pointer with no target'
    : problems.includes('too deep')
      ? 'pointer chain longer than 2 steps'
      : 'only Chinese or notes';
  return { meaning, reason };
}

/** The lookup of cleanEntry over a list of entries. */
function lookupOf(entries) {
  const byForm = new Map();
  for (const entry of entries) {
    for (const form of new Set([entry.simp, entry.trad])) {
      if (!byForm.has(form)) byForm.set(form, []);
      byForm.get(form).push(entry);
    }
  }
  return (form) => byForm.get(form) ?? [];
}

/** The clean meaning of one entry of a list of entries: see cleanEntry. */
const cleanMeaning = (entry, entries) => cleanEntry(entry, lookupOf(entries)).meaning;

/**
 * Clean every entry of the dictionary. Returns { words, emptied }: words with
 * the clean meaning (an entry with no sense left has the meaning ""), and one
 * row for each such entry, with its raw meaning and its reason.
 */
function cleanDictionary(entries) {
  const lookup = lookupOf(entries);
  const emptied = [];
  const words = entries.map((entry) => {
    const { meaning, reason } = cleanEntry(entry, lookup);
    if (reason) emptied.push({ entry, reason });
    return { ...entry, meaning };
  });
  return { words, emptied };
}

/** The check of the build: a Chinese character or a pinyin reference. */
const UNCLEAN = /[㐀-鿿]|\p{Script=Han}|\[[a-zA-Z:]+\d/u;
const isUnclean = (text) => UNCLEAN.test(text);

module.exports = { cleanDictionary, cleanEntry, cleanMeaning, isUnclean, lookupOf, UNCLEAN };
