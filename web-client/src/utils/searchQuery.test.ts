import { describe, it, expect } from 'vitest';
import { searchKind } from './searchQuery';

describe('searchKind', () => {
  it('reads any input with a Han character as hanzi, from one character', () => {
    expect(searchKind('你')).toBe('hanzi');
    expect(searchKind('你hao')).toBe('hanzi');
    expect(searchKind('\u{20000}')).toBe('hanzi');
  });

  it('reads Latin input as Latin from two letters', () => {
    expect(searchKind('ni')).toBe('latin');
    expect(searchKind('eat')).toBe('latin');
    expect(searchKind(' n ')).toBeNull();
    expect(searchKind('n')).toBeNull();
  });

  it('reads one syllable with a tone as Latin', () => {
    expect(searchKind('ā')).toBe('latin');
    expect(searchKind('a1')).toBe('latin');
  });

  it('does not search empty input or input with no letter', () => {
    expect(searchKind('')).toBeNull();
    expect(searchKind('12')).toBeNull();
    expect(searchKind('?!')).toBeNull();
  });
});
