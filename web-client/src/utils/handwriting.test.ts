import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { match, parseTemplates, prepareTemplates, Stroke } from './handwriting';
// The build module, so the test needs no built file.
import { templatesOf } from '../../../migration/handwritingTemplates';

const SOURCE = path.join(__dirname, '..', '..', '..', 'migration', 'components', 'source');
const { medians } = JSON.parse(fs.readFileSync(path.join(SOURCE, 'stroke-medians.json'), 'utf8'));

// Every character of the medians counts as one with an entry, so the matcher
// faces all 9,500 shapes.
const words = Object.keys(medians).map((char, id) => ({ id, simp: char, trad: char }));
const parsed = parseTemplates(templatesOf({ medians, words, ranks: new Map() }));
const templates = prepareTemplates(parsed);
const byChar = new Map(parsed.map((t) => [t.char, t]));

/** A small seeded random number, so each run draws the same strokes. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * The character as a learner draws it on a 300 px pad: smaller, moved, with a
 * point every few pixels and a hand that is not steady.
 */
function draw(
  char: string,
  seed = 1,
  { scale = 0.9, dx = 20, dy = 10, wobble = 6 } = {},
): Stroke[] {
  const next = random(seed);
  return byChar.get(char)!.strokes.map((stroke) => {
    const points: Stroke = [];
    for (let i = 0; i < stroke.length - 1; i++) {
      const [ax, ay] = stroke[i];
      const [bx, by] = stroke[i + 1];
      for (let t = 0; t < 1; t += 0.1) points.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
    points.push(stroke[stroke.length - 1]);
    return points.map(([x, y]) => [
      x * scale + dx + (next() - 0.5) * wobble,
      y * scale + dy + (next() - 0.5) * wobble,
    ]);
  });
}

const top = (strokes: Stroke[], n = 8) => match(strokes, templates, n).map((m) => m.char);

// Common characters of one to 16 strokes, simplified and traditional.
const COMMON = '一二人口大中日月水火山木我你好学學国國爱愛书書说說永龍';

describe('match', () => {
  it.each(Array.from(COMMON))(
    'finds %s in the top 8 when it is drawn in its own strokes',
    (char) => {
      expect(top(draw(char))).toContain(char);
    },
  );

  it('puts the drawn character first for most common characters', () => {
    const firsts = Array.from(COMMON).filter((char) => top(draw(char, 7), 1)[0] === char);
    expect(firsts.length).toBeGreaterThanOrEqual(Math.ceil(COMMON.length * 0.8));
  });

  it('reads a stroke drawn the wrong way', () => {
    const strokes = draw('大');
    strokes[0] = [...strokes[0]].reverse();
    expect(top(strokes)).toContain('大');
  });

  it('finds a character drawn small in a corner of the pad', () => {
    expect(top(draw('好', 3, { scale: 0.4, dx: 150, dy: 140 }))).toContain('好');
  });

  it('finds a character with one stroke missing', () => {
    expect(top(draw('您').slice(0, -1))).toContain('您');
  });

  it.each([
    ['龍', 12],
    ['學', 10],
    ['書', 7],
    ['愛', 9],
  ])('finds %s before its last strokes, from its first %i', (char, strokes) => {
    expect(top(draw(char).slice(0, strokes))).toContain(char);
  });

  it('puts a whole character before one that it only starts', () => {
    // 口 is the first three strokes of many characters.
    expect(top(draw('口'), 1)).toEqual(['口']);
  });

  it('gives the best match first, with no candidate twice', () => {
    const found = match(draw('木'), templates, 8);
    const distances = found.map((m) => m.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(new Set(found.map((m) => m.char)).size).toBe(found.length);
  });

  it('gives no candidate for no strokes', () => {
    expect(match([], templates, 8)).toEqual([]);
  });
});
