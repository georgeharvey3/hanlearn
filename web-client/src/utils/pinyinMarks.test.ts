import { describe, it, expect } from 'vitest';

import { checkTones, toneMarks } from './pinyinMarks';

describe('toneMarks', () => {
  it('writes the marks of numbered pinyin', () => {
    expect(toneMarks('tu2 shu1 guan3')).toBe('tú shū guǎn');
  });

  it('drops the 5 of a neutral tone', () => {
    expect(toneMarks('peng2 you5')).toBe('péng you');
  });

  it("reads CC-CEDICT's u: as ü", () => {
    expect(toneMarks('nu:3 er2')).toBe('nǚ ér');
  });
});

describe('checkTones', () => {
  it('marks the syllable with the wrong tone', () => {
    expect(checkTones('tu2 shu1 guan4', 'tu2 shu1 guan3')).toEqual([
      { syllable: 'tu2', wrongTone: false },
      { syllable: 'shu1', wrongTone: false },
      { syllable: 'guan4', wrongTone: true },
    ]);
  });

  it('reads a 0 as the neutral tone of its syllable', () => {
    expect(checkTones('peng3you0', 'peng2 you5')).toEqual([
      { syllable: 'peng3', wrongTone: true },
      { syllable: 'you0', wrongTone: false },
    ]);
  });

  it('marks a full tone on a neutral syllable', () => {
    expect(checkTones('dong1 xi1', 'dong1 xi5').map((s) => s.wrongTone)).toEqual([false, true]);
  });

  it('reads an attempt typed without spaces', () => {
    expect(checkTones('peng3you', 'peng2 you5').map((s) => s.wrongTone)).toEqual([true, false]);
  });
});
