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
  hskWord('张', 2, 600),
  hskWord('生', 2, 700),
  // 好 is in two lists: the lower level counts.
  hskWord('好', 3, 15),
];

let nextId = 1;
/** A record of the generated file: a sentence for one HSK word. */
const generated = (headword, simp, overrides = {}) => ({
  source: 'generated',
  sourceId: String(nextId++),
  written: 'simp',
  simp,
  trad: null,
  english: `English of ${simp}`,
  owner: null,
  headword,
  generator: 'claude-code',
  origin: { chinese: 'machine', english: 'machine' },
  ...overrides,
});

/** A record of the Tatoeba file, by a native Mandarin writer. */
const tatoeba = (simp, overrides = {}) => {
  const id = String(nextId++);
  return {
    source: 'tatoeba',
    sourceId: id,
    written: 'simp',
    simp,
    trad: null,
    english: `English of ${simp}`,
    owner: 'alice',
    englishId: `9${id}`,
    englishOwner: 'bob',
    origin: { chinese: 'human', english: 'human' },
    ...overrides,
  };
};

const build = (records, { hsk = HSK, unfilled = [], human = [] } = {}) =>
  buildExampleSentences({ dictionary, hsk, generated: records, tatoeba: human, unfilled });

/** The sentences that a build gives a word. */
const sentencesOf = (result, word) => {
  const file = result.files[word.codePointAt(0).toString(16)];
  return (file && file[word]) ?? [];
};
const segmentsOf = (sentence) => sentence.segments.map((s) => s.s);
/** The one sentence that a build of one generated record gives its word. */
const sentenceFor = (word, simp, options) => sentencesOf(build([generated(word, simp)], options), word)[0];

/** The reason that acceptCandidates rejects a candidate, or null when it accepts it. */
const rejectOf = (word, simp) => {
  const result = acceptCandidates({ dictionary, hsk: HSK }, [{ word, simp, english: 'x' }]);
  return result.rejects[0]?.reason ?? null;
};

describe('splitting', () => {
  it('prefers HSK words: 看书 is not an HSK word, so it splits as 看 / 书', () => {
    expect(segmentsOf(sentenceFor('书', '我在家看书。'))).toEqual(['我', '在家', '看', '书']);
  });

  it('takes more segments to avoid a word outside HSK', () => {
    const hsk = HSK.filter((w) => w.simp !== '在家');
    expect(segmentsOf(sentenceFor('书', '我在家看书。', { hsk }))).toEqual(['我', '在', '家', '看', '书']);
  });

  it('breaks a tie by the product of the ranks, not their sum', () => {
    // 下 / 课文 (ranks 70 and 30576) against 下课 / 文 (9694 and 1391).
    expect(segmentsOf(sentenceFor('课文', '请你读一下课文。'))).toEqual(['请', '你', '读', '一', '下', '课文']);
    expect(rejectOf('下课', '请你读一下课文。')).toMatch(/^no segment is 下课/);
  });

  it('leaves punctuation out of the segments and keeps it in the text', () => {
    const sentence = sentenceFor('老师', '你好，老师！');
    expect(sentence.simp).toBe('你好，老师！');
    expect(segmentsOf(sentence)).toEqual(['你', '好', '老师']);
  });
});

describe('the entry of a segment', () => {
  const targetOf = (sentence) => sentence.segments[sentence.targetIndex];

  it('takes the resolver entry of an HSK word: 发 is fā, not fà', () => {
    expect(targetOf(sentenceFor('发', '我发了。'))).toMatchObject({ s: '发', t: '發', p: 'fā' });
  });

  it('takes the resolver entry of 行, not the first entry in CC-CEDICT (háng)', () => {
    expect(targetOf(sentenceFor('行', '我行。')).p).toBe('xíng');
  });

  it('takes the first CC-CEDICT entry of a word outside HSK: 的 is de', () => {
    // 文 is HSK 7–9, so a sentence with a segment outside HSK passes.
    const sentence = sentenceFor('文', '我的文。');
    expect(sentence.segments[1]).toMatchObject({ s: '的', p: 'de', e: "of; ~'s (possessive particle)" });
  });

  it('uses a name entry only when no other entry exists', () => {
    expect(sentenceFor('喜欢', '汤姆喜欢我。').segments[0]).toMatchObject({ s: '汤姆', p: 'Tāng mǔ' });
  });

  it('gives a character with no entry an empty pinyin and gloss', () => {
    expect(sentenceFor('文', '我的文啊。').segments.at(-1)).toEqual({ s: '啊', t: '啊', p: '', e: '' });
  });
});

describe('the traditional form', () => {
  it('joins the traditional form of each segment', () => {
    expect(sentenceFor('书', '我在家看书。').trad).toBe('我在家看書。');
  });

  it('takes the form of the whole segment: 頭髮, not 頭發', () => {
    const sentence = sentenceFor('头发', '他头发很好。');
    expect(sentence.trad).toBe('他頭髮很好。');
    expect(sentence.segments[sentence.targetIndex].t).toBe('頭髮');
  });
});

describe('the gloss', () => {
  const glossOf = (word, text) => {
    const sentence = sentenceFor(word, text);
    return sentence.segments[sentence.targetIndex].e;
  };

  it('strips a leading (bound form)', () => {
    expect(glossOf('行', '我行。')).toBe('to walk; to go; to travel');
  });

  it('skips a surname sense', () => {
    expect(glossOf('张', '我张。')).not.toMatch(/^surname/);
  });

  it('takes the first sense of a plain entry', () => {
    expect(glossOf('图书馆', '我去图书馆。')).toBe('library');
  });
});

describe('matching', () => {
  it('matches a word only through a whole segment: 生 does not match 学生', () => {
    expect(sentenceFor('学生', '他是学生。')).toBeDefined();
    expect(rejectOf('生', '他是学生。')).toMatch(/^no segment is 生/);
  });

  it('gives the first target segment as targetIndex', () => {
    expect(sentenceFor('看', '我看，我看。').targetIndex).toBe(1);
  });

  it('rejects a sentence of the word alone', () => {
    expect(rejectOf('吃', '吃。')).toBe('holds only the word');
  });

  it('gives a sentence to every HSK word that it holds and passes the grader for', () => {
    // 研究 is HSK 4 and 经济 HSK 3: the sentence passes only for 研究.
    const result = build([generated('书', '我看书。'), generated('研究', '我研究经济。')]);
    expect(sentencesOf(result, '书')).toHaveLength(1);
    expect(sentencesOf(result, '我').map((s) => s.simp)).toEqual(['我看书。']);
    expect(sentencesOf(result, '看')[0]).toMatchObject({ simp: '我看书。', targetIndex: 1 });
    expect(sentencesOf(result, '研究')).toHaveLength(1);
    expect(sentencesOf(result, '经济')).toEqual([]);
  });

  it('gives a word outside HSK no sentences', () => {
    expect(rejectOf('的', '我们的书。')).toBe('is not an HSK word');
    expect(() => build([generated('的', '我们的书。')])).toThrow(/for 的: is for a word outside HSK/);
  });
});

describe('duplicates and the id', () => {
  it('keeps one sentence for each normalized text', () => {
    const result = build([generated('喜欢', '我喜欢书。'), generated('喜欢', ' 我喜欢书。')]);
    expect(sentencesOf(result, '喜欢')).toHaveLength(1);
  });

  it('gives the first 10 hex characters of the SHA-1 of the trimmed NFC text', () => {
    expect(sentenceId(' 我喜欢书。 ')).toBe(sentenceId('我喜欢书。'));
    expect(sentenceId('我喜欢书。')).toMatch(/^[0-9a-f]{10}$/);
    expect(sentenceFor('喜欢', '我喜欢书。').id).toBe(sentenceId('我喜欢书。'));
  });
});

describe('the grader', () => {
  it('gives the highest HSK level of the counted segments, without the target', () => {
    expect(sentenceFor('研究', '我研究经济。').hskLevel).toBe(3);
    expect(rejectOf('经济', '我研究经济。')).toBe('segments above HSK 3: 研究 (4)');
  });

  it('counts a word in two lists at the lower level', () => {
    expect(sentenceFor('我', '我很好。').hskLevel).toBe(1);
  });

  it('does not count names or numbers', () => {
    // 个 is not in the fixture, so it counts at level 7.
    expect(rejectOf('吃', '汤姆吃了三十个。')).toBe('segments above HSK 1: 个 (7)');
    expect(sentenceFor('吃', '汤姆吃了三十。').hskLevel).toBe(1);
    expect(sentenceFor('他', '他是第一。').hskLevel).toBe(1);
  });

  it('counts a segment outside HSK at level 7', () => {
    // 假 has no fixture entry.
    expect(rejectOf('我们', '我们研究假。')).toBe('segments above HSK 1: 研究 (4), 假 (7)');
  });

  it('applies the length cap: 10 characters for HSK 1, digits included', () => {
    expect(rejectOf('书', '我们喜欢书，我们喜欢书。')).toBeNull(); // 10
    expect(rejectOf('书', '我们喜欢书，他们也喜欢书。')).toBe('longer than the cap of 10 characters (11)');
    expect(rejectOf('书', '我喜欢123456书。')).toBeNull(); // 10
    expect(rejectOf('书', '我喜欢12345678书。')).toBe('longer than the cap of 10 characters (12)');
  });

  it('gives an HSK 7–9 word no cap and no level rule', () => {
    expect(sentenceFor('文', '我们研究经济，他们研究文。').hskLevel).toBe(4);
  });

  it('rejects a sentence with Latin letters', () => {
    expect(rejectOf('喜欢', '我喜欢Tom。')).toBe('holds Latin letters');
  });
});

describe('the pick', () => {
  const forBook = ['我看书。', '你看书。', '他看书。', '她看书。', '我们看书。', '他们看书。'];

  it('takes at most 3 sentences for a word', () => {
    const sentences = sentencesOf(build(forBook.map((t) => generated('书', t))), '书');
    expect(sentences).toHaveLength(3);
    expect(sentences.every((s) => s.fill === 'generated')).toBe(true);
  });

  it('ranks by length', () => {
    const records = ['他们喜欢看书了。', '他喜欢书。', '我们喜欢吃饭。'].map((t) => generated('喜欢', t));
    expect(sentencesOf(build(records), '喜欢').map((s) => s.simp)).toEqual([
      '他喜欢书。',
      '我们喜欢吃饭。',
      '他们喜欢看书了。',
    ]);
  });

  it('skips a sentence that overlaps a picked one by more than half, then uses it to reach 3', () => {
    // 我看书 and 我看书了 share {我, 书} of {我, 书, 了}: 2/3 > 0.5.
    const records = ['我看书。', '我看书了。', '他看了。'].map((t) => generated('看', t));
    const texts = sentencesOf(build(records), '看').map((s) => s.simp);
    expect(texts).toEqual(['我看书。', '他看了。', '我看书了。']);
  });

  it('drops an overlapping sentence when the word has its 3 without it', () => {
    const records = ['我看书。', '你看饭。', '他看了。', '我看书了。'].map((t) => generated('看', t));
    const texts = sentencesOf(build(records), '看').map((s) => s.simp);
    expect(texts).toHaveLength(3);
    expect(texts).not.toContain('我看书了。');
  });
});

describe('the output', () => {
  it('writes one file for each first character, in the shape of #465', () => {
    const result = build([generated('图书馆', '我在图书馆看书。')]);
    expect(Object.keys(result.files)).toEqual(['56fe']);
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
      fill: 'generated',
      source: { name: 'generated', id: sentenceId('我在图书馆看书。') },
      origin: { chinese: 'machine', english: 'machine' },
    });
    expect(result.count).toBe(1);
  });
});

describe('Tatoeba sentences', () => {
  const buildHuman = (records) => build([], { human: records });
  const textsOf = (result, word) => sentencesOf(result, word).map((s) => s.simp);

  it('gives a Tatoeba sentence to each HSK word that it holds and passes the grader for', () => {
    const result = buildHuman([tatoeba('我们喜欢看书。'), tatoeba('他们研究中国经济。')]);
    for (const word of ['我们', '喜欢', '看', '书']) {
      expect(textsOf(result, word)).toEqual(['我们喜欢看书。']);
    }
    // 研究 is HSK 4 and 经济 HSK 3: the second sentence passes only for 研究.
    expect(textsOf(result, '研究')).toEqual(['他们研究中国经济。']);
    expect(textsOf(result, '他们')).toEqual([]);
    expect(textsOf(result, '经济')).toEqual([]);
  });

  it('drops a Tatoeba sentence with fewer than 6 Han characters, digits not counted', () => {
    const result = buildHuman([tatoeba('我们看书了。'), tatoeba('我看了123书。'), tatoeba('我们喜欢看书。')]);
    expect(textsOf(result, '书')).toEqual(['我们喜欢看书。']);
  });

  it('drops a Tatoeba sentence with a name segment', () => {
    const result = buildHuman([tatoeba('汤姆喜欢看书了。'), tatoeba('他们喜欢看书了。')]);
    expect(textsOf(result, '喜欢')).toEqual(['他们喜欢看书了。']);
  });

  it('writes a Tatoeba sentence with its source and a human origin', () => {
    const record = tatoeba('我们喜欢看书。');
    const [sentence] = sentencesOf(buildHuman([record]), '书');
    expect(sentence).toMatchObject({
      fill: 'tatoeba',
      source: { name: 'tatoeba', id: Number(record.sourceId) },
      origin: { chinese: 'human', english: 'human' },
    });
  });

  it('credits each shipped Tatoeba sentence, and no other sentence', () => {
    const shipped = tatoeba('我们喜欢看书。');
    const result = build([generated('书', '老师读书。')], { human: [shipped, tatoeba('我们看书了。')] });
    expect(result.attribution).toEqual([
      `${sentenceId('我们喜欢看书。')} Tatoeba #${shipped.sourceId} by alice; ` +
        `English: Tatoeba #${shipped.englishId} by bob, CC BY 2.0 FR`,
    ]);
  });

  it('fails on a malformed Tatoeba record', () => {
    expect(() => buildHuman([tatoeba('我们喜欢看书。', { english: '' })])).toThrow(
      /malformed tatoeba record \(no English\)/,
    );
  });
});

describe('the report and the gaps', () => {
  const forBook = ['我看书。', '你看书。', '他看书。'];
  const hsk1Words = new Set(HSK.filter((w) => w.level === 1).map((w) => w.simp)).size;

  it('counts the HSK words that are filled, short, or have none', () => {
    const result = build(forBook.map((t) => generated('书', t)));
    const hsk1 = result.report.split('\n').find((line) => line.startsWith('| HSK 1 |'));
    // 书 and 看 have their 3. 我, 你 and 他 have 1. The other HSK 1 words have none.
    expect(hsk1).toBe(`| HSK 1 | ${hsk1Words} | 2 | ${hsk1Words - 2} | ${hsk1Words - 5} | 0 |`);
  });

  it('lists the HSK words that the sentences do not fill', () => {
    const result = build(forBook.map((t) => generated('书', t)));
    const hsk1 = result.report.split('\n').find((line) => line.startsWith('- HSK 1: '));
    const listed = hsk1.slice('- HSK 1: '.length).split(', ');
    expect(listed).toHaveLength(hsk1Words - 2);
    expect(listed).toContain('我');
    expect(listed).not.toContain('书');
    expect(listed).not.toContain('看');
    expect(result.report).toContain('- HSK 7–9: 文');
  });

  it('reports a word that failed 3 rounds as unfilled, and leaves it out of the gaps', () => {
    const result = build([generated('书', '我看书。')], { unfilled: ['书', '研究'] });
    expect(result.gaps.map((gap) => gap.word)).not.toContain('书');
    expect(result.gaps.map((gap) => gap.word)).not.toContain('研究');
    expect(result.report.split('\n').find((line) => line.startsWith('| HSK 4 |'))).toMatch(/ \| 1 \|$/);
    expect(result.report).toContain('## Unfilled after 3 rounds');
    expect(result.report).toContain('- HSK 1: 书');
    expect(result.report).toContain('- HSK 4: 研究');
  });

  it('lists each HSK word with fewer than 3 sentences, with its cap and need', () => {
    const result = build([generated('书', '我看书。')]);
    expect(result.gaps).toContainEqual({ word: '书', hskLevel: 1, lengthCap: 10, needed: 2 });
    expect(result.gaps).toContainEqual({ word: '研究', hskLevel: 4, lengthCap: 18, needed: 3 });
    expect(result.gaps).toContainEqual({ word: '文', hskLevel: 7, lengthCap: null, needed: 3 });
  });

  it('does not fail on coverage', () => {
    expect(() => build([])).not.toThrow();
  });
});

describe('build failures', () => {
  it('fails on a malformed generated record', () => {
    expect(() => build([generated('书', '我看书。', { english: '' })])).toThrow(
      /malformed generated record \(no English\)/,
    );
    expect(() => build([generated('书', '我看书。', { headword: undefined })])).toThrow(/no headword/);
    expect(() => build([generated('书', '我看书。', { simp: ' ' })])).toThrow(/no simp text/);
  });

  it('fails on a generated sentence that does not pass the grader', () => {
    expect(() => build([generated('书', '我研究书。')])).toThrow(/generated "我研究书。" for 书/);
    expect(() => build([generated('书', '我看。')])).toThrow(/no segment is 书/);
    expect(() => build([generated('喜欢', '我喜欢Tom。')])).toThrow(/holds Latin letters/);
  });

  it('fails on a sentence file over 2 MB', () => {
    // The words that start with 我 share one file. A long English text takes
    // it over the limit.
    const english = 'x'.repeat(400 * 1024);
    const records = [
      ...['我很好。', '我好。', '我是。', '我去。', '我说。'].map((t) => generated('我', t, { english })),
      ...['我们很好。', '我们好。', '我们是。', '我们去。', '我们说。'].map((t) =>
        generated('我们', t, { english }),
      ),
    ];
    expect(() => build(records)).toThrow(/over the limit of 2 MB/);
  });
});

describe('accepting generated candidates', () => {
  const accept = (candidates, { gen = [], rounds = {} } = {}) =>
    acceptCandidates({ dictionary, hsk: HSK, generated: gen, unfilled: [] }, candidates, rounds);

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
    // 书 has 1 sentence, so it needs 2. 是 has its 3.
    const gen = [
      generated('书', '我看书。'),
      ...['我是。', '你是我们。', '他是老师。'].map((t) => generated('是', t)),
    ];
    const result = accept(
      [
        { word: '书', simp: '老师读书。', english: 'a' },
        { word: '书', simp: '朋友喜欢书。', english: 'b' },
        { word: '书', simp: '我们去看书。', english: 'c' },
        { word: '是', simp: '我们是学生。', english: 'd' },
      ],
      { gen },
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

  it('rejects a candidate that is already a sentence, in the generated file or in the same round', () => {
    const result = accept(
      [
        { word: '我', simp: '我看书。', english: 'a' },
        { word: '书', simp: '老师读书。', english: 'b' },
        { word: '书', simp: '老师读书。', english: 'c' },
      ],
      { gen: [generated('书', '我看书。')] },
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
      { gen: [generated('书', '我看书。')] },
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
    // 书 is still short. 吃 has its 3, so its count goes.
    expect(result.rounds).toEqual({ 书: 2 });
    expect(result.short).toEqual([{ word: '书', needed: 3 }]);
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
