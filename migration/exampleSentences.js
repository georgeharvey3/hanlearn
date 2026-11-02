/**
 * Build the example sentence files from the committed source copies.
 *
 * Pure: build-dictionary.js reads the files, calls buildExampleSentences once,
 * and writes the result. The same inputs always give the same output, so a
 * deploy never changes the sentences by itself. The rules are in #465 under
 * "Stage 3: the build", "Grading", "Fill steps and ranking", "Output and
 * storage" and "Report and failure".
 */

const crypto = require('crypto');

/** The length cap of each HSK level, in Han characters and digits. HSK 7–9 has none. */
const LENGTH_CAPS = { 1: 10, 2: 12, 3: 15, 4: 18, 5: 25, 6: 25 };

/** The most sentences that a word keeps. */
const SENTENCE_CAP = 10;

/** The relaxed and generated fill steps fill an HSK word up to this number. */
const SENTENCE_TARGET = 5;

/** The report lists the words with fewer sentences than this. */
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
/** A letter of any script other than Han. A sentence with one is dropped. */
const OTHER_LETTER = /(?!\p{Script=Han})\p{L}/u;
const NUMBER = /^(?:第?[零〇一二两三四五六七八九十百千万亿]+|\p{Nd}+)$/u;

/** The sense prefixes that the gloss rule skips. */
const SKIPPED_SENSE = /^(?:surname\b|variant of\b|old variant of\b|CL:|see\b)/i;
const STRIPPED_PREFIX = /^\((?:bound form|literary)\)\s*/;

/** The source rank: a lower number ranks first. */
function sourceRank(record) {
  if (record.source === 'tatoeba') return record.ownerLevel === 5 ? 0 : 2;
  if (record.source === 'wiktionary') return 1;
  return 3;
}

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

/** The short English of an entry: its first useful sense. */
function glossOf(entry) {
  const senses = entry.meaning.split('/').filter((sense) => sense.trim() !== '');
  for (const sense of senses) {
    if (SKIPPED_SENSE.test(sense.trim())) continue;
    const gloss = sense.trim().replace(STRIPPED_PREFIX, '').trim();
    if (gloss !== '') return gloss;
  }
  return (senses[0] ?? '').trim();
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
  return { bySimp, longest, hskBySimp, qById };
}

/**
 * The entry of a segment. An HSK word takes the entry of the premade-list
 * resolver. Any other segment takes the entry with the best rank `q`, then the
 * first in CC-CEDICT order. A name entry counts only when no other exists.
 */
function entryOf(text, index) {
  const hskWord = index.hskBySimp.get(text);
  if (hskWord) return hskWord.entry;
  const entries = index.bySimp.get(text);
  if (!entries) return null;
  const common = entries.filter((entry) => !isName(entry));
  const pool = common.length > 0 ? common : entries;
  let best = pool[0];
  for (const entry of pool) {
    const q = index.qById.get(entry.id) ?? Infinity;
    const bestQ = index.qById.get(best.id) ?? Infinity;
    if (q < bestQ) best = entry;
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
 * Check a source record. Returns the reason it is malformed, or null.
 */
function malformed(record) {
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  if (!isText(record.source)) return 'no source';
  if (record.sourceId === undefined || record.sourceId === null) return 'no sourceId';
  if (record.written !== 'simp' && record.written !== 'trad') return 'written is not simp or trad';
  if (!isText(record[record.written])) return `no ${record.written} text`;
  for (const form of ['simp', 'trad']) {
    if (record[form] !== null && record[form] !== undefined && typeof record[form] !== 'string') {
      return `${form} is not text`;
    }
  }
  if (!isText(record.english)) return 'no English';
  const origins = ['human', 'machine'];
  if (!record.origin || !origins.includes(record.origin.chinese) || !origins.includes(record.origin.english)) {
    return 'origin is not human or machine';
  }
  return null;
}

/**
 * The sentences of all sources, with duplicates merged: one sentence for each
 * normalized simplified text, from the best source. Generated records become
 * sentences in the same way, with their target word.
 */
function mergeSentences(sources, generated, toSimplified, problems) {
  const byId = new Map();
  const consider = (record, extra) => {
    const simp = normalize(record.simp ?? toSimplified(record.trad));
    const candidate = {
      id: sentenceId(simp),
      simp,
      trad: record.trad ? normalize(record.trad) : null,
      english: record.english.trim(),
      record,
      rank: sourceRank(record),
      ...extra,
    };
    const known = byId.get(candidate.id);
    if (!known || better(candidate, known)) byId.set(candidate.id, candidate);
  };
  for (const { records } of sources) {
    for (const record of records) {
      const reason = malformed(record);
      if (reason) {
        problems.push(`${record.source} ${record.sourceId}: malformed source record (${reason})`);
        continue;
      }
      consider(record, {});
    }
  }
  for (const record of generated) {
    const reason = malformed(record) ?? (record.headword ? null : 'no headword');
    if (reason) {
      problems.push(`generated ${record.sourceId}: malformed generated record (${reason})`);
      continue;
    }
    consider(record, { generatedFor: record.headword });
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** True when sentence a is from a better source than sentence b. */
function better(a, b) {
  if (a.rank !== b.rank) return a.rank < b.rank;
  // A real sentence beats a generated one of the same rank.
  if (Boolean(a.generatedFor) !== Boolean(b.generatedFor)) return !a.generatedFor;
  return compareSourceIds(a.record, b.record) < 0;
}

function compareSourceIds(a, b) {
  const x = String(a.sourceId);
  const y = String(b.sourceId);
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * The traditional form of each segment. A source with its own traditional
 * text gives it, where the two texts line up character for character. If not,
 * each segment takes the traditional form of its entry.
 */
function traditionalOf(sentence, segments) {
  const simpChars = [...sentence.simp];
  const tradChars = sentence.trad ? [...sentence.trad] : null;
  const aligned = tradChars && tradChars.length === simpChars.length;
  const segmentTrads = segments.map((segment) =>
    aligned
      ? tradChars.slice(segment.at, segment.at + segment.length).join('')
      : segment.entry
        ? segment.entry.trad
        : segment.text,
  );
  if (sentence.trad) return { trad: sentence.trad, segmentTrads };
  const out = [...simpChars];
  segments.forEach((segment, i) => {
    out.splice(segment.at, segment.length, ...[...segmentTrads[i]].slice(0, segment.length));
  });
  return { trad: out.join(''), segmentTrads };
}

/**
 * Prepare each merged sentence once: the split, the segment data of the
 * output, and the counted segments. Drops a sentence with letters of another
 * script than Han.
 */
function prepare(sentence, index, rejects) {
  if (OTHER_LETTER.test(sentence.simp)) {
    rejects.push({ id: sentence.id, simp: sentence.simp, reason: 'holds Latin letters' });
    return null;
  }
  const segments = splitSentence(sentence.simp, index);
  if (segments.length === 0) {
    rejects.push({ id: sentence.id, simp: sentence.simp, reason: 'holds no Han character' });
    return null;
  }
  const { trad, segmentTrads } = traditionalOf(sentence, segments);
  const output = segments.map((segment, i) => ({
    s: segment.text,
    t: segmentTrads[i],
    p: segment.entry ? toneMarks(segment.entry.pinyin) : '',
    e: segment.entry ? glossOf(segment.entry) : segment.kind === 'number' ? segment.text : '',
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
 * Grade a prepared sentence for one word. Returns null when no segment of the
 * sentence is the word. The target segment does not count, even when the
 * sentence holds it twice.
 */
function grade(sentence, word, wordLevel) {
  const targetIndex = sentence.segments.findIndex((segment) => segment.text === word);
  if (targetIndex === -1) return null;
  // A sentence of the word alone, such as 吃。, shows the learner nothing new.
  if (sentence.segments.every((segment) => segment.text === word)) {
    return { targetIndex, fill: null, reason: 'holds only the word' };
  }
  const counted = [];
  sentence.segments.forEach((segment, i) => {
    if (segment.text !== word && sentence.levels[i] !== null) {
      counted.push({ text: segment.text, level: sentence.levels[i] });
    }
  });
  const hskLevel = counted.reduce((max, segment) => Math.max(max, segment.level), 1);
  const cap = wordLevel === null ? undefined : LENGTH_CAPS[wordLevel];
  const withinCap = cap === undefined || sentence.length <= cap;
  // An HSK 7–9 word and a word outside HSK pass the level rule with any sentence.
  const noLevelRule = wordLevel === null || wordLevel >= NOT_HSK;
  const above = noLevelRule ? [] : counted.filter((segment) => segment.level > wordLevel);
  let fill = null;
  let reason = null;
  if (!withinCap) reason = `longer than the cap of ${cap} characters (${sentence.length})`;
  else if (above.length === 0) fill = 'strict';
  else if (above.length === 1 && above[0].level === wordLevel + 1) fill = 'relaxed';
  else {
    reason = `segments above HSK ${wordLevel}: ${above.map((s) => `${s.text} (${s.level})`).join(', ')}`;
  }
  return {
    targetIndex,
    hskLevel,
    above: above.length,
    fill,
    reason,
    set: new Set(counted.map((segment) => segment.text)),
  };
}

/** The Jaccard overlap of two sets of counted segments. */
function overlap(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const item of a) if (b.has(item)) both++;
  return both / (a.size + b.size - both);
}

const compareRanked = (a, b) =>
  a.grade.above - b.grade.above ||
  a.sentence.rank - b.sentence.rank ||
  a.sentence.length - b.sentence.length ||
  (a.sentence.id < b.sentence.id ? -1 : a.sentence.id > b.sentence.id ? 1 : 0);

/**
 * Pick the sentences of one word from its graded candidates, one fill step at
 * a time. A step adds sentences while the word has fewer than its limit. The
 * pick walks the ranked list and skips a sentence that overlaps a picked one
 * by more than half. If the word then has fewer than the target, the skipped
 * sentences fill it in rank order.
 */
function pick(steps) {
  const picked = [];
  for (const { candidates, limit } of steps) {
    if (picked.length >= limit) continue;
    const ranked = [...candidates].sort(compareRanked);
    const skipped = [];
    for (const candidate of ranked) {
      if (picked.length >= limit) break;
      if (picked.some((p) => overlap(p.grade.set, candidate.grade.set) > MAX_OVERLAP)) {
        skipped.push(candidate);
      } else {
        picked.push(candidate);
      }
    }
    for (const candidate of skipped) {
      if (picked.length >= Math.min(limit, SENTENCE_TARGET)) break;
      picked.push(candidate);
    }
  }
  return picked;
}

/** The sentence of a word in the output shape. */
function outputOf({ sentence, grade: graded, fill }) {
  const { record } = sentence;
  const source = { name: record.source === 'sentenceCache' ? 'sentence-cache' : record.source };
  source.id = record.source === 'tatoeba' ? Number(record.sourceId) : String(record.sourceId);
  return {
    id: sentence.id,
    simp: sentence.simp,
    trad: sentence.trad,
    english: sentence.english,
    segments: sentence.output,
    targetIndex: graded.targetIndex,
    hskLevel: graded.hskLevel,
    fill,
    source,
    origin: { chinese: record.origin.chinese, english: record.origin.english },
  };
}

/** The attribution line of one shipped sentence. */
function attributionOf(sentence, licences) {
  const { record } = sentence;
  const licence = licences[record.source]?.name;
  if (record.source === 'tatoeba') {
    const english = record.englishId
      ? `; English: Tatoeba #${record.englishId}${record.englishOwner ? ` by ${record.englishOwner}` : ''}`
      : '';
    return `${sentence.id} Tatoeba #${record.sourceId}${record.owner ? ` by ${record.owner}` : ''}${english}, ${licence}`;
  }
  if (record.source === 'wiktionary') {
    return `${sentence.id} Wiktionary, ${record.url ?? record.sourceId}, ${licence}`;
  }
  if (record.source === 'sentenceCache') return `${sentence.id} Generated by Gemini for HanLearn`;
  const generator = record.generator === GENERATOR ? 'Claude Code' : (record.generator ?? 'an AI');
  return `${sentence.id} Generated by ${generator} for HanLearn`;
}

/** The text of the coverage report, in Markdown. */
function reportOf(rows, sources, largest) {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  const name = (level) => (level === 7 ? 'HSK 7–9' : `HSK ${level}`);
  const lines = [
    '# Example sentence coverage',
    '',
    `The build of \`npm run build:dict\` writes this report. A word "needs" the last fill step that it took sentences from. Sentence target: ${SENTENCE_TARGET}, cap: ${SENTENCE_CAP}.`,
    '',
    '## HSK words by fill step',
    '',
    `| Level | Words | Strict only | Needs relaxed | Needs generated | Fewer than ${REPORT_FEW} | None | Unfilled |`,
    '| --- | --: | --: | --: | --: | --: | --: | --: |',
  ];
  const total = { words: 0, strict: 0, relaxed: 0, generated: 0, few: 0, none: 0, unfilled: 0 };
  for (const level of levels) {
    const here = rows.filter((row) => row.level === level);
    const count = (test) => here.filter(test).length;
    const row = {
      words: here.length,
      strict: count((r) => r.step === 'strict'),
      relaxed: count((r) => r.step === 'relaxed'),
      generated: count((r) => r.step === 'generated'),
      few: count((r) => r.count < REPORT_FEW),
      none: count((r) => r.count === 0),
      unfilled: count((r) => r.unfilled),
    };
    Object.keys(total).forEach((key) => (total[key] += row[key]));
    lines.push(
      `| ${name(level)} | ${row.words} | ${row.strict} | ${row.relaxed} | ${row.generated} | ${row.few} | ${row.none} | ${row.unfilled} |`,
    );
  }
  lines.push(
    `| All | ${total.words} | ${total.strict} | ${total.relaxed} | ${total.generated} | ${total.few} | ${total.none} | ${total.unfilled} |`,
  );
  if (total.unfilled > 0) {
    lines.push('', `## Unfilled after ${MAX_ROUNDS} rounds`, '');
    lines.push(`These words still have fewer than ${SENTENCE_TARGET} sentences after ${MAX_ROUNDS} rounds of generation.`, '');
    for (const level of levels) {
      const here = rows.filter((row) => row.level === level && row.unfilled).map((row) => row.word);
      if (here.length > 0) lines.push(`- ${name(level)}: ${here.join(', ')}`);
    }
  }
  lines.push('', '## Sentences of HSK words by source', '');
  lines.push(`| Level | ${sources.join(' | ')} |`, `| --- |${sources.map(() => ' --: |').join('')}`);
  for (const level of levels) {
    const here = rows.filter((row) => row.level === level);
    const cells = sources.map((source) =>
      here.reduce((sum, row) => sum + (row.bySource[source] ?? 0), 0),
    );
    lines.push(`| ${name(level)} | ${cells.join(' | ')} |`);
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
 *   sources       [{ source, licence, records }]: the committed source files
 *   generated     the records of the generated file, each with its `headword`
 *   licences      the licence of each source, by source name
 *   toSimplified  a function that converts traditional text to simplified
 *
 * Returns { files, attribution, report, gaps, rejects }:
 *   files         { [hex code point]: { [simplified word]: sentence[] } }
 *   attribution   one line for each shipped sentence, in id order
 *   report        the coverage report, in Markdown
 *   gaps          each HSK word with fewer than 5 sentences
 *   rejects       each dropped sentence, and each generated sentence that failed,
 *                 with the reason
 *
 * Throws on a malformed record, on a generated sentence that fails the
 * grader, and on a sentence file over 2 MB. Never throws on coverage.
 */
function buildExampleSentences(inputs) {
  const { files, attribution, report, gaps, rejects } = buildAll(inputs);
  return { files, attribution, report, gaps, rejects };
}

/**
 * The build, with the parts of its state that acceptCandidates also reads:
 * the index, the ids of all sentences, and the chosen sentences of each word.
 */
function buildAll({ dictionary, hsk, sources, generated = [], unfilled = [], licences, toSimplified }) {
  const index = indexInputs(dictionary, hsk);
  const problems = [];
  const rejects = [];
  const merged = mergeSentences(sources, generated, toSimplified, problems);
  if (problems.length > 0) throw buildError(problems);

  const prepared = merged.map((sentence) => prepare(sentence, index, rejects)).filter(Boolean);

  // Each sentence goes to the words of its segments. A generated sentence goes
  // only to its own word.
  const byWord = new Map();
  for (const sentence of prepared) {
    if (sentence.generatedFor) continue;
    for (const text of new Set(sentence.segments.filter((s) => s.entry).map((s) => s.text))) {
      if (!byWord.has(text)) byWord.set(text, []);
      byWord.get(text).push(sentence);
    }
  }
  const generatedFor = new Map();
  for (const sentence of merged.filter((s) => s.generatedFor)) {
    const word = sentence.generatedFor;
    const ready = prepared.find((p) => p.id === sentence.id);
    const hskWord = index.hskBySimp.get(word);
    const graded = ready && hskWord ? grade(ready, word, hskWord.level) : null;
    const reason = !ready
      ? (rejects.find((r) => r.id === sentence.id)?.reason ?? 'not usable')
      : !hskWord
        ? 'is for a word outside HSK'
        : !graded
          ? `no segment is ${word}`
          : graded.fill !== 'strict'
            ? (graded.reason ?? `segments above HSK ${hskWord.level}`)
            : null;
    if (reason) {
      problems.push(`generated "${sentence.simp}" for ${word}: ${reason}`);
      continue;
    }
    if (!generatedFor.has(word)) generatedFor.set(word, []);
    generatedFor.get(word).push({ sentence: ready, grade: graded, fill: 'generated' });
  }
  if (problems.length > 0) throw buildError(problems);

  const words = new Set([...byWord.keys(), ...index.hskBySimp.keys()]);
  const unfilledWords = new Set(unfilled);
  const files = {};
  const rows = [];
  const gaps = [];
  const shipped = new Map();
  const chosenByWord = new Map();
  for (const word of [...words].sort()) {
    const hskWord = index.hskBySimp.get(word);
    const level = hskWord ? hskWord.level : null;
    const strict = [];
    const relaxed = [];
    for (const sentence of byWord.get(word) ?? []) {
      const graded = grade(sentence, word, level);
      if (graded.fill === 'strict') strict.push({ sentence, grade: graded, fill: 'strict' });
      else if (graded.fill === 'relaxed' && hskWord) {
        relaxed.push({ sentence, grade: graded, fill: 'relaxed' });
      }
    }
    const steps = [{ candidates: strict, limit: SENTENCE_CAP }];
    if (hskWord) {
      steps.push({ candidates: relaxed, limit: SENTENCE_TARGET });
      steps.push({ candidates: generatedFor.get(word) ?? [], limit: SENTENCE_TARGET });
    }
    const chosen = pick(steps);
    chosenByWord.set(word, chosen);
    if (chosen.length > 0) {
      const file = fileOf(word);
      files[file] ??= {};
      files[file][word] = chosen.map(outputOf);
      for (const { sentence } of chosen) shipped.set(sentence.id, sentence);
    }
    if (hskWord) {
      const bySource = {};
      for (const { sentence } of chosen) {
        const name = sentence.generatedFor ? 'generated' : sentence.record.source;
        bySource[name] = (bySource[name] ?? 0) + 1;
      }
      const steps = chosen.map((c) => c.fill);
      const short = chosen.length < SENTENCE_TARGET;
      rows.push({
        level,
        word,
        unfilled: short && unfilledWords.has(word),
        count: chosen.length,
        step: steps.includes('generated')
          ? 'generated'
          : steps.includes('relaxed')
            ? 'relaxed'
            : chosen.length > 0
              ? 'strict'
              : null,
        bySource,
      });
      if (short && !unfilledWords.has(word)) {
        gaps.push({
          word,
          hskLevel: level,
          lengthCap: LENGTH_CAPS[level] ?? null,
          needed: SENTENCE_TARGET - chosen.length,
        });
      }
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
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((sentence) => attributionOf(sentence, licences));
  const sourceNames = [...sources.map((s) => s.source), 'generated'];
  return {
    files,
    attribution,
    report: reportOf(rows, sourceNames, largest),
    gaps,
    rejects,
    index,
    ids: new Set(merged.map((sentence) => sentence.id)),
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
    const drops = [];
    const ready = prepare({ id, simp, trad: null }, index, drops);
    if (!ready) {
      reject(drops[0].reason);
      continue;
    }
    const graded = grade(ready, word, hskWord.level);
    if (!graded) {
      reject(`no segment is ${word} (${ready.segments.map((s) => s.text).join(' / ')})`);
      continue;
    }
    if (graded.fill !== 'strict') {
      reject(graded.reason ?? `segments above HSK ${hskWord.level}: ${aboveOf(ready, word, hskWord.level)}`);
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

/** The counted segments of a sentence above the HSK level of a word, as text. */
function aboveOf(sentence, word, wordLevel) {
  return sentence.segments
    .map((segment, i) => ({ text: segment.text, level: sentence.levels[i] }))
    .filter((s) => s.text !== word && s.level !== null && s.level > wordLevel)
    .map((s) => `${s.text} (${s.level})`)
    .join(', ');
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
