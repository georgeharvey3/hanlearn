import { describe, it, expect } from 'vitest';
import { templatesOf } from './handwritingTemplates';
import { parseTemplates } from '../web-client/src/utils/handwriting';

// Medians in the 1024 box of Make Me a Hanzi, y up from a baseline at 900.
const medians = {
  学: [[100, 900, 500, 900], [100, 500, 500, 500, 500, 100]],
  學: [[0, 900, 1024, -124]],
  生: [[400, 400, 600, 400]],
  囧: [[200, 200, 300, 300]],
};

const words = [
  { id: 1, simp: '学', trad: '學' },
  { id: 2, simp: '学生', trad: '學生' },
  { id: 3, simp: '学', trad: '学' },
];

describe('templatesOf', () => {
  it('holds each character that has an entry of its own, simplified and traditional', () => {
    const file = templatesOf({ medians, words, ranks: new Map() });
    expect([...file.chars].sort()).toEqual(['学', '學']);
  });

  it('gives a character the best HSK rank of its entries', () => {
    const file = templatesOf({ medians, words, ranks: new Map([[1, 120], [3, 40], [2, 5]]) });
    expect(file.ranks).toEqual({ 学: 40, 學: 120 });
  });

  it('gives the client the strokes in a box of 256 with y down', () => {
    const templates = parseTemplates(templatesOf({ medians, words, ranks: new Map() }));
    const byChar = Object.fromEntries(templates.map((t) => [t.char, t]));
    expect(byChar['学'].strokes).toEqual([
      [[25, 0], [125, 0]],
      [[25, 100], [125, 100], [125, 200]],
    ]);
    // The ends of the box clamp to 255.
    expect(byChar['學'].strokes).toEqual([[[0, 0], [255, 255]]]);
    expect(byChar['學'].rank).toBeNull();
  });
});
