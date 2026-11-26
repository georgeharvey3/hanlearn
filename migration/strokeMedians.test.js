import { describe, it, expect } from 'vitest';
import { endsOf, simplifyMedian } from './strokeMedians';

describe('simplifyMedian', () => {
  it('keeps the first and the last point exactly', () => {
    expect(simplifyMedian([[10, 20], [12, 21], [400, 25]], 16)).toEqual([10, 20, 400, 25]);
  });

  it('drops a point near the line between its neighbours', () => {
    expect(simplifyMedian([[0, 0], [100, 5], [200, 0]], 16)).toEqual([0, 0, 200, 0]);
  });

  it('keeps the corner of a bent stroke', () => {
    // 𠃍: across, then down.
    expect(simplifyMedian([[0, 0], [100, 0], [200, 0], [200, 100], [200, 200]], 16)).toEqual([
      0, 0, 200, 0, 200, 200,
    ]);
  });

  it('keeps a stroke of one point', () => {
    expect(simplifyMedian([[5, 6]], 16)).toEqual([5, 6]);
  });
});

describe('endsOf', () => {
  it('gives the first and the last point of each stroke', () => {
    expect(endsOf([[0, 0, 200, 0, 200, 200], [5, 6]])).toEqual([
      [0, 0, 200, 200],
      [5, 6, 5, 6],
    ]);
  });
});
