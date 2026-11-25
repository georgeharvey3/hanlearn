import { describe, it, expect } from 'vitest';

import { alignAttempt, checkAttempt, normalizeAnswer } from './answerCompare';

describe('normalizeAnswer', () => {
  it('removes full-width and half-width punctuation and spaces', () => {
    expect(normalizeAnswer('我 学习，中文。', '')).toBe('我学习中文');
    expect(normalizeAnswer('你好, 世界!?', '')).toBe('你好世界');
    expect(normalizeAnswer('“好”、《书》', '')).toBe('好书');
  });

  it('changes digits to hanzi', () => {
    expect(normalizeAnswer('3个', '')).toBe('三个');
    expect(normalizeAnswer('10', '')).toBe('十');
    expect(normalizeAnswer('15岁', '')).toBe('十五岁');
    expect(normalizeAnswer('105', '')).toBe('一百零五');
    expect(normalizeAnswer('1010', '')).toBe('一千零一十');
    expect(normalizeAnswer('20000', '')).toBe('二万');
    expect(normalizeAnswer('３个', '')).toBe('三个');
  });

  it('lets the reference choose between 二 and 两', () => {
    expect(normalizeAnswer('2点', '我两点到。')).toBe('两点');
    expect(normalizeAnswer('2点', '二点')).toBe('二点');
    expect(normalizeAnswer('200', '两百块')).toBe('两百');
    expect(normalizeAnswer('22', '两十二')).toBe('二十二');
    expect(normalizeAnswer('第2次2点', '第二次两点')).toBe('第二次两点');
  });

  it('reads a year or a number with a leading zero digit by digit, as the reference does', () => {
    expect(normalizeAnswer('2024年', '二〇二四年')).toBe('二〇二四年');
    expect(normalizeAnswer('2024年', '二零二四年')).toBe('二零二四年');
    expect(normalizeAnswer('007', '')).toBe('零零七');
  });

  it('reads a decimal number with 点', () => {
    expect(normalizeAnswer('3.5', '三点五')).toBe('三点五');
  });

  it('keeps a number it cannot convert as digits', () => {
    expect(normalizeAnswer('123456789', '')).toBe('123456789');
  });

  it('ignores the case of Latin letters', () => {
    expect(normalizeAnswer('去KTV', '去ktv')).toBe('去ktv');
  });
});

describe('alignAttempt', () => {
  const kinds = (attempt: string, reference: string) =>
    alignAttempt(attempt, reference)
      .map((mark) => (mark.kind === 'gap' ? '_' : `${mark.char}:${mark.kind[0]}`))
      .join(' ');

  it('places every character of an exact answer', () => {
    expect(kinds('我学习', '我学习')).toBe('我:p 学:p 习:p');
  });

  it('marks a moved character misplaced, and a gap where it belongs', () => {
    expect(kinds('学习我中文', '我学习中文')).toBe('_ 学:p 习:p 我:m 中:p 文:p');
  });

  it('marks only a gap for a missing first character', () => {
    expect(kinds('学习中文', '我学习中文')).toBe('_ 学:p 习:p 中:p 文:p');
  });

  it('marks a character that is not in the reference extra', () => {
    expect(kinds('我在学习', '我学习')).toBe('我:p 在:e 学:p 习:p');
  });

  it('marks a wrong character extra, with a gap after it', () => {
    expect(kinds('我在来', '我再来')).toBe('我:p 在:e _ 来:p');
  });

  it('marks one gap for missing characters at the end', () => {
    expect(kinds('我学', '我学习中文')).toBe('我:p 学:p _');
  });

  it('gives each occurrence of a repeated character its own mark', () => {
    expect(kinds('看看书', '看书')).toBe('看:p 看:e 书:p');
    expect(kinds('看书看', '看看')).toBe('看:p 书:e 看:p');
    expect(kinds('看看', '看看')).toBe('看:p 看:p');
  });
});

describe('checkAttempt', () => {
  it('matches an answer that differs only in punctuation and digits', async () => {
    const check = await checkAttempt('我2点到', '我两点到。', 'simp');
    expect(check.match).toBe(true);
    expect(check.marks.every((mark) => mark.kind === 'placed')).toBe(true);
  });

  it('converts a simplified answer to the traditional set before the compare', async () => {
    expect((await checkAttempt('我学习中文', '我學習中文。', 'trad')).match).toBe(true);
  });

  it('does not match a homophone', async () => {
    const check = await checkAttempt('我在来', '我再来。', 'simp');
    expect(check.match).toBe(false);
  });

  it('does not match an empty answer', async () => {
    expect((await checkAttempt('。', '。', 'simp')).match).toBe(false);
  });
});
