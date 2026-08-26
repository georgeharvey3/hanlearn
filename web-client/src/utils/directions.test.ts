/**
 * Tests for the per-direction scheduling helpers.
 */
import { describe, it, expect } from 'vitest';
import { makeDirections, fillDirections } from './directions';
import { DIRECTIONS } from '../types/models';

describe('makeDirections', () => {
  it('returns all five directions at the given level and due date', () => {
    const directions = makeDirections(3, '2026/03/05');

    expect(Object.keys(directions).sort()).toEqual([...DIRECTIONS].sort());
    for (const direction of DIRECTIONS) {
      expect(directions[direction]).toEqual({ level: 3, dueDate: '2026/03/05' });
    }
  });
});

describe('fillDirections', () => {
  it('derives every direction from the word level when nothing is stored', () => {
    const directions = fillDirections(undefined, 2, '2026/03/05');

    for (const direction of DIRECTIONS) {
      expect(directions[direction]).toEqual({ level: 2, dueDate: '2026/03/05' });
    }
  });

  it('keeps stored entries and derives only the missing ones', () => {
    const directions = fillDirections({ CM: { level: 1, dueDate: '2026/01/02' } }, 4, '2026/03/05');

    expect(directions.CM).toEqual({ level: 1, dueDate: '2026/01/02' });
    expect(directions.MC).toEqual({ level: 4, dueDate: '2026/03/05' });
    expect(directions.PC).toEqual({ level: 4, dueDate: '2026/03/05' });
  });

  it('fills a stored entry that is missing one of its two fields', () => {
    const directions = fillDirections({ MC: { level: 5 } }, 1, '2026/03/05');

    expect(directions.MC).toEqual({ level: 5, dueDate: '2026/03/05' });
  });

  it('does not treat level 0 as missing', () => {
    const directions = fillDirections({ MC: { level: 0, dueDate: '2026/01/02' } }, 3, '2026/03/05');

    expect(directions.MC.level).toBe(0);
  });

  it('returns a fresh object for every direction, not one shared record', () => {
    const directions = fillDirections(undefined, 1, '2026/03/05');
    directions.MC.level = 5;

    expect(directions.CM.level).toBe(1);
  });
});
