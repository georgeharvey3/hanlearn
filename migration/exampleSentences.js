/**
 * Build the example sentence files from the committed generated sentences and
 * the committed sentences of native Mandarin writers on Tatoeba.
 *
 * Pure: build-dictionary.js reads the files, calls buildExampleSentences once,
 * and writes the result. The same inputs always give the same output, so a
 * deploy never changes the sentences by itself. The rules are in #465 under
 * "Grading" and "Output and storage", and in #482. One grader admits both
 * origins: see ADR 0020 and its amendment.
 */

const crypto = require('crypto');
const { LICENCE: TATOEBA_LICENCE } = require('./tatoeba');

/** The length cap of each HSK level, in Han characters and digits. HSK 7–9 has none. */
const LENGTH_CAPS = { 1: 10, 2: 12, 3: 15, 4: 18, 5: 25, 6: 25 };

/**
 * Each HSK word keeps this many sentences at most, and is filled when it has
 * them. A tunable target: 3 fills most HSK 1–3 words from Tatoeba and the
 * generated sentences (#482).
 */
const SENTENCE_TARGET = 3;

/**
 * A Tatoeba sentence with fewer Han characters than this is dropped. Most
 * shorter ones are fragments with no context (#482).
 */
const MIN_TATOEBA_HAN = 6;

/** The report counts the words with fewer sentences than this. */
const REPORT_FEW = 3;

/** A sentence file larger than this fails the build. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * A word that fails this many rounds of generation stays unfilled. A tunable
 * cap: three rounds fix most rejects, and a word that still fails needs a
 * person, not more candidates.
 */
const MAX_ROUNDS = 3;

/** The generator name of each record that acceptCandidates writes. */
const GENERATOR = 'claude-code';

/** The HSK level of a segment that is not an HSK word, a name or a number. */
const NOT_HSK = 7;

/** The variety rule skips a sentence that overlaps a picked one by more than this. */
const MAX_OVERLAP = 0.5;

const HAN = /\p{Script=Han}/u;
const DIGIT = /\p{Nd}/u;
/** A letter of any script other than Han. A sentence with one is rejected. */
const OTHER_LETTER = /(?!\p{Script=Han})\p{L}/u;
const NUMBER = /^(?:第?[零〇一二两三四五六七八九十百千万亿]+|\p{Nd}+)$/u;

/** The sense prefixes that the gloss rule skips. */
const SKIPPED_SENSE = /^(?:surname\b|variant of\b|old variant of\b|CL:|see\b)/i;
const STRIPPED_PREFIX = /^\((?:bound form|literary)\)\s*/;

/**
 * A gloss shows this many senses at most. A tunable cap: the first sense alone
 * showed 信 as "letter" in 我信过你 (#479), and more senses make a long gloss.
 */
const GLOSS_SENSES = 3;

/** CC-CEDICT capitalizes the pinyin of a proper noun. */
const isName = (entry) => /^[A-Z]/.test(entry.pinyin);

const TONE_MARKS = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};

/** One CC-CEDICT syllable, such as "lu:4", with its tone as a mark: "lǜ". */
function markSyllable(syllable) {
  const match = syllable.match(/^([a-zü:]+)([1-5])$/i);
  if (!match) return syllable.replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
  const letters = match[1].replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
  const tone = Number(match[2]);
  if (tone === 5) return letters;
  const lower = letters.toLowerCase();
  // The mark goes on a or e, then on the o of ou, then on the last vowel.
  let at = lower.search(/[ae]/);
  if (at === -1) at = lower.indexOf('ou');
  if (at === -1) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        at = i;
        break;
      }
    }
  }
  if (at === -1) return letters;
  const vowel = lower[at];
  let marked = TONE_MARKS[vowel][tone - 1];
  if (letters[at] !== vowel) marked = marked.toUpperCase();
  return letters.slice(0, at) + marked + letters.slice(at + 1);
}

/** CC-CEDICT pinyin with tone numbers, as pinyin with tone marks. */
const toneMarks = (pinyin) => pinyin.split(' ').map(markSyllable).join(' ');

/**
 * The parts of a text divided by ";" outside parentheses. One CC-CEDICT sense
 * often holds several, as in "(bound form) to walk; to go; to travel".
 */
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
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/** A sense without a leading label in parentheses. */
const bareSense = (sense) => sense.replace(/^\([^)]*\)\s*/, '');

/**
 * The short English of an entry: its first GLOSS_SENSES useful senses,
 * divided by "; ". A sense is one part of a CC-CEDICT sense (see partsOf), so
 * the learner never sees more than GLOSS_SENSES. A useful sense is not a
 * surname, a variant, a classifier, a cross-reference or a repeat. An entry with no
 * useful sense shows its first sense.
 */
function glossOf(entry) {
  const senses = entry.meaning.split('/').filter((sense) => sense.trim() !== '');
  const useful = [];
  for (const sense of senses) {
    if (SKIPPED_SENSE.test(sense.trim())) continue;
    for (const part of partsOf(sense.trim().replace(STRIPPED_PREFIX, ''))) {
      const gloss = part.replace(STRIPPED_PREFIX, '').trim();
      // A repeat is the same sense without its leading label: "(pronoun) this" and "this".
      const repeats = useful.some((known) => bareSense(known) === bareSense(gloss));
      if (gloss === '' || SKIPPED_SENSE.test(gloss) || repeats) continue;
      if (useful.length < GLOSS_SENSES) useful.push(gloss);
    }
  }
  return useful.length > 0 ? useful.join('; ') : (senses[0] ?? '').trim();
}

/** The normalized text of a sentence: the key of the id and of duplicate removal. */
const normalize = (text) => text.normalize('NFC').trim();

/** The first 10 hex characters of the SHA-1 of the normalized simplified text. */
const sentenceId = (simp) =>
  crypto.createHash('sha1').update(normalize(simp), 'utf8').digest('hex').slice(0, 10);

/** The length of a sentence for the cap: its Han characters and digits. */
const lengthOf = (text) => [...text].filter((c) => HAN.test(c) || DIGIT.test(c)).length;

/** The file of a word: the hex code point of its first character. */
const fileOf = (word) => word.codePointAt(0).toString(16);

/**
 * The index of the dictionary and the HSK lists that the splitter, the entry
 * choice and the grader read.
 */
function indexInputs(dictionary, hsk) {
  const bySimp = new Map();
  let longest = 1;
  for (const entry of dictionary) {
    if (!bySimp.has(entry.simp)) bySimp.set(entry.simp, []);
    bySimp.get(entry.simp).push(entry);
    longest = Math.max(longest, [...entry.simp].length);
  }
  // A word in two HSK lists takes the lower level, and the entry and rank of
  // that list.
  const hskBySimp = new Map();
  for (const word of hsk) {
    const known = hskBySimp.get(word.simp);
    if (!known || word.level < known.level) hskBySimp.set(word.simp, word);
  }
  const qById = new Map();
  for (const word of hsk) {
    if (word.q !== undefined && !(qById.get(word.entry.id) <= word.q)) {
      qById.set(word.entry.id, word.q);
    }
  }
  return {
    bySimp,
    longest,
    hskBySimp,
    qById,
    readings: readingsOf(hskBySimp),
  };
}

/**
 * The committed gloss overrides, as { text: { entry, gloss } }. An override
 * applies to every segment with its text, an HSK word too. Each override
 * names one CC-CEDICT entry by its segment text and its pinyin with tone
 * numbers, and by its traditional form when two entries have the same
 * pinyin (后 and 後 are both hou4). It can set the gloss. A person adds one
 * for an error found in use (#479). An override that names no entry is a
 * problem of the build.
 */
function overridesOf(glossOverrides, bySimp, problems) {
  const overrides = new Map();
  for (const [text, { pinyin, trad, gloss } = {}] of Object.entries(glossOverrides)) {
    const entry = (bySimp.get(text) ?? []).find(
      (e) => e.pinyin === pinyin && (trad === undefined || e.trad === trad),
    );
    if (!entry) {
      problems.push(`gloss override ${text}: no CC-CEDICT entry ${trad ? `${trad} ` : ''}${text} [${pinyin}]`);
      continue;
    }
    if (gloss !== undefined && (typeof gloss !== 'string' || gloss.trim() === '')) {
      problems.push(`gloss override ${text}: the gloss is empty`);
      continue;
    }
    if (gloss !== undefined && partsOf(gloss).length > GLOSS_SENSES) {
      problems.push(`gloss override ${text}: the gloss has more than ${GLOSS_SENSES} senses`);
      continue;
    }
    overrides.set(text, { entry, gloss: gloss?.trim() });
  }
  return overrides;
}

/**
 * The readings of each character in the HSK words: { char: Map(syllable, count) }.
 * A syllable is lower case with its tone number. A neutral tone does not
 * count: in a word such as 桌子 it is a weak form, not the reading of the
 * character alone. A word whose syllables do not match its characters is
 * skipped.
 */
function readingsOf(hskBySimp) {
  const readings = new Map();
  for (const { simp, entry } of hskBySimp.values()) {
    const chars = [...simp];
    const syllables = entry.pinyin.toLowerCase().split(' ');
    if (syllables.length !== chars.length) continue;
    chars.forEach((char, i) => {
      if (syllables[i].endsWith('5')) return;
      if (!readings.has(char)) readings.set(char, new Map());
      const counts = readings.get(char);
      counts.set(syllables[i], (counts.get(syllables[i]) ?? 0) + 1);
    });
  }
  return readings;
}

/**
 * The entry of a segment. An HSK word takes the entry of the premade-list
 * resolver. A single character outside HSK takes the entry whose pinyin the
 * HSK words that hold the character read most often: 居 is jū, as in 居住,
 * 居民 and 邻居 (#479). Then, and for any other segment, the entry with the
 * best rank `q` wins, then the first in CC-CEDICT order. A name entry counts
 * only when no other exists.
 */
function entryOf(text, index) {
  const hskWord = index.hskBySimp.get(text);
  if (hskWord) return hskWord.entry;
  const entries = index.bySimp.get(text);
  if (!entries) return null;
  const common = entries.filter((entry) => !isName(entry));
  const pool = common.length > 0 ? common : entries;
  const counts = index.readings.get(text);
  const votes = (entry) => (counts ? (counts.get(entry.pinyin.toLowerCase()) ?? 0) : 0);
  const rank = (entry) => index.qById.get(entry.id) ?? Infinity;
  let best = pool[0];
  for (const entry of pool) {
    if (votes(entry) > votes(best) || (votes(entry) === votes(best) && rank(entry) < rank(best))) {
      best = entry;
    }
  }
  return best;
}

/** The kind of a segment, which decides how the split and the grader count it. */
function kindOf(text, entry, index) {
  // An HSK word counts at its level, even when it is a number such as 一.
  if (index.hskBySimp.has(text)) return 'hsk';
  if (NUMBER.test(text)) return 'number';
  if (entry && isName(entry)) return 'name';
  return 'other';
}

/**
 * The cost of a split, compared in order: non-HSK segments, segments, rank.
 *
 * The rank of a split is the sum of the logarithms of the ranks `q` of its
 * segments. A word's frequency is about 1/q, so this picks the most probable
 * split. A plain sum of `q` lets two mid-rank words beat one common word and
 * one rarer word: it splits 读一下课文 as 一/下课/文, not 一/下/课文.
 */
const UNRANKED = Math.log(1e6);
function costOf(segment, index) {
  const hskWord = index.hskBySimp.get(segment.text);
  return {
    other: segment.kind === 'other' ? 1 : 0,
    count: 1,
    q: hskWord && hskWord.q !== undefined ? Math.log(hskWord.q) : UNRANKED,
  };
}

const addCost = (a, b) => ({ other: a.other + b.other, count: a.count + b.count, q: a.q + b.q });
const lessCost = (a, b) =>
  a.other !== b.other ? a.other < b.other : a.count !== b.count ? a.count < b.count : a.q < b.q;

/**
 * Split one run of Han characters and digits into segments: the split with
 * the fewest non-HSK segments (names and numbers do not count), then the
 * fewest segments, then the best total HSK rank. A Han character with no
 * entry is a segment of its own, and a run of digits is one segment.
 */
function splitRun(chars, index) {
  const n = chars.length;
  const best = new Array(n + 1).fill(null);
  best[0] = { cost: { other: 0, count: 0, q: 0 }, segments: [] };
  for (let start = 0; start < n; start++) {
    if (!best[start]) continue;
    const candidates = [];
    if (DIGIT.test(chars[start])) {
      let end = start;
      while (end < n && DIGIT.test(chars[end])) end++;
      candidates.push({ end, text: chars.slice(start, end).join(''), entry: null });
    } else {
      for (let end = start + 1; end <= Math.min(n, start + index.longest); end++) {
        const text = chars.slice(start, end).join('');
        const entry = entryOf(text, index);
        if (entry) candidates.push({ end, text, entry });
      }
      if (!candidates.some((c) => c.end === start + 1)) {
        candidates.push({ end: start + 1, text: chars[start], entry: null });
      }
    }
    for (const { end, text, entry } of candidates) {
      const segment = { text, entry, kind: kindOf(text, entry, index) };
      const cost = addCost(best[start].cost, costOf(segment, index));
      if (!best[end] || lessCost(cost, best[end].cost)) {
        best[end] = { cost, segments: [...best[start].segments, segment] };
      }
    }
  }
  return best[n].segments;
}

/**
 * The segments of a simplified sentence, each with its position in the text.
 * Punctuation and spaces are not segments.
 */
function splitSentence(simp, index) {
  const chars = [...simp];
  const segments = [];
  let start = 0;
  while (start < chars.length) {
    if (!HAN.test(chars[start]) && !DIGIT.test(chars[start])) {
      start++;
      continue;
    }
    let end = start;
    while (end < chars.length && (HAN.test(chars[end]) || DIGIT.test(chars[end]))) end++;
    let at = start;
    for (const segment of splitRun(chars.slice(start, end), index)) {
      const length = [...segment.text].length;
      segments.push({ ...segment, at, length });
      at += length;
    }
    start = end;
  }
  return segments;
}

/** The HSK level at which the grader counts a segment, or null when it does not count. */
function levelOf(segment, index) {
  if (segment.kind === 'number' || segment.kind === 'name') return null;
  const hskWord = index.hskBySimp.get(segment.text);
  return hskWord ? hskWord.level : NOT_HSK;
}

/**
 * Check a record. Returns the reason it is malformed, or null. Only a
 * generated record has a headword.
 */
function malformed(record) {
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  if (!isText(record.simp)) return 'no simp text';
  if (!isText(record.english)) return 'no English';
  if (record.source === 'generated' && !isText(record.headword)) return 'no headword';
  return null;
}

/**
 * The sentences, one for each normalized text. If two records have the same
 * text, the first one stays: a generated record before a Tatoeba record, so
 * the grader still checks every generated sentence for its headword.
 */
function uniqueSentences(records, problems) {
  const byId = new Map();
  for (const record of records) {
    const reason = malformed(record);
    if (reason) {
      problems.push(`${record.source} ${record.sourceId}: malformed ${record.source} record (${reason})`);
      continue;
    }
    const simp = normalize(record.simp);
    const id = sentenceId(simp);
    if (byId.has(id)) continue;
    byId.set(id, { id, simp, english: record.english.trim(), record, word: record.headword ?? null });
  }
  return [...byId.values()];
}

/** The number of Han characters of a text. Digits do not count. */
const hanCount = (text) => [...text].filter((c) => HAN.test(c)).length;

/**
 * True when the build drops a prepared Tatoeba sentence. The review of #473
 * found that short sentences and names made most of the bad Tatoeba sentences.
 */
const dropsTatoeba = (sentence) =>
  hanCount(sentence.simp) < MIN_TATOEBA_HAN || sentence.segments.some((segment) => segment.kind === 'name');

/** The traditional form of a sentence: each segment takes the form of its entry. */
function traditionalOf(simp, segments) {
  const segmentTrads = segments.map((segment) => (segment.entry ? segment.entry.trad : segment.text));
  const out = [...simp];
  segments.forEach((segment, i) => {
    out.splice(segment.at, segment.length, ...[...segmentTrads[i]].slice(0, segment.length));
  });
  return { trad: out.join(''), segmentTrads };
}

/**
 * Prepare a sentence once: the split, the segment data of the output, and the
 * counted segments. Returns { reason } for a sentence with letters of another
 * script than Han, or with no Han character.
 */
function prepare(sentence, index) {
  if (OTHER_LETTER.test(sentence.simp)) return { reason: 'holds Latin letters' };
  const segments = splitSentence(sentence.simp, index);
  if (segments.length === 0) return { reason: 'holds no Han character' };
  // An override changes the entry that the output shows, not the split or the grade.
  const overrides = segments.map((segment) => index.overrides.get(segment.text));
  const shown = segments.map((segment, i) => (overrides[i] ? { ...segment, entry: overrides[i].entry } : segment));
  const { trad, segmentTrads } = traditionalOf(sentence.simp, shown);
  const glossOfSegment = (segment, i) => {
    if (overrides[i]?.gloss) return overrides[i].gloss;
    if (segment.entry) return glossOf(segment.entry);
    return segment.kind === 'number' ? segment.text : '';
  };
  const output = shown.map((segment, i) => ({
    s: segment.text,
    t: segmentTrads[i],
    p: segment.entry ? toneMarks(segment.entry.pinyin) : '',
    e: glossOfSegment(segment, i),
  }));
  return {
    ...sentence,
    trad,
    segments,
    output,
    levels: segments.map((segment) => levelOf(segment, index)),
    length: lengthOf(sentence.simp),
  };
}

/**
 * Grade a prepared sentence for one HSK word. Returns null when no segment of
 * the sentence is the word. Otherwise the reason is null when the sentence
 * passes. The target segment does not count, even when the sentence holds it
 * twice.
 */
function grade(sentence, word, wordLevel) {
  const targetIndex = sentence.segments.findIndex((segment) => segment.text === word);
  if (targetIndex === -1) return null;
  // A sentence of the word alone, such as 吃。, shows the learner nothing new.
  if (sentence.segments.every((segment) => segment.text === word)) {
    return { targetIndex, reason: 'holds only the word' };
  }
  const counted = [];
  sentence.segments.forEach((segment, i) => {
    if (segment.text !== word && sentence.levels[i] !== null) {
      counted.push({ text: segment.text, level: sentence.levels[i] });
    }
  });
  const hskLevel = counted.reduce((max, segment) => Math.max(max, segment.level), 1);
  const cap = LENGTH_CAPS[wordLevel];
  // An HSK 7–9 word has no cap and passes the level rule with any sentence.
  const above = wordLevel >= NOT_HSK ? [] : counted.filter((segment) => segment.level > wordLevel);
  let reason = null;
  if (cap !== undefined && sentence.length > cap) {
    reason = `longer than the cap of ${cap} characters (${sentence.length})`;
  } else if (above.length > 0) {
    reason = `segments above HSK ${wordLevel}: ${above.map((s) => `${s.text} (${s.level})`).join(', ')}`;
  }
  return { targetIndex, hskLevel, reason, set: new Set(counted.map((segment) => segment.text)) };
}

/** The Jaccard overlap of two sets of counted segments. */
function overlap(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const item of a) if (b.has(item)) both++;
  return both / (a.size + b.size - both);
}

const compareRanked = (a, b) =>
  a.sentence.length - b.sentence.length ||
  (a.sentence.id < b.sentence.id ? -1 : a.sentence.id > b.sentence.id ? 1 : 0);

/**
 * Pick the sentences of one word, up to the target. The pick walks the
 * shortest first and skips a sentence that overlaps a picked one by more than
 * half. If the word then has fewer than the target, the skipped sentences
 * fill it, shortest first.
 */
function pick(candidates) {
  const picked = [];
  const skipped = [];
  for (const candidate of [...candidates].sort(compareRanked)) {
    if (picked.length >= SENTENCE_TARGET) break;
    if (picked.some((p) => overlap(p.grade.set, candidate.grade.set) > MAX_OVERLAP)) {
      skipped.push(candidate);
    } else {
      picked.push(candidate);
    }
  }
  for (const candidate of skipped) {
    if (picked.length >= SENTENCE_TARGET) break;
    picked.push(candidate);
  }
  return picked;
}

/**
 * The sentence of a word in the output shape of #465. `fill` names the source
 * of the sentence, for the readers of that shape (#386, #469).
 */
function outputOf({ sentence, grade: graded }) {
  const { record } = sentence;
  const tatoeba = record.source === 'tatoeba';
  return {
    id: sentence.id,
    simp: sentence.simp,
    trad: sentence.trad,
    english: sentence.english,
    segments: sentence.output,
    targetIndex: graded.targetIndex,
    hskLevel: graded.hskLevel,
    fill: record.source,
    source: tatoeba ? { name: 'tatoeba', id: Number(record.sourceId) } : { name: 'generated', id: sentence.id },
    origin: tatoeba ? { chinese: 'human', english: 'human' } : { chinese: 'machine', english: 'machine' },
  };
}

/** The attribution line of one shipped Tatoeba sentence. */
function attributionOf({ id, record }) {
  const by = (owner) => (owner ? ` by ${owner}` : '');
  const english = record.englishId ? `; English: Tatoeba #${record.englishId}${by(record.englishOwner)}` : '';
  return `${id} Tatoeba #${record.sourceId}${by(record.owner)}${english}, ${TATOEBA_LICENCE.name}`;
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7];
const levelName = (level) => (level === 7 ? 'HSK 7–9' : `HSK ${level}`);

/** The words of the rows that pass a test, as one list line for each level. */
function wordLines(rows, test) {
  const lines = [];
  for (const level of LEVELS) {
    const here = rows.filter((row) => row.level === level && test(row)).map((row) => row.word);
    if (here.length > 0) lines.push(`- ${levelName(level)}: ${here.join(', ')}`);
  }
  return lines;
}

/** The text of the coverage report, in Markdown. */
function reportOf(rows, largest) {
  const lines = [
    '# Example sentence coverage',
    '',
    `The build of \`npm run build:dict\` writes this report. The sentences come from native writers on Tatoeba and from generation (ADR 0020). A word is filled when it has ${SENTENCE_TARGET} sentences.`,
    '',
    '## HSK words',
    '',
    `| Level | Words | Filled | Fewer than ${REPORT_FEW} | None | Unfilled |`,
    '| --- | --: | --: | --: | --: | --: |',
  ];
  const total = { words: 0, filled: 0, few: 0, none: 0, unfilled: 0 };
  const rowOf = (here) => {
    const count = (test) => here.filter(test).length;
    return {
      words: here.length,
      filled: count((r) => r.count >= SENTENCE_TARGET),
      few: count((r) => r.count < REPORT_FEW),
      none: count((r) => r.count === 0),
      unfilled: count((r) => r.unfilled),
    };
  };
  const cells = (row) => Object.keys(total).map((key) => row[key]).join(' | ');
  for (const level of LEVELS) {
    const row = rowOf(rows.filter((r) => r.level === level));
    Object.keys(total).forEach((key) => (total[key] += row[key]));
    lines.push(`| ${levelName(level)} | ${cells(row)} |`);
  }
  lines.push(`| All | ${cells(total)} |`);
  if (total.unfilled > 0) {
    lines.push('', `## Unfilled after ${MAX_ROUNDS} rounds`, '');
    lines.push(`These words still have fewer than ${SENTENCE_TARGET} sentences after ${MAX_ROUNDS} rounds of generation.`, '');
    lines.push(...wordLines(rows, (row) => row.unfilled));
  }
  const toGenerate = wordLines(rows, (row) => row.count < SENTENCE_TARGET && !row.unfilled);
  if (toGenerate.length > 0) {
    lines.push('', '## Not filled', '');
    lines.push(`These words have fewer than ${SENTENCE_TARGET} sentences. \`node sentence-gaps.js\` gives them to the next round.`, '');
    lines.push(...toGenerate);
  }
  lines.push('', '## Files', '');
  if (largest.bytes === 0) {
    lines.push('The build wrote no sentence file.');
    return lines.join('\n') + '\n';
  }
  lines.push(
    `The largest sentence file is \`${largest.name}.json\` (the words that start with ${String.fromCodePoint(parseInt(largest.name, 16))}), at ${(largest.bytes / 1024).toFixed(0)} KB. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
  );
  return lines.join('\n') + '\n';
}

/**
 * Build the example sentence files.
 *
 * Inputs:
 *   dictionary    the CC-CEDICT entries: { id, simp, trad, pinyin, meaning }
 *   hsk           one item for each word of each HSK list: { simp, level, entry, q },
 *                 where `entry` is the entry that the premade-list resolver gives
 *                 it and `level` is 1 to 7 (7 for HSK 7–9)
 *   generated     the records of the generated file, each with its `headword`
 *   tatoeba       the records of the Tatoeba file
 *   unfilled      the words that failed MAX_ROUNDS rounds
 *   glossOverrides  { [segment text]: { pinyin, trad?, gloss? } }: the entry and the
 *                 gloss that a segment shows, from sentences/gloss-overrides.json
 *
 * Each sentence goes to every HSK word that it holds and passes the grader
 * for. A generated sentence must pass for its headword, or the build fails.
 * A Tatoeba sentence with fewer than 6 Han characters or a name is dropped.
 *
 * Returns { files, count, attribution, report, gaps }:
 *   files         { [hex code point]: { [simplified word]: sentence[] } }
 *   count         the number of sentences in the files, one for each word
 *   attribution   one line for each shipped Tatoeba sentence, in id order
 *   report        the coverage report, in Markdown
 *   gaps          each HSK word with fewer than 3 sentences that is not unfilled
 *
 * Throws on a bad gloss override, on a malformed record, on a generated
 * sentence that fails the grader, and on a sentence file over 2 MB. Never
 * throws on coverage.
 */
function buildExampleSentences(inputs) {
  const { files, count, attribution, report, gaps } = buildAll(inputs);
  return { files, count, attribution, report, gaps };
}

/**
 * The build, with the parts of its state that acceptCandidates also reads:
 * the index, the ids of all sentences, and the chosen sentences of each word.
 */
function buildAll({ dictionary, hsk, generated = [], tatoeba = [], unfilled = [], glossOverrides = {} }) {
  const problems = [];
  const index = indexInputs(dictionary, hsk);
  index.overrides = overridesOf(glossOverrides, index.bySimp, problems);
  const sentences = uniqueSentences([...generated, ...tatoeba], problems);
  if (problems.length > 0) throw buildError(problems);

  const candidatesOf = new Map();
  for (const sentence of sentences) {
    const { word } = sentence;
    const ready = prepare(sentence, index);
    if (word !== null) {
      // A generated sentence must pass the grader for its own word.
      const hskWord = index.hskBySimp.get(word);
      const graded = hskWord && !ready.reason ? grade(ready, word, hskWord.level) : null;
      const reason = !hskWord
        ? 'is for a word outside HSK'
        : ready.reason
          ? ready.reason
          : !graded
            ? `no segment is ${word}`
            : graded.reason;
      if (reason) {
        problems.push(`generated "${sentence.simp}" for ${word}: ${reason}`);
        continue;
      }
    } else if (ready.reason || dropsTatoeba(ready)) {
      continue;
    }
    // The sentence goes to every HSK word that it holds and passes the grader for.
    for (const text of new Set(ready.segments.map((segment) => segment.text))) {
      const hskWord = index.hskBySimp.get(text);
      const graded = hskWord ? grade(ready, text, hskWord.level) : null;
      if (!graded || graded.reason) continue;
      if (!candidatesOf.has(text)) candidatesOf.set(text, []);
      candidatesOf.get(text).push({ sentence: ready, grade: graded });
    }
  }
  if (problems.length > 0) throw buildError(problems);

  const unfilledWords = new Set(unfilled);
  const files = {};
  const rows = [];
  const gaps = [];
  const chosenByWord = new Map();
  const shipped = new Map();
  let count = 0;
  for (const [word, { level }] of [...index.hskBySimp].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const chosen = pick(candidatesOf.get(word) ?? []);
    chosenByWord.set(word, chosen);
    if (chosen.length > 0) {
      const file = fileOf(word);
      files[file] ??= {};
      files[file][word] = chosen.map(outputOf);
      count += chosen.length;
      chosen.forEach(({ sentence }) => shipped.set(sentence.id, sentence));
    }
    const short = chosen.length < SENTENCE_TARGET;
    rows.push({ level, word, count: chosen.length, unfilled: short && unfilledWords.has(word) });
    if (short && !unfilledWords.has(word)) {
      gaps.push({
        word,
        hskLevel: level,
        lengthCap: LENGTH_CAPS[level] ?? null,
        needed: SENTENCE_TARGET - chosen.length,
      });
    }
  }

  let largest = { name: '', bytes: 0 };
  for (const [name, content] of Object.entries(files)) {
    const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
    if (bytes > largest.bytes) largest = { name, bytes };
    if (bytes > MAX_FILE_BYTES) {
      problems.push(`sentences/${name}.json is ${(bytes / 1024 / 1024).toFixed(2)} MB, over the limit of 2 MB`);
    }
  }
  if (problems.length > 0) throw buildError(problems);

  const attribution = [...shipped.values()]
    .filter((sentence) => sentence.record.source === 'tatoeba')
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(attributionOf);

  return {
    files,
    count,
    attribution,
    report: reportOf(rows, largest),
    gaps,
    index,
    ids: new Set(sentences.map((sentence) => sentence.id)),
    chosenByWord,
  };
}

/**
 * Grade the candidates that Claude Code wrote for the gaps, with the rules of
 * the build. See #468.
 *
 * Inputs:
 *   inputs      the inputs of buildExampleSentences, with the generated
 *               records accepted so far
 *   candidates  [{ word, simp, english }]
 *   rounds      the failed rounds of each word so far: { [word]: number }
 *
 * Returns { records, rejects, rounds, short }:
 *   records     the generated records of the candidates that pass
 *   rejects     [{ word, simp, reason }]
 *   rounds      the failed rounds after this round
 *   short       [{ word, needed }]: the words of this round that are still short
 */
function acceptCandidates(inputs, candidates, rounds = {}) {
  const built = buildAll(inputs);
  const { index } = built;
  const needed = new Map(built.gaps.map((gap) => [gap.word, gap.needed]));
  const records = [];
  const rejects = [];
  const seen = new Set(built.ids);
  // The variety rule of the build, against the sentences that the word has and
  // the candidates that this round accepted.
  const kept = new Map();
  for (const [word, chosen] of built.chosenByWord) {
    kept.set(word, chosen.map((c) => ({ simp: c.sentence.simp, set: c.grade.set })));
  }
  for (const candidate of candidates) {
    const { word } = candidate;
    const simp = normalize(String(candidate.simp ?? ''));
    const english = String(candidate.english ?? '').trim();
    const reject = (reason) => rejects.push({ word, simp, reason });
    const hskWord = index.hskBySimp.get(word);
    if (!hskWord) {
      reject('is not an HSK word');
      continue;
    }
    if ((rounds[word] ?? 0) >= MAX_ROUNDS) {
      reject(`the word failed ${MAX_ROUNDS} rounds`);
      continue;
    }
    if (!(needed.get(word) > 0)) {
      reject('the word needs no more sentences');
      continue;
    }
    if (simp === '') {
      reject('has no Chinese');
      continue;
    }
    if (english === '') {
      reject('has no English');
      continue;
    }
    const id = sentenceId(simp);
    if (seen.has(id)) {
      reject('is already a sentence');
      continue;
    }
    const ready = prepare({ id, simp }, index);
    if (ready.reason) {
      reject(ready.reason);
      continue;
    }
    const graded = grade(ready, word, hskWord.level);
    if (!graded) {
      reject(`no segment is ${word} (${ready.segments.map((s) => s.text).join(' / ')})`);
      continue;
    }
    if (graded.reason) {
      reject(graded.reason);
      continue;
    }
    const like = (kept.get(word) ?? []).find((k) => overlap(k.set, graded.set) > MAX_OVERLAP);
    if (like) {
      reject(`too like ${like.simp}`);
      continue;
    }
    seen.add(id);
    if (!kept.has(word)) kept.set(word, []);
    kept.get(word).push({ simp, set: graded.set });
    needed.set(word, needed.get(word) - 1);
    records.push({
      source: 'generated',
      sourceId: id,
      written: 'simp',
      simp,
      trad: null,
      english,
      owner: null,
      headword: word,
      generator: GENERATOR,
      origin: { chinese: 'machine', english: 'machine' },
    });
  }
  // A round fails for a word when the word is still short after it.
  const after = { ...rounds };
  const short = [];
  for (const word of new Set(candidates.map((c) => c.word))) {
    if (!index.hskBySimp.has(word) || (rounds[word] ?? 0) >= MAX_ROUNDS) continue;
    if (needed.get(word) > 0) {
      after[word] = (rounds[word] ?? 0) + 1;
      short.push({ word, needed: needed.get(word) });
    } else delete after[word];
  }
  return { records, rejects, rounds: after, short };
}

function buildError(problems) {
  return new Error(
    `The example sentences do not build (${problems.length} problems):\n` +
      problems.map((problem) => `  ${problem}`).join('\n'),
  );
}

/** The words of the generated file that failed MAX_ROUNDS rounds. */
const unfilledOf = (generatedFile) =>
  Object.entries(generatedFile.rounds ?? {})
    .filter(([, count]) => count >= MAX_ROUNDS)
    .map(([word]) => word)
    .sort();

module.exports = {
  acceptCandidates,
  unfilledOf,
  MAX_ROUNDS,
  buildExampleSentences,
  sentenceId,
  toneMarks,
  glossOf,
  LENGTH_CAPS,
};
