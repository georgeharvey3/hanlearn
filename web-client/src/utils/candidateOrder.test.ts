import { describe, it, expect } from 'vitest';
import { orderCandidates } from './candidateOrder';

const m = (char: string, distance: number, rank: number | null = null) => ({
  char,
  distance,
  rank,
});

describe('orderCandidates', () => {
  it('keeps the matcher order when no candidate has an HSK rank', () => {
    expect(orderCandidates([m('甲', 0.1), m('乙', 0.2), m('丙', 0.3)], 8, 0.02)).toEqual([
      '甲',
      '乙',
      '丙',
    ]);
  });

  it('puts a ranked character first inside the band', () => {
    expect(orderCandidates([m('甲', 0.1), m('乙', 0.11, 900)], 8, 0.02)).toEqual(['乙', '甲']);
  });

  it('puts a lower rank before a higher one inside the band', () => {
    expect(
      orderCandidates([m('甲', 0.1, 900), m('乙', 0.105, 30), m('丙', 0.11, 400)], 8, 0.02),
    ).toEqual(['乙', '丙', '甲']);
  });

  it('never moves a ranked character past a better match outside the band', () => {
    expect(orderCandidates([m('甲', 0.1), m('乙', 0.2, 1)], 8, 0.02)).toEqual(['甲', '乙']);
  });

  it('starts the next band at the first candidate left', () => {
    // 甲 and 乙 share a band; 丙 starts its own, so 丁 joins it, not the first.
    expect(
      orderCandidates([m('甲', 0.1), m('乙', 0.115, 5), m('丙', 0.13), m('丁', 0.145, 2)], 8, 0.02),
    ).toEqual(['乙', '甲', '丁', '丙']);
  });

  it('gives at most the count asked for', () => {
    const matches = Array.from('一二三四五六七八九十').map((c, i) => m(c, i * 0.1));
    expect(orderCandidates(matches, 8, 0.02)).toEqual(Array.from('一二三四五六七八'));
  });
});
