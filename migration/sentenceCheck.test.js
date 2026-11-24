import { describe, it, expect } from 'vitest';
import { applyBatch, formatBlocked, formatChecked, uncheckedCredits } from './sentenceCheck';

const credit = (id, word, overrides = {}) => ({
  id,
  word,
  simp: `${word}的句子。`,
  english: 'English',
  gloss: 'gloss',
  longer: null,
  ...overrides,
});

describe('the unchecked credits', () => {
  it('leaves out the checked credits, and gives the credits inside a longer word first', () => {
    const credits = [
      credit('b', '书'),
      credit('a', '青', { longer: '青花' }),
      credit('c', '看'),
      credit('a', '书'),
    ];
    expect(uncheckedCredits(credits, { c: ['看'] }).map((c) => `${c.id} ${c.word}`)).toEqual(['a 青', 'a 书', 'b 书']);
  });
});

describe('a finished batch', () => {
  const batch = [
    credit('a', '青', { longer: '青花', block: 'credit', reason: '青 is in 青花' }),
    credit('b', '书', { block: 'sentence', reason: 'rude' }),
    credit('c', '看'),
  ];

  it('marks every credit of the batch checked, and adds each flag to the block list', () => {
    const result = applyBatch({ a: ['一'] }, [], batch);
    expect(result.problems).toEqual([]);
    expect(result.checked).toEqual({ a: ['一', '青'], b: ['书'], c: ['看'] });
    expect(result.blocked).toEqual([
      { id: 'a', word: '青', reason: '青 is in 青花', simp: '青的句子。' },
      { id: 'b', reason: 'rude', simp: '书的句子。' },
    ]);
  });

  it('does not add a block entry twice', () => {
    const first = applyBatch({}, [], batch);
    expect(applyBatch(first.checked, first.blocked, batch).blocked).toHaveLength(2);
  });

  it('gives a problem for a flag with no reason or an unknown scope', () => {
    const bad = [credit('a', '青', { block: 'credit' }), credit('b', '书', { block: 'word', reason: 'x' })];
    expect(applyBatch({}, [], bad).problems).toEqual([
      'a 青: a block needs a reason',
      'b 书: block must be "credit" or "sentence", not "word"',
    ]);
  });
});

describe('the file formats', () => {
  it('writes one line for each entry, in id order', () => {
    expect(formatChecked({ b: ['书'], a: ['青', '一'] })).toBe(
      '{\n  "credits": {\n    "a": ["一","青"],\n    "b": ["书"]\n  }\n}\n',
    );
    expect(formatBlocked([{ id: 'b', reason: 'x' }, { id: 'a', word: '青', reason: 'y' }])).toBe(
      '{\n  "entries": [\n    {"id":"a","word":"青","reason":"y"},\n    {"id":"b","reason":"x"}\n  ]\n}\n',
    );
    expect(formatBlocked([])).toBe('{\n  "entries": []\n}\n');
  });
});
