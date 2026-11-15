import { describe, it, expect, vi, afterEach } from 'vitest';

import { toCharSet } from './charSet';

describe('toCharSet', () => {
  it('converts simplified text to traditional for the traditional set', async () => {
    expect(await toCharSet('我学习中文', 'trad')).toBe('我學習中文');
  });

  it('leaves the text unchanged for the simplified set', async () => {
    expect(await toCharSet('我学习中文', 'simp')).toBe('我学习中文');
  });

  describe('when the converter does not load (offline)', () => {
    afterEach(() => {
      vi.doUnmock('opencc-js');
      vi.resetModules();
    });

    it('keeps the text simplified, and loads the converter again on the next call', async () => {
      vi.resetModules();
      let online = false;
      vi.doMock('opencc-js', () => {
        if (!online) throw new Error('Failed to fetch dynamically imported module');
        return { Converter: () => (text: string) => `TRAD:${text}` };
      });
      const { toCharSet: fresh } = await import('./charSet');

      expect(await fresh('学习', 'trad')).toBe('学习');

      online = true;
      vi.resetModules();
      expect(await fresh('学习', 'trad')).toBe('TRAD:学习');
    });
  });
});
