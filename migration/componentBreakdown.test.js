import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  breakdownContext,
  breakdownFileName,
  breakdownOf,
  buildBreakdowns,
  firstSense,
  parseIds,
  parseMakeMeAHanzi,
} from './componentBreakdown';

const SOURCE = path.join(__dirname, 'components', 'source');

/** The committed Make Me a Hanzi data and Hanzi Writer stroke counts. */
const entries = parseMakeMeAHanzi(fs.readFileSync(path.join(SOURCE, 'dictionary.txt'), 'utf8'));
const strokeCounts = JSON.parse(
  fs.readFileSync(path.join(SOURCE, 'stroke-counts.json'), 'utf8'),
).counts;

/** The first and last point of each stroke's median line, from the same stroke data. */
const strokeEnds = JSON.parse(
  fs.readFileSync(path.join(SOURCE, 'stroke-ends.json'), 'utf8'),
).ends;

/** A few building blocks with a label, as the labels file of #531 holds them. */
const LABELS = { 口: 'mouth', 匕: 'spoon', 矢: 'arrow', 木: 'tree', 身: 'body', 寸: 'hand' };

const breakdown = (char, labels = { labels: LABELS }) =>
  breakdownOf(breakdownContext({ entries, strokeCounts, strokeEnds, labels }), char);

/** The characters of a list of parts, null for an unnamed piece. */
const charsOf = (parts) => parts.map((part) => part.c);

const range = (from, to) => [...Array(to - from + 1).keys()].map((i) => i + from);

describe('breakdownOf', () => {
  it('gives 礙 as 石, the meaning clue, and 疑, the sound clue', () => {
    const { p } = breakdown('礙');
    expect(charsOf(p)).toEqual(['石', '疑']);
    expect(p[0]).toMatchObject({ c: '石', r: 'meaning', l: 'stone', s: range(0, 4) });
    expect(p[1]).toMatchObject({ c: '疑', r: 'sound', y: 'yí', s: range(5, 18) });
  });

  it('gives 疑 as 匕 + 矢 + an unnamed piece + 疋, with no unnamed group as a step', () => {
    const { p } = breakdown('礙');
    const parts = p[1].p;
    expect(charsOf(parts)).toEqual(['匕', '矢', null, '疋']);
    expect(parts.map((part) => part.s)).toEqual([
      range(5, 6),
      range(7, 11),
      range(12, 13),
      range(14, 18),
    ]);
    expect(parts[2]).toEqual({ c: null, s: range(12, 13), l: null });
    expect(charsOf(breakdown('疑').p)).toEqual(['匕', '矢', null, '疋']);
  });

  it('stops at a building block with a label', () => {
    const stone = breakdown('礙').p[0];
    expect(charsOf(stone.p)).toEqual(['厂', '口']);
    expect(stone.p[1].p).toBeUndefined();
    expect(breakdown('口').p).toBeNull();
    expect(charsOf(breakdown('口', { labels: {} }).p)).toEqual(['冂', '一']);
  });

  it('gives 射 as 身 + 寸', () => {
    expect(breakdown('射').p).toEqual([
      { c: '身', s: range(0, 6), l: 'body', y: 'shēn' },
      { c: '寸', s: range(7, 9), l: 'hand', y: 'cùn' },
    ]);
  });

  it('keeps a group that is a real character as a step', () => {
    const groups = { '⿱亠凶': '㐫' };
    const brain = breakdown('脑', { labels: LABELS, groups });
    expect(charsOf(brain.p)).toEqual(['⺼', '㐫']);
    expect(brain.p[1].s).toEqual(range(4, 9));
    expect(charsOf(brain.p[1].p)).toEqual(['亠', '凶']);
    expect(charsOf(breakdown('脑').p)).toEqual(['⺼', '亠', '凶']);
  });

  it('names an unnamed piece from the labels file, with its loose strokes', () => {
    const win = breakdown('赢', { labels: LABELS, pieces: { 赢: { '1.2': '凡' } } });
    expect(charsOf(win.p)).toEqual(['吂', '⺼', '贝', '凡']);
    expect(win.p[3]).toMatchObject({ c: '凡', s: range(14, 16), y: 'fán' });
    expect(breakdown('赢').p[3]).toEqual({ c: null, s: range(14, 16), l: null });
  });

  it('maps the strokes of a part onto the strokes of the top character', () => {
    const doubt = breakdown('礙').p[1];
    const own = breakdown('疑').p;
    expect(doubt.p.map((part) => part.s)).toEqual(own.map((part) => part.s.map((i) => i + 5)));
  });

  it('fails when the data and the stroke data disagree on the stroke count of the character', () => {
    const context = breakdownContext({ entries, strokeCounts: { ...strokeCounts, 射: 9 } });
    expect(() => breakdownOf(context, '射')).toThrow('射: Make Me a Hanzi gives 10 strokes, Hanzi Writer 9');
  });

  it('fails when the stroke data has no character', () => {
    const { 射: _, ...counts } = strokeCounts;
    const context = breakdownContext({ entries, strokeCounts: counts });
    expect(() => breakdownOf(context, '射')).toThrow('射: no Hanzi Writer stroke data');
  });

  it('does not split a part whose strokes disagree with its stroke count', () => {
    const context = breakdownContext({ entries, strokeCounts, labels: {} });
    const axe = breakdownOf(context, '斤');
    expect(charsOf(axe.p)).toEqual(['厂', '下']);
    expect(axe.p[1].s).toHaveLength(2);
    expect(axe.p[1].p).toBeUndefined();
    expect(context.mismatches).toEqual(['斤 > 下: 2 strokes, the stroke data 3']);
  });

  it('does not split a part whose strokes in the parent have another shape', () => {
    // The left side of 難 is the variant 𦰩, with 大 at the bottom. The data
    // calls it 堇, whose bottom is 土, and both have 11 strokes.
    const context = breakdownContext({ entries, strokeCounts, strokeEnds, labels: {} });
    const hard = breakdownOf(context, '難');
    expect(charsOf(hard.p)).toEqual(['堇', '隹']);
    expect(hard.p[0].p).toBeUndefined();
    expect(context.mismatches).toContain('難 > 堇: the strokes have another shape');
  });

  it('splits a part whose strokes in the parent have its own shape', () => {
    const only = breakdown('僅', { labels: {} });
    expect(charsOf(only.p)).toEqual(['亻', '堇']);
    expect(charsOf(only.p[1].p)).toEqual(['黄', '土']);
  });

  it('makes loose strokes a piece of their own when the decomposition has no unnamed piece', () => {
    const data = new Map([
      ['甲', { character: '甲', decomposition: '⿰口口', matches: [[0], [0], [0], null, [1], [1], [1]] }],
      ['口', { character: '口', definition: 'mouth', matches: [null, null, null] }],
    ]);
    const { p } = breakdownOf(breakdownContext({ entries: data, strokeCounts: { 甲: 7 } }), '甲');
    expect(p).toEqual([
      { c: '口', s: [0, 1, 2], l: 'mouth' },
      { c: null, s: [3], l: null },
      { c: '口', s: [4, 5, 6], l: 'mouth' },
    ]);
  });
});

describe('buildBreakdowns', () => {
  it('checks the shape of each part against the stroke ends', () => {
    const { files, mismatches } = buildBreakdowns({
      chars: ['難'],
      entries,
      strokeCounts,
      strokeEnds,
      labels: {},
    });
    expect(files[breakdownFileName('難')].p[0].p).toBeUndefined();
    expect(mismatches).toContain('難 > 堇: the strokes have another shape');
  });

  it('fills every part with a fallback label when the labels file is empty', () => {
    const chars = [...'礙射脑好我们是的中国人'];
    const result = buildBreakdowns({ chars, entries, strokeCounts, labels: {} });
    expect(result.unlabelled).toEqual([]);
    expect(Object.keys(result.files)).toHaveLength(chars.length);
    const doubt = result.files[breakdownFileName('礙')].p[1];
    expect(doubt.l).toBe('to doubt');
    expect(doubt.p.map((part) => part.l)).toEqual(['spoon', 'arrow', null, 'roll']);
  });

  it('names each file by the code point of its character, and skips a character with no data', () => {
    const result = buildBreakdowns({ chars: ['礙', 'A'], entries, strokeCounts, labels: {} });
    expect(Object.keys(result.files)).toEqual(['7919']);
    expect(result.files['7919'].c).toBe('礙');
    expect(result.missing).toEqual(['A']);
  });

  it('lists the parts with no label in any source', () => {
    const result = buildBreakdowns({ chars: ['卡'], entries, strokeCounts, labels: {} });
    expect(result.unlabelled).toEqual(['⺊']);
    const filled = buildBreakdowns({
      chars: ['卡'],
      entries,
      strokeCounts,
      labels: { labels: { '⺊': 'divination' } },
    });
    expect(filled.unlabelled).toEqual([]);
  });

  it('lists the labels of parts that are in no tree', () => {
    const labels = { labels: { 口: 'mouth', 冂: 'down box', 水: 'water' } };
    const result = buildBreakdowns({ chars: ['礙'], entries, strokeCounts, labels });
    expect(result.unused).toEqual(['冂', '水']);
  });
});

describe('the committed labels file', () => {
  const labels = JSON.parse(fs.readFileSync(path.join(__dirname, 'components', 'labels.json'), 'utf8'));
  const withLabels = (char) => breakdown(char, labels);

  it('gives 凶 and 丷 a learner label, not the dictionary sense', () => {
    const fierce = withLabels('脑').p[1].p.find((part) => part.c === '凶');
    expect(fierce.l).not.toBe('culprit');
    expect(labels.labels['凶']).toBe(fierce.l);
    const horns = withLabels('前').p.find((part) => part.c === '丷');
    expect(horns.l).not.toBe('kwukyel');
    expect(labels.labels['丷']).toBe(horns.l);
  });

  it('gives 赢 no unnamed piece, and names its bottom-right piece 凡', () => {
    const unnamed = [];
    const walk = (parts) => parts?.forEach((part) => (part.c === null ? unnamed.push(part) : walk(part.p)));
    walk(withLabels('赢').p);
    expect(unnamed).toEqual([]);
    expect(withLabels('赢').p.at(-1)).toMatchObject({ c: '凡', l: 'ordinary' });
  });
});

describe('parseIds', () => {
  it('parses a nested sequence with an unnamed piece', () => {
    expect(parseIds('⿰⿱匕矢⿱？疋')).toEqual({
      op: '⿰',
      ids: '⿰⿱匕矢⿱？疋',
      children: [
        { op: '⿱', ids: '⿱匕矢', children: [{ char: '匕' }, { char: '矢' }] },
        { op: '⿱', ids: '⿱？疋', children: [{ char: null }, { char: '疋' }] },
      ],
    });
  });

  it('fails on a malformed sequence', () => {
    expect(() => parseIds('⿰口')).toThrow('malformed decomposition: ⿰口');
    expect(() => parseIds('口口')).toThrow('malformed decomposition: 口口');
  });
});

describe('labels', () => {
  it('takes the first sense of a definition', () => {
    expect(firstSense('culprit; murder; bad, sad')).toBe('culprit');
    expect(firstSense('to doubt, to question')).toBe('to doubt');
    expect(firstSense(undefined)).toBeNull();
  });
});
