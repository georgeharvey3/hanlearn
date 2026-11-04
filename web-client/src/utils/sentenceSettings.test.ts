import { describe, it, expect, beforeEach } from 'vitest';

import { readSetSize, writeSetSize } from './sentenceSettings';

describe('the set size of a sentence tab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is 5 for a learner with no setting', () => {
    expect(readSetSize('comprehend')).toBe(5);
    expect(readSetSize('compose')).toBe(5);
  });

  it('keeps a separate value for each tab', () => {
    writeSetSize('comprehend', 8);
    writeSetSize('compose', 3);

    expect(readSetSize('comprehend')).toBe(8);
    expect(readSetSize('compose')).toBe(3);
  });

  it('holds a written value to the range 1 to 10', () => {
    writeSetSize('comprehend', 0);
    expect(readSetSize('comprehend')).toBe(1);

    writeSetSize('comprehend', 40);
    expect(readSetSize('comprehend')).toBe(10);
  });

  it('holds a stored value to the range, and ignores a value that is not a number', () => {
    localStorage.setItem('composePerSet', '99');
    expect(readSetSize('compose')).toBe(10);

    localStorage.setItem('composePerSet', 'many');
    expect(readSetSize('compose')).toBe(5);
  });
});
