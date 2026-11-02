import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { acceptCandidates, buildExampleSentences, sentenceId } from './exampleSentences';

/**
 * The real CC-CEDICT entries of the given simplified words, numbered by their
 * position in the file as build-dictionary.js numbers them.
 */
const cedictLines = fs
  .readFileSync(path.join(__dirname, 'cedict_ts.u8'), 'utf8')
  .split(/\r?\n/)
  .filter((line) => /^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/.test(line) && !line.startsWith('#'));
const allEntries = cedictLines.map((line, i) => {
  const [, trad, simp, pinyin, meaning] = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/);
  return { id: i + 1, trad, simp, pinyin, meaning };
});

const WORDS = [
  ...'我你他她是生在家看书的发行吃饭了很好大学三十去一下读请文课冷天今说汉语中国人们这那里张王长头',
  '学生', '在家', '看书', '喜欢', '汤姆', '第一', '北京', '头发', '今天', '经济', '研究', '课文',
  '下课', '一下', '中国', '汉语', '假发', '图书馆', '朋友', '我们', '他们', '老师', '电脑', '咖啡',
];
const dictionary = allEntries.filter((entry) => WORDS.includes(entry.simp));

/** The entry of a word with a given pinyin, as the premade-list resolver gives it. */
const entry = (simp, pinyin) => {
  const found = pinyin
    ? dictionary.find((e) => e.simp === simp && e.pinyin === pinyin)
    : (dictionary.find((e) => e.simp === simp && !/^[A-Z]/.test(e.pinyin)) ??
      dictionary.find((e) => e.simp === simp));
  if (!found) throw new Error(`no fixture entry for ${simp} ${pinyin ?? ''}`);
  return found;
};

/** One HSK word: its level, the resolver's entry and its rank `q`. */
const hskWord = (simp, level, q, pinyin) => ({ simp, level, q, entry: entry(simp, pinyin) });

/** A small HSK list. The ranks are those of the real lists. */
const HSK = [
  hskWord('我', 1, 3),
  hskWord('你', 1, 9),
  hskWord('他', 1, 10),
  hskWord('她', 1, 30),
  hskWord('是', 1, 2),
  hskWord('在', 1, 5),
  hskWord('家', 1, 124),
  hskWord('看', 1, 52, 'kan4'),
  hskWord('书', 1, 560),
  hskWord('在家', 1, 2444),
  hskWord('学生', 1, 600),
  hskWord('吃', 1, 150),
  hskWord('饭', 1, 900),
  hskWord('了', 1, 4),
  hskWord('很', 1, 20),
  hskWord('好', 1, 15),
  hskWord('大', 1, 25),
  hskWord('去', 1, 40),
  hskWord('一', 1, 21),
  hskWord('下', 1, 70),
  hskWord('读', 1, 1200),
  hskWord('请', 1, 300),
  hskWord('课文', 1, 30576),
  hskWord('下课', 1, 9694),
  hskWord('三', 1, 200),
  hskWord('喜欢', 1, 180),
  hskWord('朋友', 1, 220),
  hskWord('我们', 1, 12),
  hskWord('他们', 1, 14),
  hskWord('老师', 1, 400),
  hskWord('今天', 1, 160),
  hskWord('冷', 1, 2000),
  hskWord('说', 1, 18),
  hskWord('汉语', 1, 3000),
  hskWord('中国', 1, 100),
  hskWord('电脑', 1, 3500),
  hskWord('行', 2, 250, 'xing2'),
  hskWord('头发', 2, 2500),
  hskWord('发', 3, 350, 'fa1'),
  hskWord('图书馆', 2, 4000),
  hskWord('咖啡', 2, 5000),
  hskWord('经济', 3, 800),
  hskWord('研究', 4, 1000),
  hskWord('文', 7, 1391),
  // 好 is in two lists: the lower level counts.
  hskWord('好', 3, 15),
];

const LICENCES = {
  tatoeba: { name: 'CC BY 2.0 FR' },
  wiktionary: { name: 'CC BY-SA 4.0' },
  sentenceCache: { name: 'None' },
};

let nextId = 1;
const record = (simp, overrides = {}) => ({
  source: 'tatoeba',
  sourceId: String(nextId++),
  written: 'simp',
  simp,
  trad: null,
  english: `English of ${simp}`,
  owner: 'someone',
  ownerLevel: null,
  origin: { chinese: 'human', english: 'human' },
  ...overrides,
});
const wiktionary = (trad, simp, overrides = {}) =>
  record(simp, {
    source: 'wiktionary',
    written: 'trad',
    trad,
    owner: null,
    headword: 'x',
    url: 'https://en.wiktionary.org/wiki/x#Chinese',
    ...overrides,
  });
const generated = (headword, simp) =>
  record(simp, {
    source: 'generated',
    generator: 'claude-code',
    headword,
    owner: null,
    origin: { chinese: 'machine', english: 'machine' },
  });

/** A converter for the traditional characters of the fixtures. */
const TO_SIMP = { 書: '书', 這: '这', 發: '发', 髮: '发', 頭: '头', 們: '们', 說: '说', 漢: '汉', 語: '语' };
const toSimplified = (text) => [...text].map((c) => TO_SIMP[c] ?? c).join('');

const build = (records, { hsk = HSK, gen = [] } = {}) =>
  buildExampleSentences({
    dictionary,
    hsk,
    sources: [{ source: 'tatoeba', records }],
    generated: gen,
    licences: LICENCES,
    toSimplified,
  });

/** The sentences that a build gives a word. */
const sentencesOf = (result, word) => {
  const file = result.files[word.codePointAt(0).toString(16)];
  return (file && file[word]) ?? [];
};
const segmentsOf = (sentence) => sentence.segments.map((s) => s.s);

describe('splitting', () => {
  it('prefers HSK words: 看书 is not an HSK word, so it splits as 看 / 书', () => {
    const result = build([record('我在家看书。')]);
    expect(segmentsOf(sentencesOf(result, '我')[0])).toEqual(['我', '在家', '看', '书']);
  });

  it('takes more segments to avoid a word outside HSK', () => {
    const hsk = HSK.filter((w) => w.simp !== '在家');
    const result = build([record('我在家看书。')], { hsk });
    expect(segmentsOf(sentencesOf(result, '我')[0])).toEqual(['我', '在', '家', '看', '书']);
  });

  it('breaks a tie by the product of the ranks, not their sum', () => {
    // 下 / 课文 (ranks 70 and 30576) against 下课 / 文 (9694 and 1391).
    const result = build([record('请你读一下课文。')]);
    expect(segmentsOf(sentencesOf(result, '课文')[0])).toEqual(['请', '你', '读', '一', '下', '课文']);
    expect(sentencesOf(result, '下课')).toEqual([]);
  });

  it('leaves punctuation out of the segments and keeps it in the text', () => {
    const [sentence] = sentencesOf(build([record('你好，老师！')]), '老师');
    expect(sentence.simp).toBe('你好，老师！');
    expect(segmentsOf(sentence)).toEqual(['你', '好', '老师']);
  });
});

describe('the entry of a segment', () => {
  const targetOf = (sentence) => sentence.segments[sentence.targetIndex];

  it('takes the resolver entry of an HSK word: 发 is fā, not fà', () => {
    const [sentence] = sentencesOf(build([record('我发了。')]), '发');
    expect(targetOf(sentence)).toMatchObject({ s: '发', t: '發', p: 'fā' });
  });

  it('takes the resolver entry of 行, not the first entry in CC-CEDICT (háng)', () => {
    const [sentence] = sentencesOf(build([record('我行。')]), '行');
    expect(targetOf(sentence).p).toBe('xíng');
  });

  it('takes the first CC-CEDICT entry of a word outside HSK: 的 is de', () => {
    const [sentence] = sentencesOf(build([record('我的书。')]), '的');
    expect(targetOf(sentence)).toMatchObject({ p: 'de', e: "of; ~'s (possessive particle)" });
  });

  it('uses a name entry only when no other entry exists', () => {
    const [sentence] = sentencesOf(build([record('汤姆喜欢我。')]), '喜欢');
    expect(sentence.segments[0]).toMatchObject({ s: '汤姆', p: 'Tāng mǔ' });
  });

  it('gives a character with no entry an empty pinyin and gloss', () => {
    // 的 is outside HSK in the fixture, so a sentence with a level-7 segment passes.
    const [sentence] = sentencesOf(build([record('我的书啊。')]), '的');
    expect(sentence.segments.at(-1)).toEqual({ s: '啊', t: '啊', p: '', e: '' });
  });
});

describe('the traditional form', () => {
  it('joins the traditional form of each segment when the source has none', () => {
    const [sentence] = sentencesOf(
      build([record('我在家看书。', { source: 'sentenceCache', origin: { chinese: 'machine', english: 'machine' } })]),
      '书',
    );
    expect(sentence.trad).toBe('我在家看書。');
  });

  it("keeps the source's own traditional text and its forms in context: 頭髮, not 頭發", () => {
    const [sentence] = sentencesOf(
      build([wiktionary('他頭髮很好。', '他头发很好。')]),
      '头发',
    );
    expect(sentence.trad).toBe('他頭髮很好。');
    expect(sentence.segments[sentence.targetIndex].t).toBe('頭髮');
  });

  it('converts a source with only a traditional text to simplified', () => {
    const [sentence] = sentencesOf(build([wiktionary('他們說漢語。', null)]), '汉语');
    expect(sentence.simp).toBe('他们说汉语。');
    expect(sentence.trad).toBe('他們說漢語。');
  });
});

describe('the gloss', () => {
  const glossOf = (text, word) => {
    const [sentence] = sentencesOf(build([record(text)]), word);
    return sentence.segments[sentence.targetIndex].e;
  };

  it('strips a leading (bound form)', () => {
    expect(glossOf('我行。', '行')).toBe('to walk; to go; to travel');
  });

  it('skips a surname sense', () => {
    expect(glossOf('我张。', '张')).not.toMatch(/^surname/);
  });

  it('takes the first sense of a plain entry', () => {
    expect(glossOf('我去图书馆。', '图书馆')).toBe('library');
  });
});

describe('matching', () => {
  it('matches a word only through a whole segment: 生 does not match 学生', () => {
    const result = build([record('他是学生。')]);
    expect(sentencesOf(result, '学生')).toHaveLength(1);
    expect(sentencesOf(result, '生')).toEqual([]);
  });

  it('gives the first target segment as targetIndex', () => {
    const [sentence] = sentencesOf(build([record('我看，我看。')]), '看');
    expect(sentence.targetIndex).toBe(1);
  });

  it('drops a sentence of the word alone', () => {
    expect(sentencesOf(build([record('吃。')]), '吃')).toEqual([]);
  });
});

describe('duplicates and the id', () => {
  it('merges sentences with the same text, and the better source survives', () => {
    const result = buildExampleSentences({
      dictionary,
      hsk: HSK,
      sources: [
        { source: 'tatoeba', records: [record('我喜欢书。', { ownerLevel: 3 })] },
        { source: 'wiktionary', records: [wiktionary('我喜歡書。', ' 我喜欢书。')] },
      ],
      licences: LICENCES,
      toSimplified,
    });
    const sentences = sentencesOf(result, '喜欢');
    expect(sentences).toHaveLength(1);
    expect(sentences[0].source.name).toBe('wiktionary');
  });

  it('ranks a native Tatoeba owner above Wiktionary', () => {
    const result = buildExampleSentences({
      dictionary,
      hsk: HSK,
      sources: [
        { source: 'wiktionary', records: [wiktionary('我喜歡書。', '我喜欢书。')] },
        { source: 'tatoeba', records: [record('我喜欢书。', { ownerLevel: 5, sourceId: '77' })] },
      ],
      licences: LICENCES,
      toSimplified,
    });
    expect(sentencesOf(result, '喜欢')[0].source).toEqual({ name: 'tatoeba', id: 77 });
  });

  it('gives the first 10 hex characters of the SHA-1 of the trimmed NFC text', () => {
    expect(sentenceId(' 我喜欢书。 ')).toBe(sentenceId('我喜欢书。'));
    expect(sentenceId('我喜欢书。')).toMatch(/^[0-9a-f]{10}$/);
    const [sentence] = sentencesOf(build([record('我喜欢书。')]), '喜欢');
    expect(sentence.id).toBe(sentenceId('我喜欢书。'));
  });
});

describe('the grader', () => {
  const gradeOf = (text, word, options) => sentencesOf(build([record(text)], options), word)[0];

  it('gives the highest HSK level of the counted segments, without the target', () => {
    expect(gradeOf('我研究经济。', '经济')).toMatchObject({ hskLevel: 4, fill: 'relaxed' });
    expect(gradeOf('我研究经济。', '研究')).toMatchObject({ hskLevel: 3, fill: 'strict' });
  });

  it('counts a word in two lists at the lower level', () => {
    expect(gradeOf('我很好。', '我').hskLevel).toBe(1);
  });

  it('does not count names or numbers', () => {
    expect(gradeOf('汤姆吃了三十个。', '吃')).toBeUndefined(); // 个 is not in the fixture: level 7
    expect(gradeOf('汤姆吃了三十。', '吃')).toMatchObject({ hskLevel: 1, fill: 'strict' });
    expect(gradeOf('他是第一。', '他')).toMatchObject({ hskLevel: 1, fill: 'strict' });
  });

  it('counts a segment outside HSK at level 7', () => {
    // 假发 is not an HSK word, and it splits into 假 (no fixture entry) and 发.
    expect(gradeOf('我们研究假。', '我们')).toBeUndefined();
    expect(gradeOf('我研究经济。', '我')).toBeUndefined();
  });

  it('applies the length cap: 10 characters for HSK 1, digits included', () => {
    expect(gradeOf('我们喜欢书，我们喜欢书。', '书')).toMatchObject({ fill: 'strict' }); // 10
    expect(gradeOf('我们喜欢书，他们也喜欢书。', '书')).toBeUndefined(); // 12
    expect(gradeOf('我喜欢123456书。', '书')).toMatchObject({ fill: 'strict' }); // 10
    expect(gradeOf('我喜欢12345678书。', '书')).toBeUndefined(); // 11
  });

  it('gives an HSK 7–9 word and a word outside HSK no cap and no level rule', () => {
    expect(gradeOf('我们研究经济，他们研究文。', '文')).toMatchObject({ hskLevel: 4, fill: 'strict' });
    expect(gradeOf('我们研究经济，他们研究的。', '的')).toMatchObject({ fill: 'strict' });
  });

  it('drops a sentence with Latin letters', () => {
    const result = build([record('我喜欢Tom。')]);
    expect(sentencesOf(result, '喜欢')).toEqual([]);
    expect(result.rejects).toEqual([expect.objectContaining({ reason: 'holds Latin letters' })]);
  });
});

describe('the fill steps', () => {
  // Ten different HSK 1 sentences for 书, and one relaxed sentence (经济 is HSK 3,
  // two levels above 书, so it is rejected; 发 is HSK 3 too).
  const strictFor = (count) =>
    ['我看书。', '你看书。', '他看书。', '她看书。', '我们看书。', '他们看书。', '老师看书。', '朋友看书。',
     '我读书。', '你读书。', '他读书。', '她读书。'].slice(0, count).map((text) => record(text));

  it('takes strict sentences up to the cap of 10', () => {
    const sentences = sentencesOf(build(strictFor(12)), '书');
    expect(sentences).toHaveLength(10);
    expect(sentences.every((s) => s.fill === 'strict')).toBe(true);
  });

  it('fills a word with fewer than 5 strict sentences to 5 with relaxed ones', () => {
    // 行 is HSK 2: a sentence with one HSK 2 segment is relaxed for an HSK 1 word.
    const relaxed = ['我行书。', '你行书。', '他行书。', '她行书。'].map((text) => record(text));
    const sentences = sentencesOf(build([...strictFor(3), ...relaxed]), '书');
    expect(sentences.map((s) => s.fill)).toEqual(['strict', 'strict', 'strict', 'relaxed', 'relaxed']);
  });

  it('fills to 5 with generated sentences after the relaxed ones', () => {
    const gen = [generated('书', '老师读书。'), generated('书', '朋友读书。'), generated('书', '我们读书。')];
    const sentences = sentencesOf(build([...strictFor(2), record('我行书。')], { gen }), '书');
    expect(sentences.map((s) => s.fill)).toEqual(['strict', 'strict', 'relaxed', 'generated', 'generated']);
    expect(sentences.at(-1).origin).toEqual({ chinese: 'machine', english: 'machine' });
  });

  it('gives a word outside HSK any real sentence, and no generated one', () => {
    const sentences = sentencesOf(build([record('我们研究经济的书。')]), '的');
    expect(sentences).toHaveLength(1);
  });
});

describe('ranking and variety', () => {
  it('ranks by source, then by length', () => {
    const result = buildExampleSentences({
      dictionary,
      hsk: HSK,
      sources: [
        {
          source: 'tatoeba',
          records: [record('他们喜欢看书。'), record('他喜欢书。'), record('我们喜欢吃饭。', { ownerLevel: 5 })],
        },
      ],
      licences: LICENCES,
      toSimplified,
    });
    expect(sentencesOf(result, '喜欢').map((s) => s.simp)).toEqual([
      '我们喜欢吃饭。',
      '他喜欢书。',
      '他们喜欢看书。',
    ]);
  });

  it('skips a sentence that overlaps a picked one by more than half, then uses it to reach 5', () => {
    // 我看书 and 我看书了 share {我, 书} of {我, 书, 了}: 2/3 > 0.5.
    const records = ['我看书。', '我看书了。', '你看饭。', '大家吃。'].map((t) => record(t));
    const result = build([...records, record('他看了。')]);
    const texts = sentencesOf(result, '看').map((s) => s.simp);
    expect(texts.indexOf('我看书了。')).toBe(texts.length - 1);
  });

  it('drops an overlapping sentence when the word has its 10 without it', () => {
    const records = [
      '我看书。', '你看饭。', '他看了。', '她看大。', '我们看好。', '他们看中国。', '老师看电脑。',
      '朋友看我们。', '学生看今天。', '我看书了。', '汤姆看汉语。',
    ].map((t) => record(t));
    const texts = sentencesOf(build(records), '看').map((s) => s.simp);
    expect(texts).toHaveLength(10);
    expect(texts).not.toContain('我看书了。');
  });
});

describe('the output', () => {
  it('writes one file for each first character, in the shape of #465', () => {
    const result = build([record('我在图书馆看书。', { sourceId: '12345', owner: 'alice', englishId: '9', englishOwner: 'bob' })]);
    expect(Object.keys(result.files)).toContain('56fe');
    expect(result.files['56fe']['图书馆'][0]).toEqual({
      id: sentenceId('我在图书馆看书。'),
      simp: '我在图书馆看书。',
      trad: '我在圖書館看書。',
      english: 'English of 我在图书馆看书。',
      segments: [
        { s: '我', t: '我', p: 'wǒ', e: 'I; me; my' },
        { s: '在', t: '在', p: 'zài', e: expect.any(String) },
        { s: '图书馆', t: '圖書館', p: 'tú shū guǎn', e: 'library' },
        { s: '看', t: '看', p: 'kàn', e: expect.any(String) },
        { s: '书', t: '書', p: 'shū', e: expect.any(String) },
      ],
      targetIndex: 2,
      hskLevel: 1,
      fill: 'strict',
      source: { name: 'tatoeba', id: 12345 },
      origin: { chinese: 'human', english: 'human' },
    });
    expect(result.attribution).toEqual([
      `${sentenceId('我在图书馆看书。')} Tatoeba #12345 by alice; English: Tatoeba #9 by bob, CC BY 2.0 FR`,
    ]);
  });
});

describe('the report and the gaps', () => {
  it('counts the HSK words at each fill step, and the words with few or none', () => {
    const result = build([record('我看书。'), record('我行书。')]);
    const hsk1 = result.report.split('\n').find((line) => line.startsWith('| HSK 1 |'));
    // 看 is strict only. 我 and 书 need the relaxed 我行书. The other HSK 1 words have none.
    const hsk1Words = new Set(HSK.filter((w) => w.level === 1).map((w) => w.simp)).size;
    expect(hsk1).toBe(`| HSK 1 | ${hsk1Words} | 1 | 2 | 0 | ${hsk1Words} | ${hsk1Words - 3} | 0 |`);
  });

  it('reports a word that failed 3 rounds as unfilled, and leaves it out of the gaps', () => {
    const result = buildExampleSentences({
      dictionary,
      hsk: HSK,
      sources: [{ source: 'tatoeba', records: [record('我看书。')] }],
      unfilled: ['书', '研究'],
      licences: LICENCES,
      toSimplified,
    });
    expect(result.gaps.map((gap) => gap.word)).not.toContain('书');
    expect(result.gaps.map((gap) => gap.word)).not.toContain('研究');
    expect(result.report.split('\n').find((line) => line.startsWith('| HSK 4 |'))).toMatch(/ \| 1 \|$/);
    expect(result.report).toContain('## Unfilled after 3 rounds');
    expect(result.report).toContain('- HSK 1: 书');
    expect(result.report).toContain('- HSK 4: 研究');
  });

  it('lists each HSK word with fewer than 5 sentences, with its cap and need', () => {
    const result = build([record('我看书。')]);
    expect(result.gaps).toContainEqual({ word: '书', hskLevel: 1, lengthCap: 10, needed: 4 });
    expect(result.gaps).toContainEqual({ word: '研究', hskLevel: 4, lengthCap: 18, needed: 5 });
    expect(result.gaps).toContainEqual({ word: '文', hskLevel: 7, lengthCap: null, needed: 5 });
  });

  it('does not fail on coverage', () => {
    expect(() => build([])).not.toThrow();
  });
});

describe('build failures', () => {
  it('fails on a malformed source record', () => {
    expect(() => build([record('我看书。', { english: '' })])).toThrow(/malformed source record \(no English\)/);
    expect(() => build([record('我看书。', { origin: { chinese: 'human' } })])).toThrow(/origin/);
  });

  it('fails on a generated sentence that does not pass the strict rule', () => {
    expect(() => build([], { gen: [generated('书', '我研究书。')] })).toThrow(/generated "我研究书。" for 书/);
    expect(() => build([], { gen: [generated('书', '我看。')] })).toThrow(/no segment is 书/);
  });

  it('fails on a sentence file over 2 MB', () => {
    // The words that start with 我 share one file. A long English text takes
    // it over the limit.
    const english = 'x'.repeat(200 * 1024);
    const records = ['我看书。', '我吃饭。', '我喜欢书。', '我去中国。', '我很好。', '我们看书。',
      '我们吃饭。', '我们喜欢书。', '我们去中国。', '我们很好。', '我说汉语。', '我们说汉语。']
      .map((t) => record(t, { english }));
    expect(() => build(records)).toThrow(/over the limit of 2 MB/);
  });
});

describe('accepting generated candidates', () => {
  const inputs = (records, { gen = [], unfilled = [] } = {}) => ({
    dictionary,
    hsk: HSK,
    sources: [{ source: 'tatoeba', records }],
    generated: gen,
    unfilled,
    licences: LICENCES,
    toSimplified,
  });
  const accept = (candidates, { records = [], gen = [], rounds = {} } = {}) =>
    acceptCandidates(inputs(records, { gen }), candidates, rounds);

  it('accepts a candidate that passes and gives each reject its reason', () => {
    const result = accept([
      { word: '书', simp: '老师读书。', english: 'The teacher reads.' },
      { word: '书', simp: '我研究书。', english: 'I study books.' },
    ]);
    expect(result.records).toEqual([
      {
        source: 'generated',
        sourceId: sentenceId('老师读书。'),
        written: 'simp',
        simp: '老师读书。',
        trad: null,
        english: 'The teacher reads.',
        owner: null,
        headword: '书',
        generator: 'claude-code',
        origin: { chinese: 'machine', english: 'machine' },
      },
    ]);
    expect(result.rejects).toEqual([
      { word: '书', simp: '我研究书。', reason: 'segments above HSK 1: 研究 (4)' },
    ]);
  });

  it('accepts no more sentences than a word needs', () => {
    // 书 has 3 strict sentences, so it needs 2.
    const records = [record('我看书。'), record('你读书。'), record('他喜欢书。')];
    const result = accept(
      [
        { word: '书', simp: '老师读书。', english: 'a' },
        { word: '书', simp: '朋友喜欢书。', english: 'b' },
        { word: '书', simp: '我们去看书。', english: 'c' },
        { word: '是', simp: '我们是学生。', english: 'd' },
      ],
      { records: [...records, ...['我是。', '你是我们。', '他是老师。', '她是朋友。', '学生是我。'].map((t) => record(t))] },
    );
    expect(result.records.map((r) => r.simp)).toEqual(['老师读书。', '朋友喜欢书。']);
    expect(result.rejects).toEqual([
      { word: '书', simp: '我们去看书。', reason: 'the word needs no more sentences' },
      { word: '是', simp: '我们是学生。', reason: 'the word needs no more sentences' },
    ]);
  });

  it('rejects a candidate for a word outside HSK', () => {
    const result = accept([{ word: '汤姆', simp: '汤姆读书。', english: 'Tom reads.' }]);
    expect(result.rejects).toEqual([{ word: '汤姆', simp: '汤姆读书。', reason: 'is not an HSK word' }]);
  });

  it('rejects a candidate that is already a sentence, in a source or in the same round', () => {
    const result = accept(
      [
        { word: '书', simp: '我看书。', english: 'a' },
        { word: '书', simp: '老师读书。', english: 'b' },
        { word: '书', simp: '老师读书。', english: 'c' },
      ],
      { records: [record('我看书。')] },
    );
    expect(result.rejects.map((r) => r.reason)).toEqual(['is already a sentence', 'is already a sentence']);
  });

  it('rejects a candidate too like a sentence that the word has', () => {
    // {我, 看} of 我看书 against {我, 看, 了} of 我看书了: 2/3 > 0.5.
    const result = accept(
      [
        { word: '书', simp: '我看书了。', english: 'a' },
        { word: '书', simp: '老师读书。', english: 'b' },
        { word: '书', simp: '老师读书了。', english: 'c' },
      ],
      { records: [record('我看书。')] },
    );
    expect(result.records.map((r) => r.simp)).toEqual(['老师读书。']);
    expect(result.rejects.map((r) => r.reason)).toEqual(['too like 我看书。', 'too like 老师读书。']);
  });

  it('counts a failed round for each word that the round leaves short', () => {
    const result = accept(
      [
        { word: '书', simp: '我研究书。', english: 'a' },
        { word: '吃', simp: '我吃饭。', english: 'b' },
        { word: '吃', simp: '你吃了。', english: 'c' },
        { word: '吃', simp: '他们吃大饭。', english: 'd' },
        { word: '吃', simp: '老师去吃饭。', english: 'e' },
        { word: '吃', simp: '朋友很好吃。', english: 'f' },
      ],
      { rounds: { 书: 1, 吃: 2 } },
    );
    // 书 is still short. 吃 has its 5, so its count goes.
    expect(result.rounds).toEqual({ 书: 2 });
    expect(result.short).toEqual([{ word: '书', needed: 5 }]);
  });

  it('rejects a candidate for a word that failed 3 rounds', () => {
    const result = accept([{ word: '书', simp: '老师读书。', english: 'a' }], { rounds: { 书: 3 } });
    expect(result.rejects).toEqual([{ word: '书', simp: '老师读书。', reason: 'the word failed 3 rounds' }]);
    expect(result.rounds).toEqual({ 书: 3 });
  });

  it('rejects a candidate longer than the cap of its word', () => {
    const result = accept([{ word: '书', simp: '我们的老师今天很喜欢看书。', english: 'a' }]);
    expect(result.rejects).toEqual([
      { word: '书', simp: '我们的老师今天很喜欢看书。', reason: 'longer than the cap of 10 characters (12)' },
    ]);
  });
});
