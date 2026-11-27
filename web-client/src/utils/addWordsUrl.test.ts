import { describe, it, expect } from 'vitest';
import { addWordsSearch, readAddWordsView } from './addWordsUrl';

describe('addWordsUrl', () => {
  it('gives an empty view for an empty search string', () => {
    expect(readAddWordsView('')).toEqual({ query: '', open: null });
    expect(addWordsSearch({ query: '', open: null })).toBe('');
  });

  it('reads back the view it writes', () => {
    for (const view of [
      { query: '学习', open: null },
      { query: 'ni hao ', open: 12 },
      { query: '', open: 0 },
      { query: 'a&b=c?', open: -3 },
    ]) {
      expect(readAddWordsView(addWordsSearch(view))).toEqual(view);
    }
  });

  it('reads an open row that is not a whole number as no open row', () => {
    expect(readAddWordsView('?open=abc').open).toBeNull();
    expect(readAddWordsView('?open=1.5').open).toBeNull();
    expect(readAddWordsView('?open=').open).toBeNull();
  });
});
