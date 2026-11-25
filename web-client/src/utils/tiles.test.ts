import { describe, it, expect } from 'vitest';
import { shuffleTiles } from './tiles';

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
