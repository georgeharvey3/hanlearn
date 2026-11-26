/**
 * The distractors of the Comprehend tab (#601): for each built example
 * sentence, three other built sentences whose English is a false reading of
 * it. The learner picks the English of the sentence from the four options.
 *
 * write-distractors.js embeds the English of each sentence with a sentence
 * embedding model and writes sentences/distractors.json. The model is an
 * adapter (`embed`), so the rule here is pure and its tests run without it.
 * build-dictionary.js then writes the English of each distractor into the
 * sentence files with attachDistractors.
 */

/**
 * The tunable values of the rule, from the prototype of #601.
 *
 * BAND: the English cosine of a candidate to the sentence. Above the top, a
 * candidate is often a paraphrase, which is also a true reading. Below the
 * bottom, it is about something else and easy to rule out.
 *
 * COUNT: the distractors of each sentence. The tab shows them with the
 * sentence's own English, so 3 gives four options.
 *
 * STOP_SEGMENTS: the function words that do not count as shared Chinese words:
 * particles, pronouns, the copula and other words that every sentence holds.
 *
 * GLOSS_STOP: the English words of a gloss that say nothing of its meaning.
 */
const BAND = { min: 0.6, max: 0.83 };
/**
 * FLOOR: when the band gives fewer than COUNT, the candidates from FLOOR up to
 * the band fill the rest, ranked the same way. A few sentences have no near
 * neighbour (这把剪刀不好使。 is about scissors), and the build needs 3.
 */
const FLOOR = 0.45;
const COUNT = 3;
const STOP_SEGMENTS = new Set([
  ...'的了吗呢吧啊呀嘛着过地得是在有不没也都就很还又再和跟与把被给让对从向往为而但这那哪个一',
  '我', '你', '您', '他', '她', '它', '我们', '你们', '他们', '她们', '它们', '咱们', '自己', '大家',
  '这个', '那个', '这些', '那些', '这里', '那里', '这儿', '那儿', '这样', '那样', '这么', '那么',
  '什么', '怎么', '为什么', '谁', '没有', '不是', '一个', '已经', '可以', '因为', '所以', '但是',
  '如果', '还是', '或者', '然后', '就是',
]);
const GLOSS_STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'upon', 'one', 'ones', 'oneself', 'sth',
  'something', 'somebody', 'someone', 'etc', 'used', 'also', 'not', 'very', 'more', 'most', 'all',
  'some', 'any', 'out', 'off', 'over', 'under', 'about', 'which', 'that', 'this', 'its', 'their',
  'his', 'her', 'him', 'she', 'they', 'them', 'you', 'your', 'our', 'can', 'may', 'will', 'have',
  'has', 'make', 'get', 'take', 'put', 'give', 'kind', 'way', 'thing', 'person', 'people',
  'bound', 'form', 'literary', 'particle', 'marker', 'abbr', 'measure', 'word', 'classifier',
]);

/** A cosine to 6 places, so that a value on the edge of the band stays in it. */
const round = (value) => Math.round(value * 1e6) / 1e6;

/** A crude stem: "secretly", "secrets" and "secret" are one word. */
function stem(word) {
  for (const suffix of ['ly', 'ing', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

/** The content words of a gloss, stemmed, without the text in brackets. */
function glossWordsOf(gloss) {
  const words = (gloss ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .match(/[a-z]+/g);
  return (words ?? []).filter((word) => word.length >= 3 && !GLOSS_STOP.has(word)).map(stem);
}

/** The pinyin of a sentence without tones and spaces: 他 and 她 sound the same. */
const tonelessOf = (segments) =>
  segments
    .map((segment) => segment.p ?? '')
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ\s]/g, '')
    .toLowerCase();

/** The English of a sentence for the comparison of two options. */
const englishKey = (english) =>
  english
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The built sentences, once each: a sentence can serve two words. Each one
 * holds the words that it serves and the gloss words of their segments.
 */
function sentencesOf(files) {
  const byId = new Map();
  for (const words of Object.values(files)) {
    for (const [word, sentences] of Object.entries(words)) {
      for (const sentence of sentences) {
        let one = byId.get(sentence.id);
        if (!one) {
          one = {
            id: sentence.id,
            english: sentence.english,
            segments: sentence.segments,
            words: new Set(),
            targetGloss: new Set(),
          };
          byId.set(sentence.id, one);
        }
        one.words.add(word);
        for (const gloss of glossWordsOf(sentence.segments[sentence.targetIndex]?.e)) one.targetGloss.add(gloss);
      }
    }
  }
  const sentences = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const one of sentences) {
    one.toneless = tonelessOf(one.segments);
    one.englishKey = englishKey(one.english);
    one.gloss = new Set(one.segments.flatMap((segment) => glossWordsOf(segment.e)));
    // The content words of the sentence, and the ones that count as shared
    // when the sentence is the one under test: without its own target words.
    one.indexed = new Set(one.segments.map((segment) => segment.s).filter((text) => !STOP_SEGMENTS.has(text)));
    one.content = new Set([...one.indexed].filter((text) => !one.words.has(text)));
  }
  return sentences;
}

/** The key of one pair of a sentence and a distractor. */
const pairKey = (id, distractor) => `${id}\n${distractor}`;

/**
 * The committed block list of distractors, as a set of pair keys. Each entry
 * is { id, distractor, reason }. An entry with no reason throws.
 */
function parseBlockedPairs(entries) {
  const problems = [];
  const pairs = new Set();
  for (const entry of entries) {
    const { id, distractor, reason } = entry ?? {};
    if (typeof id !== 'string' || typeof distractor !== 'string') {
      problems.push(`blocked distractor ${JSON.stringify(entry)}: no id or no distractor`);
    } else if (typeof reason !== 'string' || reason.trim() === '') {
      problems.push(`blocked distractor ${id} ${distractor}: no reason`);
    } else {
      pairs.add(pairKey(id, distractor));
    }
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return pairs;
}

/** Whether two sets share a member. */
function hasAny(a, b) {
  for (const item of a) if (b.has(item)) return true;
  return false;
}

/** The dot product of two unit vectors: their cosine. */
function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return round(sum);
}

/**
 * The distractors of one sentence. A candidate passes the filters of the
 * rule, then ranks by the Chinese content words that it shares with the
 * sentence, then by its English cosine. The candidates that share a word come
 * from the index of each word, so a scan of every sentence happens only when
 * they give fewer than COUNT.
 */
function distractorsOf(one, sentences, vectors, byContent, blockedPairs) {
  const shared = new Map();
  for (const text of one.content) {
    for (const index of byContent.get(text) ?? []) shared.set(index, (shared.get(index) ?? 0) + 1);
  }
  const passes = (other) =>
    other.id !== one.id &&
    !hasAny(other.words, one.words) &&
    !blockedPairs.has(pairKey(one.id, other.id)) &&
    other.toneless !== one.toneless &&
    !hasAny(other.gloss, one.targetGloss);
  const within = (index, min, max) => {
    const value = cosine(vectors[one.index], vectors[index]);
    return value >= min && value < max ? value : null;
  };
  // The top of the band is in it: the bottom of the band is the top of the floor.
  const inBand = (index) => within(index, BAND.min, BAND.max + 1e-9);

  const chosen = [];
  const keys = new Set([one.englishKey]);
  const take = (ranked) => {
    for (const { index } of ranked) {
      if (chosen.length === COUNT) return;
      const other = sentences[index];
      if (keys.has(other.englishKey)) continue;
      keys.add(other.englishKey);
      chosen.push(other.id);
    }
  };
  const rank = (a, b) =>
    b.shared - a.shared || b.cosine - a.cosine || (sentences[a.index].id < sentences[b.index].id ? -1 : 1);

  const sharing = [];
  for (const [index, count] of shared) {
    if (!passes(sentences[index])) continue;
    const value = inBand(index);
    if (value !== null) sharing.push({ index, shared: count, cosine: value });
  }
  take(sharing.sort(rank));
  if (chosen.length < COUNT) {
    const rest = [];
    for (let index = 0; index < sentences.length; index++) {
      if (shared.has(index)) continue;
      // The cosine first: it is cheaper than the filters, and most sentences fail it.
      const value = inBand(index);
      if (value !== null && passes(sentences[index])) rest.push({ index, shared: 0, cosine: value });
    }
    take(rest.sort(rank));
  }
  if (chosen.length < COUNT) {
    const below = [];
    for (let index = 0; index < sentences.length; index++) {
      const value = within(index, FLOOR, BAND.min);
      if (value !== null && passes(sentences[index])) {
        below.push({ index, shared: shared.get(index) ?? 0, cosine: value });
      }
    }
    take(below.sort(rank));
  }
  return chosen;
}

/**
 * Choose the distractors of every built sentence, not only of the Comprehend
 * pool: a tab that borrows a sentence of another pool still finds them.
 *
 * Inputs:
 *   files          the sentence files of the build: { [file]: { [word]: sentences } }
 *   embed          the adapter: async (texts) => one unit vector for each text
 *   blockedPairs   parseBlockedPairs of the block list
 *
 * Returns { distractors: { [id]: ids }, short: [{ id, found }] }: the
 * sentences with fewer than COUNT distractors, which fail the build when the
 * tab shows them.
 */
async function chooseDistractors(files, embed, blockedPairs, onProgress = () => {}) {
  const sentences = sentencesOf(files);
  sentences.forEach((one, index) => (one.index = index));
  const vectors = await embed(sentences.map((one) => one.english));
  const byContent = new Map();
  sentences.forEach((one, index) => {
    for (const text of one.indexed) {
      if (!byContent.has(text)) byContent.set(text, []);
      byContent.get(text).push(index);
    }
  });

  const distractors = {};
  const short = [];
  sentences.forEach((one, index) => {
    const ids = distractorsOf(one, sentences, vectors, byContent, blockedPairs);
    if (ids.length > 0) distractors[one.id] = ids;
    if (ids.length < COUNT) short.push({ id: one.id, found: ids.length });
    onProgress(index + 1, sentences.length);
  });
  return { distractors, short };
}

/** The distractor file: the model, then one line for each sentence, sorted by id. */
function formatDistractors(model, distractors) {
  const lines = Object.keys(distractors)
    .sort()
    .map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(distractors[id])}`);
  return (
    '{\n' +
    `  "model": ${JSON.stringify(model)},\n` +
    `  "band": ${JSON.stringify({ ...BAND, floor: FLOOR })},\n` +
    '  "distractors": {\n' +
    lines.join(',\n') +
    '\n  }\n}\n'
  );
}

/**
 * The pools that the Comprehend tab takes its sentence from, nearest first.
 * The same order as BORROW in web-client/src/services/sentenceService.ts (#581).
 */
const COMPREHEND_BORROW = ['comprehend', 'compose', 'intro'];

/**
 * Write the id and the English of each distractor into each sentence of the
 * build files, in place. Returns the problems that fail the build:
 *
 * - the sentence that the Comprehend tab shows has fewer than COUNT distractors,
 *   so the distractor file is stale: run write-distractors.js
 * - a distractor is not a built sentence, or blocked.json blocks it
 * - a pair of the file is in the block list of distractors
 */
function attachDistractors(files, distractors, { blockedSentences, blockedPairs }) {
  const problems = [];
  const english = new Map();
  for (const words of Object.values(files)) {
    for (const sentences of Object.values(words)) {
      for (const sentence of sentences) english.set(sentence.id, sentence.english);
    }
  }
  const checked = new Set();
  for (const words of Object.values(files)) {
    for (const [word, sentences] of Object.entries(words)) {
      for (const sentence of sentences) {
        const ids = distractors[sentence.id] ?? [];
        if (!checked.has(sentence.id)) {
          checked.add(sentence.id);
          for (const id of ids) {
            if (blockedSentences.has(id)) {
              problems.push(`distractors of ${sentence.id}: the distractor ${id} is blocked in blocked.json`);
            } else if (!english.has(id)) {
              problems.push(`distractors of ${sentence.id}: the distractor ${id} is not a built sentence`);
            } else if (blockedPairs.has(pairKey(sentence.id, id))) {
              problems.push(`distractors of ${sentence.id}: the distractor ${id} is a blocked pair`);
            }
          }
        }
        const valid = ids.filter((id) => english.has(id));
        if (valid.length > 0) sentence.distractors = valid.map((id) => ({ id, english: english.get(id) }));
      }
      const shown = COMPREHEND_BORROW.map((pool) => sentences.find((s) => s.pool === pool)).find(Boolean);
      const count = shown?.distractors?.length ?? 0;
      if (shown && count < COUNT) {
        problems.push(
          `${shown.id} of ${word}: ${count} distractors, ${COUNT} needed. Run: node migration/write-distractors.js`,
        );
      }
    }
  }
  return problems;
}

module.exports = {
  BAND,
  FLOOR,
  COUNT,
  attachDistractors,
  chooseDistractors,
  formatDistractors,
  parseBlockedPairs,
};
