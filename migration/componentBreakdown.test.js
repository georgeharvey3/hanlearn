import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  breakdownContext,
  breakdownFileName,
  breakdownOf,
  buildBreakdowns,
  compareWithWiktionary,
  firstSense,
  parseAcjk,
  parseIds,
  parseMakeMeAHanzi,
  strokeOrder,
  wiktionaryComposition,
} from './componentBreakdown';
import { endsOf } from './strokeMedians';

const COMPONENTS = path.join(__dirname, 'components');
const SOURCE = path.join(COMPONENTS, 'source');
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));

/** The committed sources of the build. */
const entries = parseMakeMeAHanzi(fs.readFileSync(path.join(SOURCE, 'dictionary.txt'), 'utf8'));
const strokeCounts = readJson(SOURCE, 'stroke-counts.json').counts;
const strokeEnds = Object.fromEntries(
  Object.entries(readJson(SOURCE, 'stroke-medians.json').medians).map(([char, medians]) => [char, endsOf(medians)]),
);
const animcjk = readJson(SOURCE, 'animcjk.json');
const definitions = readJson(COMPONENTS, 'definitions.json').definitions;
const committedLabels = readJson(COMPONENTS, 'labels.json');

const sources = { entries, strokeCounts, strokeEnds, animcjk, definitions };

/** One context for the committed files: its build reads 18000 texts. */
const committed = breakdownContext({ ...sources, labels: committedLabels });

const breakdown = (char) => breakdownOf(committed, char);

/** The characters of a list of parts, null for a piece with no name. */
const charsOf = (parts) => parts.map((part) => part.c);

const range = (from, to) => [...Array(to - from + 1).keys()].map((i) => i + from);

/** Every part of a breakdown, at any depth. */
const allParts = (parts) => (parts ?? []).flatMap((part) => [part, ...allParts(part.p)]);

describe('parseAcjk', () => {
  it('gives each part the next strokes of the character', () => {
    const { char, strokes, root, irregular } = parseAcjk('續⿰糹.6賣15');
    expect({ char, strokes, irregular }).toEqual({ char: '續', strokes: 21, irregular: false });
    expect(root.kids).toEqual([
      { c: '糹', s: range(0, 5), kids: null },
      { c: '賣', s: range(6, 20), kids: null },
    ]);
  });

  it('gives a group with no name its text, and a named part its parts in place', () => {
    const [group, bird] = parseAcjk('難⿰⿱廿4⿻口3夫4隹.8').root.kids;
    expect(group).toMatchObject({ c: null, ids: '⿱廿⿻口夫', s: range(0, 10) });
    expect(bird).toMatchObject({ c: '隹', s: range(11, 18) });
    const [, buy] = parseAcjk('賣⿱士3買⿱罒5貝.7').root.kids;
    expect(buy).toMatchObject({ c: '買', s: range(3, 14) });
    expect(charsOf(buy.kids)).toEqual(['罒', '貝']);
  });

  it('joins the pieces of a split component', () => {
    const [nail, mouth] = parseAcjk('可⿹丁:1口.3丁:1').root.kids;
    expect(nail).toMatchObject({ c: '丁', s: [0, 4], kids: null });
    expect(nail.partial.map((piece) => piece.s)).toEqual([[0], [4]]);
    expect(mouth).toMatchObject({ c: '口', s: [1, 2, 3] });
  });

  it('joins a piece to its component when another part of the text holds it', () => {
    // 午 holds 干, and the last strokes of 干 come after the group that follows 午.
    const [noon, rest] = parseAcjk('年⿻午⿰丿1干.:1⿱一1丨1干.:2').root.kids;
    expect(noon).toMatchObject({ c: '午', s: [0, 1, 4, 5] });
    expect(rest.s).toEqual([2, 3]);
  });

  it('tells two split components of one character apart by their letter', () => {
    const { root } = parseAcjk('眔⿱⺫.5⿻丨1⿱八:a1八:b1八:a1八:b1');
    const [first, second] = root.kids[1].kids[1].kids;
    expect([first.s, second.s]).toEqual([[6, 8], [7, 9]]);
  });

  it('gives a stroke that two components share to both', () => {
    const [hill, hand] = parseAcjk('臼.⿱𠀉:3彐:2𠀉::彐:1').root.kids;
    expect(hill).toMatchObject({ c: '𠀉', s: [0, 1, 2, 5] });
    expect(hand).toMatchObject({ c: '彐', s: [3, 4, 5] });
  });

  it('gives a shared stroke inside a named part to that part, not to a second part of its name', () => {
    const [group] = parseAcjk('养⿱⿸⺶⿱丷.2⿻三3⺶::介:1介3').root.kids;
    const [sheep, between] = group.kids;
    const names = (node) => (node.kids ?? node.partial ?? []).flatMap((kid) => [kid.c, ...names(kid)]);
    expect(sheep).toMatchObject({ c: '⺶', s: [0, 1, 2, 3, 4, 5] });
    expect(names(sheep)).not.toContain('⺶');
    expect(between).toMatchObject({ c: '介', s: [5, 6, 7, 8] });
  });

  it('keeps both characters of one part', () => {
    const [, tongue] = parseAcjk('舎⿱𠆢2舌~𠮷.6').root.kids;
    expect(tongue).toMatchObject({ c: '𠮷', alt: '舌', s: range(2, 7) });
  });

  it('reads a text with another operand count, and marks it', () => {
    const party = parseAcjk('党⿳龸5兄⿱口3儿.2');
    expect(party.irregular).toBe(true);
    expect(party.root.kids.map((kid) => [kid.c, kid.s.length])).toEqual([['龸', 5], ['兄', 5]]);
    const clothes = parseAcjk('衣.亠2𧘇4');
    expect(clothes.irregular).toBe(true);
    expect(charsOf(clothes.root.kids)).toEqual(['亠', '𧘇']);
  });

  it('fails on a text with no stroke count', () => {
    expect(() => parseAcjk('𧘇.⿰⿱丿1𠄌1⿺1丿1㇏')).toThrow(/expected/);
  });

  it('parses every committed definition, with the operand counts of its operators', () => {
    for (const text of definitions) expect(parseAcjk(text).irregular, text).toBe(false);
  });
});

describe('strokeOrder', () => {
  const across = [0, 500, 900, 500];
  const down = [500, 900, 500, 0];
  const dot = [100, 800, 150, 750];

  it('gives each stroke its own index when the strokes are in the same order', () => {
    expect(strokeOrder([across, down], [[5, 495, 890, 505], down])).toEqual([0, 1]);
  });

  it('gives the place of each stroke when the order differs', () => {
    expect(strokeOrder([across, down, dot], [down, dot, across])).toEqual([2, 0, 1]);
  });

  it('gives null when the counts differ, or when two strokes are nearest to one stroke', () => {
    expect(strokeOrder([across, down], [across])).toBeNull();
    expect(strokeOrder([across, across], [across, down])).toBeNull();
  });
});

describe('breakdownOf', () => {
  it('splits every part of 續 until it is one stroke', () => {
    const { p } = breakdown('續');
    expect(p[0]).toMatchObject({ c: '糹', l: 'silk', s: range(0, 5) });
    expect(p[1]).toMatchObject({ c: '賣', y: 'mài', s: range(6, 20) });
    expect(charsOf(p[1].p)).toEqual(['士', '買']);
    expect(charsOf(p[1].p[1].p)).toEqual(['罒', '貝']);
    for (const part of allParts(p)) expect(Boolean(part.p)).toBe(part.s.length > 1);
  });

  it('names a part by the form that the character draws', () => {
    // Make Me a Hanzi calls the right side of 聯 絲, whose parts sit side by side.
    const [ear, silk] = breakdown('聯').p;
    expect(ear).toMatchObject({ c: '耳', s: range(0, 5) });
    expect(silk).toMatchObject({ c: '𢇇', s: range(6, 16) });
    expect(silk.p.map((part) => [part.c, part.s])).toEqual([
      ['𢆶', range(6, 11)],
      ['丱', range(12, 16)],
    ]);
    expect(breakdown('跑').p[0]).toMatchObject({ c: '𧾷', l: 'foot' });
  });

  it('gives a part the definition of its character with the same number of strokes', () => {
    // 朗 draws 良 with 6 strokes, and 良 alone has 7. The definitions file has the form.
    const [good] = breakdown('朗').p;
    expect(good).toMatchObject({ c: '良', s: range(0, 5) });
    expect(charsOf(good.p)).toEqual(['丶', '𫜹', '𠄌', '丶']);
  });

  it('makes a group that the labels file names a step, and joins the pieces of any other group', () => {
    const [clay, bird] = breakdown('難').p;
    expect(clay).toMatchObject({ c: '𦰩', l: 'clay (old form)', s: range(0, 10) });
    expect(charsOf(clay.p)).toEqual(['廿', '口', '夫']);
    expect(bird).toMatchObject({ c: '隹' });
    const plain = breakdownOf(breakdownContext({ ...sources, labels: {} }), '難');
    expect(charsOf(plain.p)).toEqual(['廿', '口', '夫', '隹']);
  });

  it('keeps a group that is a real character as a step', () => {
    const brain = breakdown('脑').p[1];
    expect(brain).toMatchObject({ c: '㐫', l: 'fierce (old form)', s: range(4, 9) });
    expect(charsOf(brain.p)).toEqual(['亠', '凶']);
  });

  it('takes the Make Me a Hanzi entry of a character that AnimCJK draws with other strokes', () => {
    const { p } = breakdown('僱');
    expect(p.map((part) => [part.c, part.s])).toEqual([['亻', [0, 1]], ['雇', range(2, 13)]]);
    expect(charsOf(p[1].p)).toEqual(['户', '隹']);
  });

  it('takes a definition of the file before the other sources', () => {
    // Make Me a Hanzi calls the right side of 嘆 堇, whose bottom is 土.
    const sigh = breakdown('嘆').p[1];
    expect(sigh).toMatchObject({ c: '𦰩', s: range(3, 13) });
    expect(charsOf(sigh.p)).toEqual(['廿', '口', '夫']);
  });

  it('splits 酉 into 兀 laid over 日, with the bottom line in 日', () => {
    // AnimCJK gives 酉 as 西 + 一, so its 口 closed on the inner line.
    expect(breakdown('酉').p.map((part) => [part.c, part.s])).toEqual([
      ['兀', [0, 3, 4]],
      ['日', [1, 2, 5, 6]],
    ]);
    const wine = breakdown('酒').p.find((part) => part.c === '酉');
    expect(charsOf(wine.p)).toEqual(['兀', '日']);
  });

  it('gives a stroke that two parts share to both', () => {
    const [field, earth] = breakdown('里').p;
    expect(field).toMatchObject({ c: '田', s: [0, 1, 2, 3, 4] });
    expect(earth).toMatchObject({ c: '土', s: [4, 5, 6] });
  });

  it('pairs two strokes again when each one is proved to be in the place of the other', () => {
    // 里 draws 田 as 丨 𠃍 一 一 丨, and 田 alone is 丨 𠃍 一 丨 一.
    const [field] = breakdown('里').p;
    expect(field.p.map((part) => [part.c, part.s])).toEqual([['囗', [0, 1, 3]], ['十', [2, 4]]]);
    expect(field.p[1].p.map((part) => [part.c, part.s])).toEqual([['一', [2]], ['丨', [4]]]);
    // 布 draws 𠂇 as 一 丿, and the definition of 𠂇 is 丿 一.
    const hand = breakdown('佈').p[1].p[0];
    expect(hand.p.map((part) => [part.c, part.s])).toEqual([['一', [2]], ['丿', [3]]]);
  });

  it('leaves a stroke with a loose name in its place', () => {
    // AnimCJK calls the dot of 監 一. No other stroke is in the wrong place.
    const { p } = breakdown('監');
    expect(p.map((part) => [part.c, part.s])).toEqual([
      ['臣', range(0, 5)],
      ['𠂉', [6, 7]],
      ['一', [8]],
      ['皿', range(9, 13)],
    ]);
  });

  it('pairs no strokes again with no stroke ends', () => {
    const context = breakdownContext({ ...sources, strokeEnds: undefined, labels: {} });
    const field = breakdownOf(context, '里').p[0];
    expect(field.p.map((part) => [part.c, part.s])).toEqual([['囗', [0, 1, 4]], ['十', [2, 3]]]);
  });

  it('gives a character of one stroke no parts', () => {
    expect(breakdown('一')).toMatchObject({ c: '一', p: null });
  });

  it('fails when the stroke data has no character', () => {
    const context = breakdownContext({ ...sources, strokeCounts: {}, labels: {} });
    expect(() => breakdownOf(context, '射')).toThrow(/no Hanzi Writer stroke data/);
  });
});

describe('the origin of breakdownOf', () => {
  it('gives a story origin, with the strokes of the part that each character of the story is', () => {
    expect(breakdown('休').o).toEqual({
      // The data puts a no-break space before each character, and the build keeps it.
      t: ['A person\u00a0', { c: '亻', s: [0, 1] }, ' leaning against a tree\u00a0', { c: '木', s: [2, 3, 4, 5] }],
    });
  });

  it('keeps a character of the story that is no part in the text', () => {
    // 学 names ⺍, and the breakdown draws the top as 𭕄.
    const { t } = breakdown('学').o;
    expect(t).toContainEqual({ c: '冖', s: [3, 4] });
    expect(t).toContainEqual({ c: '子', s: [5, 6, 7] });
    expect(t[t.length - 1]).toBe('\u00a0study;\u00a0⺍ provides the pronunciation');
  });

  it('matches a character of the story to a deeper part, and to another form of it', () => {
    const context = breakdownContext({ ...sources, labels: {} });
    const entry = { ...entries.get('休'), etymology: { type: 'ideographic', hint: 'A man 人 by wood 十' } };
    context.entries.set('休', entry);
    expect(breakdownOf(context, '休').o.t).toEqual([
      'A man ',
      { c: '人', s: [0, 1] },
      ' by wood ',
      { c: '十', s: [2, 3] },
    ]);
  });

  it('takes the origin of a traditional character from its own entry', () => {
    expect(breakdown('媽').o.n).toMatchObject({ c: '馬' });
    expect(breakdown('妈').o.n).toMatchObject({ c: '马' });
  });

  it('gives a meaning-and-sound origin, with the gloss and the pinyin of the sound part', () => {
    expect(breakdown('妈').o).toEqual({
      m: { c: '女', l: 'woman', s: [0, 1, 2] },
      n: { c: '马', y: 'mǎ', s: [3, 4, 5] },
    });
  });

  it('finds the meaning part by the stroke match, under the name of the form drawn', () => {
    // The data names 足, and 跑 draws 𧾷.
    expect(breakdown('跑').o.m).toEqual({ c: '𧾷', l: 'foot', s: [0, 1, 2, 3, 4, 5, 6] });
    // 德 has no sound part, and its 心 is under 𢛳, a step that Make Me a Hanzi does not have.
    expect(breakdown('德').o).toEqual({ m: { c: '心', l: 'heart', s: [11, 12, 13, 14] } });
  });

  it('finds a side by its character at any level when the entry gives it no strokes', () => {
    // Make Me a Hanzi gives 塗 as 涂 over 土, so 氵 and 余 have no strokes of their own.
    expect(breakdown('塗').o).toEqual({
      m: { c: '氵', l: 'water', s: [0, 1, 2] },
      n: { c: '余', y: 'yú', s: [3, 4, 5, 6, 7, 8, 9] },
    });
    // 膚 names ⺼, and the drawing has 月 inside 胃.
    expect(breakdown('膚').o.m).toMatchObject({ c: '月', s: expect.any(Array) });
  });

  it('matches a character of the story to the variant form that the drawing has', () => {
    // The story of 亲 names 木, and 亲 draws 朩.
    expect(breakdown('亲').o.t).toContainEqual({ c: '木', s: [5, 6, 7, 8] });
    // The story of 凶 names 乂, and 凶 draws 㐅.
    expect(breakdown('凶').o.t).toContainEqual({ c: '乂', s: [0, 1] });
  });

  it('gives no origin with no etymology, and none for a meaning-and-sound entry with no parts', () => {
    const context = breakdownContext({ ...sources, labels: {} });
    const plain = (etymology) => {
      context.entries.set('妈', { ...entries.get('妈'), etymology });
      return breakdownOf(context, '妈');
    };
    expect(plain(undefined)).not.toHaveProperty('o');
    expect(plain({ type: 'pictophonetic', hint: 'woman' })).not.toHaveProperty('o');
    expect(plain({ type: 'ideographic' })).not.toHaveProperty('o');
  });

  it('writes no role on any part', () => {
    for (const char of ['續', '跑', '德', '礙']) {
      for (const part of allParts(breakdown(char).p)) expect(part).not.toHaveProperty('r');
    }
  });
});

describe('buildBreakdowns', () => {
  const build = (chars, options = {}) => buildBreakdowns({ chars, ...sources, labels: {}, ...options });

  it('splits a named part with no definition into its strokes, and lists it', () => {
    const result = build(['朗'], { definitions: [] });
    expect(result.unresolved).toEqual(['朗 > 良/6']);
    const good = result.files[breakdownFileName('朗')].p[0];
    expect(good.p).toEqual(range(0, 5).map((i) => ({ c: null, s: [i], l: null })));
    expect(build(['朗']).unresolved).toEqual([]);
  });

  it('names no group by a decomposition that leaves out strokes of its character', () => {
    // Make Me a Hanzi gives 求 as ⿻一氺, and the dot is in no piece.
    const result = build(['求', '囱']);
    const named = (parts) => (parts ?? []).flatMap((part) => [part.c, ...named(part.p)]);
    expect(named(result.files[breakdownFileName('求')].p)).not.toContain('求');
    expect(named(result.files[breakdownFileName('囱')].p)).not.toContain('囱');
  });

  it('lists a part that has the name of a character above it', () => {
    // 好 = 女 + 子, and the labels file names the group of 子 好.
    const result = build(['好'], { definitions: ['好⿰女3⿱乛1⿻一1亅1'], labels: { groups: { '⿱乛⿻一亅': '好' } } });
    expect(result.selfNamed).toEqual(['好 > 好']);
    expect(build(['好']).selfNamed).toEqual([]);
  });

  it('lists the definitions of the file that no breakdown uses', () => {
    const text = '良⿱丶1⿰⿰𫜹3𠄌1丶1';
    expect(build(['朗'], { definitions: [text] }).unusedDefinitions).toEqual([]);
    expect(build(['射'], { definitions: [text] }).unusedDefinitions).toEqual([text]);
  });

  it('gives the source of the definition of each character', () => {
    const result = build(['續', '僱', '嘆', '一']);
    expect(result.sources).toEqual({ 續: 'hans', 僱: 'makemeahanzi', 嘆: 'file', 一: null });
  });

  it('lists the parts that the top character draws in another stroke order', () => {
    expect(build(['里']).reordered).toEqual(['里 > 十/2', '里 > 田/5']);
  });

  it('lists the texts in use that have another operand count', () => {
    expect(build(['党']).irregular).toEqual(['hans: 党⿳龸5兄⿱口3儿.2']);
  });

  it('names each file by the code point of its character, and skips a character with no data', () => {
    const result = build(['礙', '\u{2FFFF}']);
    expect(Object.keys(result.files)).toContain('7919');
    expect(result.missing).toEqual(['\u{2FFFF}']);
  });

  it('gives a part that is only a shape its label and no pinyin', () => {
    const shape = (labels) =>
      allParts(build(['嚴'], { labels }).files[breakdownFileName('嚴')].p).find((part) => part.c === '丅');
    expect(shape({ labels: { 丅: 'below' } })).toMatchObject({ l: 'below', y: 'xià' });
    const part = shape({ labels: { 丅: 'T shape' }, shapes: ['丅'] });
    expect(part.l).toBe('T shape');
    expect(part).not.toHaveProperty('y');
  });

  it('fills a part with a fallback label, and lists it', () => {
    const result = build(['射']);
    const [body, hand] = result.files[breakdownFileName('射')].p;
    expect([body.l, hand.l]).toEqual(['body', 'inch']);
    expect(result.fallback).toContain('身');
    const labelled = build(['射'], { labels: { labels: { 身: 'body', 寸: 'hand' } } });
    expect(labelled.files[breakdownFileName('射')].p[1].l).toBe('hand');
    expect(labelled.fallback).not.toContain('身');
  });

  it('replaces the origin of a character with its override, and removes one', () => {
    const story = { type: 'ideographic', hint: 'A child 子 under a roof 冖' };
    const result = build(['学', '妈'], { origins: { 学: story, 妈: null } });
    expect(result.files[breakdownFileName('学')].o.t).toEqual([
      'A child ',
      { c: '子', s: [5, 6, 7] },
      ' under a roof ',
      { c: '冖', s: [3, 4] },
    ]);
    expect(result.files[breakdownFileName('妈')]).not.toHaveProperty('o');
    expect(result.unknownOrigins).toEqual([]);
  });

  it('lists an override for a character with no breakdown file', () => {
    expect(build(['妈'], { origins: { 妈: null, 㚢: null } }).unknownOrigins).toEqual(['㚢']);
  });

  it('lists each origin that does not fit its breakdown', () => {
    const result = build(['学', '妈', '休'], {
      origins: { 妈: { type: 'pictophonetic', semantic: '女', phonetic: '龘', hint: 'woman' } },
    });
    expect(result.originMismatches).toEqual([
      { char: '妈', side: 'sound', part: '龘' },
      { char: '学', side: 'story', part: '⺍' },
    ]);
  });

  it('lists the labels of parts that are in no tree', () => {
    const result = build(['射'], { labels: { labels: { 身: 'body', 龘: 'dragons' } } });
    expect(result.unused).toEqual(['龘']);
  });
});

describe('the committed files', () => {
  /** Each character that AnimCJK and Hanzi Writer both have, in the simplified set. */
  const chars = Object.keys(animcjk.sets.hans).filter((char) => strokeCounts[char] !== undefined);
  const result = buildBreakdowns({ chars, ...sources, labels: committedLabels });

  it('split every part until it is one stroke', () => {
    // One expect for the whole set: an expect for each of the many parts is too slow for the timeout.
    const wrong = Object.values(result.files).flatMap((file) =>
      allParts(file.p)
        .filter((part) => Boolean(part.p) !== part.s.length > 1)
        .map((part) => `${file.c} > ${part.c}`),
    );
    expect(wrong).toEqual([]);
  });

  it('give each part strokes of its parent, and every stroke of a part to one of its parts', () => {
    const check = (char, strokes, parts) => {
      const inside = new Set(parts.flatMap((part) => part.s));
      expect([...inside].sort((a, b) => a - b), char).toEqual(strokes);
      for (const part of parts) if (part.p) check(char, part.s, part.p);
    };
    for (const file of Object.values(result.files)) {
      if (file.p) check(file.c, range(0, strokeCounts[file.c] - 1), file.p);
    }
  });

  it('give 凶 and 丷 a learner label, not the dictionary sense', () => {
    expect(committedLabels.labels['凶']).toBe('fierce');
    expect(firstSense(entries.get('凶').definition)).toBe('culprit');
    expect(committedLabels.labels['丷']).toBeTruthy();
  });
});

describe('parseIds', () => {
  it('parses a nested sequence with an unnamed piece', () => {
    expect(parseIds('⿰亻⿱？口')).toEqual({
      op: '⿰',
      ids: '⿰亻⿱？口',
      children: [
        { char: '亻' },
        { op: '⿱', ids: '⿱？口', children: [{ char: null }, { char: '口' }] },
      ],
    });
  });

  it('fails on a malformed sequence', () => {
    expect(() => parseIds('⿰亻')).toThrow(/malformed/);
    expect(() => parseIds('亻口')).toThrow(/malformed/);
  });
});

describe('labels', () => {
  it('takes the first sense of a definition', () => {
    expect(firstSense('culprit; murder; bad, sad')).toBe('culprit');
    expect(firstSense('(archaic) table')).toBe('table');
    expect(firstSense('')).toBeNull();
    expect(firstSense(undefined)).toBeNull();
  });
});

describe('compareWithWiktionary', () => {
  /** A breakdown with these top-level parts. */
  const tree = (c, parts) => ({ c, p: parts.map((part, i) => ({ c: part, s: [i], l: null })) });

  it('lists a character whose top-level parts differ from its composition', () => {
    const result = compareWithWiktionary([tree('好', ['女', '子']), tree('丑', ['𠃌', '丨', '一', '一'])], {
      好: '⿰女子',
      丑: '⿴ユ十(HJKTV) or ⿻彐丨(G)',
    });
    expect(result.differences).toEqual([
      { char: '丑', parts: ['𠃌', '丨', '一', '一'], composition: '⿴ユ十(HJKTV) or ⿻彐丨(G)', tops: ['丑'], strokes: true },
    ]);
  });

  it('compares every named part at every level, once for each split', () => {
    const part = (c, parts = null) => ({ c, s: [0, 1], l: null, ...(parts ? { p: parts } : {}) });
    // 賣 splits wrongly into 士 + 貝 in 續 and in 讀. 糹 and the piece with no name are not compared.
    const sells = () => part('賣', [part('士', [part('十'), part('一')]), part('貝')]);
    const breakdowns = [
      { c: '續', p: [part('糹'), sells()] },
      { c: '讀', p: [part('訁'), sells()] },
      { c: '买', p: [part(null, [part('一'), part('丨')]), part('头')] },
    ];
    const result = compareWithWiktionary(breakdowns, {
      續: '⿰糹賣',
      讀: '⿰言賣',
      賣: '⿱士買',
      士: '⿱十一',
      买: '⿱乛头',
    });
    expect(result.differences).toEqual([
      { char: '賣', parts: ['士', '貝'], composition: '⿱士買', tops: ['續', '讀'], strokes: false },
      { char: '买', parts: [null, '头'], composition: '⿱乛头', tops: ['买'], strokes: false },
    ]);
  });

  it('marks a split into strokes, which can name no wrong part', () => {
    const stroke = (c, i) => ({ c, s: [i], l: null });
    const mouth = { c: '口', p: [stroke('丨', 0), stroke('𠃍', 1), stroke('一', 2)] };
    const result = compareWithWiktionary([mouth], { 口: '⿱冂一' });
    expect(result.differences.map((d) => d.strokes)).toEqual([true]);
  });

  it('treats a side form and its full form as the same part', () => {
    const result = compareWithWiktionary(
      [tree('你', ['亻', '尔']), tree('肌', ['月', '几']), tree('泳', ['氵', '永']), tree('帅', ['刂', '巾'])],
      { 你: '⿰人尔', 肌: '⿰⺼几', 泳: '⿰水永', 帅: '⿰リ巾' },
    );
    expect(result.differences).toEqual([]);
  });

  it('treats the code point of a variant shape that only components use as its character', () => {
    const result = compareWithWiktionary(
      [tree('月', ['⺆', '二']), tree('妇', ['女', '彐']), tree('节', ['艹', '卩']), tree('變', ['䜌', '攵'])],
      { 月: '⿵⺆𠄠', 妇: '⿰女𫜹', 节: '⿱艹𰆊', 變: '⿱龻攵' },
    );
    expect(result.differences).toEqual([]);
  });

  it('matches a part that one side splits, when its own composition gives the parts of the other side', () => {
    const compositions = { 劳: '⿱𫇦力', 𫇦: '⿱艹冖', 器: '⿱哭吅', 哭: '⿱吅犬', 㗊: '⿱吅吅', 獄: '⿰狺犬' };
    const result = compareWithWiktionary(
      [tree('劳', ['艹', '冖', '力']), tree('器', ['㗊', '犬']), tree('獄', ['犭', '訧'])],
      compositions,
    );
    expect(result.differences.map((d) => d.char)).toEqual(['獄']);
  });

  it('lists a character with no composition, or with one that does not parse, apart', () => {
    const result = compareWithWiktionary([tree('好', ['女', '子']), tree('丐', ['一', '丏'])], { 好: '⿰女' });
    expect(result).toEqual({ differences: [], absent: ['丐'], malformed: ['好'] });
  });

  it('keeps two characters with the same shape apart', () => {
    const result = compareWithWiktionary([tree('皇', ['白', '玉']), tree('明', ['日', '肉'])], {
      皇: '⿱白王',
      明: '⿰日月',
    });
    expect(result.differences.map((d) => d.char)).toEqual(['皇', '明']);
  });

  it('matches no parts to a composition that takes one part away from another', () => {
    const result = compareWithWiktionary([tree('即', ['艮', '㇒'])], { 即: '㇯艮㇒' });
    expect(result.differences.map((d) => d.char)).toEqual(['即']);
  });

  it('lists an empty composition as one that does not parse', () => {
    expect(compareWithWiktionary([tree('好', ['女', '子'])], { 好: '' }).malformed).toEqual(['好']);
  });

  it('reads a composition with a space before its regions or after a comma', () => {
    const result = compareWithWiktionary([tree('倦', ['亻', '巻'])], { 倦: '⿰亻卷 (GTKV), ⿰亻巻 (J)' });
    expect(result).toEqual({ differences: [], absent: [], malformed: [] });
  });
});

describe('wiktionaryComposition', () => {
  const gloss = (text) => ({ word: '好', pos: 'character', senses: [{ glosses: [text] }] });

  it('takes the ids of the Han char template', () => {
    const entry = {
      word: '赤',
      pos: 'character',
      head_templates: [{ name: 'Han char', args: { rn: '155', ids: '⿱土⿻小丿(GTJKV),⿱土⿻小丨(H)' } }],
      senses: [{ glosses: ['赤 (Kangxi radical 155, composition ⿱土⿻小丿(GTJKV) or ⿱土⿻小丨(H))'] }],
    };
    expect(wiktionaryComposition(entry)).toBe('⿱土⿻小丿(GTJKV),⿱土⿻小丨(H)');
  });

  it('takes the composition of the gloss when no template has it', () => {
    expect(wiktionaryComposition(gloss('好 (Kangxi radical 38, 女+3, 6 strokes, composition ⿰女子)'))).toBe('⿰女子');
    expect(wiktionaryComposition(gloss('今 (6 strokes, composition ⿱亽㇇(G) or ⿱亼㇇(HTJKV))'))).toBe(
      '⿱亽㇇(G) or ⿱亼㇇(HTJKV)',
    );
  });

  it('gives null for an entry that is not a character, or that has no composition', () => {
    expect(wiktionaryComposition({ ...gloss('composition ⿰女子)'), pos: 'noun' })).toBeNull();
    expect(wiktionaryComposition(gloss('好 (Kangxi radical 38, 6 strokes)'))).toBeNull();
  });
});
