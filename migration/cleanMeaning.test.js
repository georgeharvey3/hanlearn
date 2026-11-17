import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cleanDictionary, cleanEntry, isUnclean, lookupOf } from './cleanMeaning';
import { chengyuRowsOf, emptiedReport } from './build-dictionary';

/** The real CC-CEDICT entries of the given traditional and simplified forms. */
const LINE = /^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/;
const FORMS = new Set([
  '誰', '谁', '路', '一點兒', '一点儿', '一點', '一点', '電視台', '电视台', '電視臺', '體檢', '体检',
  '體格檢查', '体格检查', '瑪', '玛', '瑪瑙', '玛瑙', '打', '四季', '錢', '钱', '和', '次',
]);
const entries = fs
  .readFileSync(path.join(__dirname, 'cedict_ts.u8'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.match(LINE))
  .filter((match) => match && (FORMS.has(match[1]) || FORMS.has(match[2])))
  .map(([, trad, simp, pinyin, meaning], i) => ({ id: i + 1, trad, simp, pinyin, meaning }));
const lookup = lookupOf(entries);

/** The clean meaning of the real entry with these forms and pinyin. */
const clean = (simp, pinyin, trad = simp) => {
  const entry = entries.find((e) => e.simp === simp && e.pinyin === pinyin && e.trad === trad);
  if (!entry) throw new Error(`no fixture entry ${trad} ${simp} [${pinyin}]`);
  return cleanEntry(entry, lookup).meaning;
};

/** The clean meaning of a made-up entry among other made-up entries. */
const cleanOf = (meaning, others = []) => {
  const entry = { trad: '甲', simp: '甲', pinyin: 'jia3', meaning };
  return cleanEntry(entry, lookupOf([entry, ...others]));
};
const made = (trad, simp, pinyin, meaning) => ({ trad, simp, pinyin, meaning });

describe('the clean meaning', () => {
  it('removes a pronunciation note outside parentheses: 谁', () => {
    expect(clean('谁', 'shei2', '誰')).toBe('who');
  });

  it('removes a measure word in parentheses: 路', () => {
    expect(clean('路', 'lu4')).toBe('road/journey/route/line (bus etc)/sort; kind');
  });

  it('removes a measure word sense and a reference in the text: 钱', () => {
    expect(clean('钱', 'qian2', '錢')).toBe('coin/money/unit of weight, one tenth of a tael');
  });

  it('removes a pronunciation note in parentheses and keeps the rest: 和', () => {
    expect(clean('和', 'he2').split('/')[0]).toBe('(joining two nouns) and; together with; with');
  });

  it('replaces an erhua pointer by the senses of its target: 一点儿', () => {
    const meaning = clean('一点儿', 'yi1 dian3 r5', '一點兒');
    expect(meaning.split('/').slice(0, 2)).toEqual(['a bit; a little bit', '(used in negative expressions) (not) the least bit']);
    expect(meaning).toContain("one o'clock");
    expect(meaning).not.toContain('abbr.');
  });

  it('replaces a variant pointer: 电视台', () => {
    expect(clean('电视台', 'dian4 shi4 tai2', '電視臺')).toBe('television station');
  });

  it('replaces an abbreviation pointer: 体检', () => {
    expect(clean('体检', 'ti3 jian3', '體檢')).toBe(clean('体格检查', 'ti3 ge2 jian3 cha2', '體格檢查'));
    expect(clean('体检', 'ti3 jian3', '體檢')).toMatch(/^physical examination/);
  });

  it('replaces a "used in" pointer: 玛 is what 玛瑙 means', () => {
    expect(clean('玛', 'ma3', '瑪')).toBe(clean('玛瑙', 'ma3 nao3', '瑪瑙'));
  });

  it('removes the examples of 打 and keeps its senses', () => {
    const senses = clean('打', 'da3').split('/');
    expect(senses).toContain('to hit; to strike');
    expect(senses).toContain('to fight');
    expect(senses).toContain('(coll.) from; since');
    expect(senses.join('/')).not.toMatch(/e\.g\.|as in|"/);
  });

  it('removes the references of 四季 and tidies the commas', () => {
    expect(clean('四季', 'si4 ji4')).toBe('four seasons, namely: spring, summer, autumn and winter');
  });

  it('keeps a classifier sense and the labels of a sense', () => {
    expect(clean('次', 'ci4')).toContain('classifier for enumerated events: time');
    expect(clean('次', 'ci4')).toContain('hypo- (chemistry)');
  });

  it('leaves a sense with no Chinese as it is', () => {
    expect(cleanOf('(fig.) to see; (coll.) also/also known as').meaning).toBe('(fig.) to see; (coll.) also/also known as');
  });

  it('keeps the English of a sense that is only a note in parentheses', () => {
    expect(cleanOf('(final particle, same as 吧[ba5])').meaning).toBe('(final particle)');
  });

  it('gives no Chinese for any fixture entry', () => {
    for (const entry of entries) expect(isUnclean(cleanEntry(entry, lookup).meaning)).toBe(false);
  });
});

describe('pointers', () => {
  it('follows a pointer to a pointer once', () => {
    const others = [made('乙', '乙', 'yi3', 'variant of 丙[bing3]'), made('丙', '丙', 'bing3', 'third')];
    expect(cleanOf('variant of 乙[yi3]', others)).toEqual({ meaning: 'third', reason: null });
  });

  it('gives no sense for a chain longer than 2 steps, and does not crash', () => {
    const others = [
      made('乙', '乙', 'yi3', 'variant of 丙[bing3]'),
      made('丙', '丙', 'bing3', 'variant of 丁[ding1]'),
      made('丁', '丁', 'ding1', 'fourth'),
    ];
    expect(cleanOf('variant of 乙[yi3]', others)).toEqual({ meaning: '', reason: 'pointer chain longer than 2 steps' });
  });

  it('does not loop on a pointer cycle', () => {
    const others = [made('乙', '乙', 'yi3', 'variant of 甲[jia3]')];
    expect(cleanOf('variant of 乙[yi3]', others).meaning).toBe('');
  });

  it('gives no sense for a pointer with no target, and keeps the other senses', () => {
    expect(cleanOf('variant of 戊[wu4]')).toEqual({ meaning: '', reason: 'pointer with no target' });
    expect(cleanOf('armour/variant of 戊[wu4]')).toEqual({ meaning: 'armour', reason: null });
  });

  it('matches the target pinyin with "lu : 3" spelled as "lu:3"', () => {
    const others = [made('旅', '旅', 'lu:3', 'trip')];
    expect(cleanOf('variant of 旅[lu : 3]', others).meaning).toBe('trip');
  });
});

describe('the emptied entries', () => {
  it('lists an entry with no sense left, with its raw meaning and its reason', () => {
    const empty = { id: 7, trad: '丙', simp: '丙', pinyin: 'bing3', meaning: 'see 戊[wu4]' };
    const { words, emptied } = cleanDictionary([{ id: 1, trad: '丁', simp: '丁', pinyin: 'ding1', meaning: 'fourth' }, empty]);
    expect(words.map((w) => w.meaning)).toEqual(['fourth', '']);
    expect(emptied).toEqual([{ entry: empty, reason: 'pointer with no target' }]);
    const report = emptiedReport(emptied, new Map([['丙 bing3', { level: 3, q: 10 }]]));
    expect(report).toContain('Count: 1');
    expect(report).toContain('| 3 | 丙 | 丙 | bing3 | see 戊[wu4] | pointer with no target |');
  });

  it('sorts the report by HSK level, then by rank, with entries outside HSK last', () => {
    const row = (simp, id) => ({ entry: { id, trad: simp, simp, pinyin: 'a1', meaning: 'see 戊' }, reason: 'pointer with no target' });
    const ranks = new Map([
      ['乙 a1', { level: 2, q: 50 }],
      ['丙 a1', { level: 1, q: 900 }],
      ['丁 a1', { level: 2, q: 10 }],
    ]);
    const report = emptiedReport([row('甲', 1), row('乙', 2), row('丙', 3), row('丁', 4)], ranks);
    const order = report.split('\n').filter((line) => /^\| [\d ]/.test(line)).map((line) => line.split(' | ')[2]);
    expect(order).toEqual(['丙', '丁', '乙', '甲']);
  });
});

describe('the chengyu table check', () => {
  it('reads every row of the table as Prettier writes it', () => {
    const table = fs.readFileSync(path.join(__dirname, '..', 'web-client', 'src', 'data', 'chengyuCharMeanings.ts'), 'utf8');
    const rows = chengyuRowsOf(table);
    expect(rows.length).toBe(table.split('\n').filter((line) => /^ {2}\S.*,$/.test(line)).length);
    expect(rows.length).toBeGreaterThan(400);
    expect(rows.find((row) => row.char === '亲').meaning).toBe("parent; one's own (flesh and blood); relative");
    expect(rows.every((row) => !isUnclean(row.meaning))).toBe(true);
  });
});

describe('a pronunciation note before a pointer', () => {
  it('is not meaning: "Taiwan pr. used in X" gives the senses of X', () => {
    const others = [made('乙', '乙', 'yi3', 'half-cooked')];
    expect(cleanOf('Taiwan pr. used in 乙[yi3]', others).meaning).toBe('half-cooked');
  });
});
