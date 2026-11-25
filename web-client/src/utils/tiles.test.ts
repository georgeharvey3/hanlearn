import { describe, it, expect } from 'vitest';
import { dropSlot, moveToSlot, shuffleTiles, slotKeepsOrder, slotLine } from './tiles';

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

describe('the drop slot of a dragged tile', () => {
  // Two rows: tiles 0-2 on the first, tile 3 on the second.
  const boxes = [
    { left: 0, top: 0, width: 40, bottom: 40 },
    { left: 50, top: 0, width: 40, bottom: 40 },
    { left: 100, top: 0, width: 40, bottom: 40 },
    { left: 0, top: 50, width: 40, bottom: 90 },
  ];

  it('goes before a tile when the point is left of its centre', () => {
    expect(dropSlot(boxes, 60, 20)).toBe(1);
    expect(dropSlot(boxes, 5, 20)).toBe(0);
  });

  it('goes at the end of a row when the point is right of its last tile', () => {
    expect(dropSlot(boxes, 200, 20)).toBe(3);
  });

  it('goes at the end after the last tile', () => {
    expect(dropSlot(boxes, 35, 70)).toBe(4);
  });

  it('goes first for a point above the tiles', () => {
    expect(dropSlot(boxes, 200, -10)).toBe(0);
  });
});

describe('a tile move', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves a tile forward and back', () => {
    expect(moveToSlot(items, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveToSlot(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveToSlot(items, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('keeps the order for the slots on each side of the tile', () => {
    expect(slotKeepsOrder(1, 1)).toBe(true);
    expect(slotKeepsOrder(1, 2)).toBe(true);
    expect(moveToSlot(items, 1, 2)).toEqual(items);
    expect(slotKeepsOrder(1, 3)).toBe(false);
  });
});

describe('the drop line of a slot', () => {
  // Two rows: tiles 0-2 on the first, tile 3 on the second. The gap is 10.
  const boxes = [
    { left: 0, top: 0, width: 40, bottom: 40 },
    { left: 50, top: 0, width: 40, bottom: 40 },
    { left: 100, top: 0, width: 40, bottom: 40 },
    { left: 0, top: 50, width: 40, bottom: 90 },
  ];

  it('sits in the middle of the gap between two tiles on one row', () => {
    expect(slotLine(boxes, 1, 20, 10)).toEqual({ x: 45, top: 0, bottom: 40 });
  });

  it('sits before the first tile and after the last tile', () => {
    expect(slotLine(boxes, 0, 20, 10)).toEqual({ x: -5, top: 0, bottom: 40 });
    expect(slotLine(boxes, 4, 70, 10)).toEqual({ x: 45, top: 50, bottom: 90 });
  });

  it('takes the row of the point at a row break', () => {
    expect(slotLine(boxes, 3, 20, 10)).toEqual({ x: 145, top: 0, bottom: 40 });
    expect(slotLine(boxes, 3, 70, 10)).toEqual({ x: -5, top: 50, bottom: 90 });
  });

  it('is absent for no tiles', () => {
    expect(slotLine([], 0, 0, 10)).toBeNull();
  });
});
