import { describe, it, expect } from 'vitest';

import { toCharSet } from './charSet';

describe('toCharSet', () => {
  it('converts simplified text to traditional for the traditional set', async () => {
    expect(await toCharSet('我学习中文', 'trad')).toBe('我學習中文');
  });

  it('leaves the text unchanged for the simplified set', async () => {
    expect(await toCharSet('我学习中文', 'simp')).toBe('我学习中文');
  });
});
