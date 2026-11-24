import { describe, it, expect } from 'vitest';
import { gradeTiles, shuffleTiles } from './tiles';

describe('the tile grade', () => {
  it('is right for an exact match with the reference', () => {
    expect(gradeTiles('我明天去', '我明天去。')).toBe('right');
  });

  it('ignores punctuation', () => {
    expect(gradeTiles('你好吗', '你好，吗？')).toBe('right');
  });

  it('is wrong for the same characters in another order', () => {
    expect(gradeTiles('明天我去', '我明天去。')).toBe('wrong');
  });

  it('is wrong for a missing or an extra character', () => {
    expect(gradeTiles('我明天', '我明天去。')).toBe('wrong');
    expect(gradeTiles('我明天去了', '我明天去。')).toBe('wrong');
  });

  it('is wrong for an empty answer', () => {
    expect(gradeTiles('', '我明天去。')).toBe('wrong');
  });
});

describe('the tile order', () => {
  it('keeps every tile, a repeated one too', () => {
    const tiles = ['我', '看', '书', '我', '输'];
    expect([...shuffleTiles(tiles, () => 0.3)].sort()).toEqual([...tiles].sort());
  });

  it('gives a new order for another random source', () => {
    const tiles = ['一', '二', '三', '四', '五'];
    expect(shuffleTiles(tiles, () => 0)).not.toEqual(shuffleTiles(tiles, () => 0.99));
  });
});
