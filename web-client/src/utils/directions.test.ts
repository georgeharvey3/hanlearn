/**
 * Tests for the per-direction scheduling helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  makeDirections,
  fillDirections,
  isNewWord,
  leechDirections,
  readyForWriteStage,
  RECALL_DIRECTIONS,
  WRITE_STAGE_BANK,
} from './directions';
import { DIRECTIONS } from '../types/models';
import { LEECH_THRESHOLD } from './scheduling';

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

describe('isNewWord', () => {
  const word = (level: number, directions?: Record<string, { level: number; dueDate: string }>) =>
    ({ level, directions }) as Parameters<typeof isNewWord>[0];

  it('is true when every direction is still at level 1', () => {
    expect(isNewWord(word(1, makeDirections(1, '2026/03/05')))).toBe(true);
  });

  it('is false once one direction has advanced', () => {
    const directions = {
      ...makeDirections(1, '2026/03/05'),
      MC: { level: 2, dueDate: '2026/03/08' },
    };
    expect(isNewWord(word(1, directions))).toBe(false);
  });

  it('is false when every direction has advanced', () => {
    expect(isNewWord(word(3, makeDirections(3, '2026/03/05')))).toBe(false);
  });

  it('falls back to the top-level level for a word with no directions', () => {
    expect(isNewWord(word(1))).toBe(true);
    expect(isNewWord(word(2))).toBe(false);
  });
});

describe('readyForWriteStage', () => {
  const word = (level: number, directions?: Record<string, { level: number; dueDate: string }>) =>
    ({ level, directions }) as Parameters<typeof readyForWriteStage>[0];

  const at = (level: number) => makeDirections(level, '2026/03/05');

  it('is false for a new word', () => {
    expect(readyForWriteStage(word(1, at(1)))).toBe(false);
  });

  it('is false one bank below the threshold', () => {
    expect(readyForWriteStage(word(1, at(WRITE_STAGE_BANK - 1)))).toBe(false);
  });

  it('is true once every recall direction reaches the threshold', () => {
    expect(readyForWriteStage(word(1, at(WRITE_STAGE_BANK)))).toBe(true);
  });

  it('is true above the threshold', () => {
    expect(readyForWriteStage(word(1, at(5)))).toBe(true);
  });

  it('is false when one recall direction lags behind', () => {
    for (const direction of RECALL_DIRECTIONS) {
      const directions = { ...at(WRITE_STAGE_BANK), [direction]: { level: 2, dueDate: 'x' } };
      expect(readyForWriteStage(word(1, directions))).toBe(false);
    }
  });

  it('ignores the handwriting direction, which is itself production', () => {
    const directions = { ...at(WRITE_STAGE_BANK), CM: { level: 1, dueDate: 'x' } };
    expect(readyForWriteStage(word(1, directions))).toBe(true);
  });

  it('falls back to the top-level level for a word with no directions', () => {
    expect(readyForWriteStage(word(WRITE_STAGE_BANK - 1))).toBe(false);
    expect(readyForWriteStage(word(WRITE_STAGE_BANK))).toBe(true);
  });
});

describe('leechDirections', () => {
  const word = (directions?: Record<string, { level: number; dueDate: string; lapses?: number }>) =>
    ({ directions }) as Parameters<typeof leechDirections>[0];

  it('is empty for a word whose directions have lost no retrievals', () => {
    expect(leechDirections(word(makeDirections(3, '2026/03/05')))).toEqual([]);
  });

  it('is empty for a word with no scheduling state at all', () => {
    expect(leechDirections(word())).toEqual([]);
  });

  it('leaves out a direction that is still below the threshold', () => {
    const directions = {
      ...makeDirections(2, '2026/03/05'),
      MC: { level: 2, dueDate: '2026/03/05', lapses: LEECH_THRESHOLD - 1 },
    };
    expect(leechDirections(word(directions))).toEqual([]);
  });

  it('names each direction that has reached the threshold, in DIRECTIONS order', () => {
    const directions = {
      ...makeDirections(2, '2026/03/05'),
      CM: { level: 2, dueDate: '2026/03/05', lapses: LEECH_THRESHOLD },
      MC: { level: 2, dueDate: '2026/03/05', lapses: LEECH_THRESHOLD + 4 },
    };
    expect(leechDirections(word(directions))).toEqual(['MC', 'CM']);
  });
});
