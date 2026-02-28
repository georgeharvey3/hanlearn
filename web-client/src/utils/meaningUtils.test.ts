import { describe, it, expect } from 'vitest';
import { parseMeanings, joinMeanings } from './meaningUtils';

describe('parseMeanings', () => {
  it('splits on "/" returning individual meanings', () => {
    expect(parseMeanings('hello/goodbye')).toEqual(['hello', 'goodbye']);
  });

  it('splits on ";" within a segment', () => {
    expect(parseMeanings('hello; greetings')).toEqual(['hello', 'greetings']);
  });

  it('handles mixed "/" and ";" delimiters', () => {
    expect(parseMeanings('hello; greetings/goodbye; farewell')).toEqual([
      'hello',
      'greetings',
      'goodbye',
      'farewell',
    ]);
  });

  it('trims whitespace from each meaning', () => {
    expect(parseMeanings('  hello  /  goodbye  ')).toEqual(['hello', 'goodbye']);
  });

  it('filters out empty segments', () => {
    expect(parseMeanings('hello//goodbye')).toEqual(['hello', 'goodbye']);
  });

  it('filters out CL: classifier entries', () => {
    expect(parseMeanings('book/CL:本[běn]/to read')).toEqual(['book', 'to read']);
  });

  it('returns empty array for empty string', () => {
    expect(parseMeanings('')).toEqual([]);
  });

  it('returns empty array when only CL: entries are present', () => {
    expect(parseMeanings('CL:本[běn]/CL:册[cè]')).toEqual([]);
  });

  it('handles a single meaning with no delimiters', () => {
    expect(parseMeanings('hello')).toEqual(['hello']);
  });
});

describe('joinMeanings', () => {
  it('joins an array of meanings with "/" separator', () => {
    expect(joinMeanings(['hello', 'goodbye'])).toBe('hello/goodbye');
  });

  it('returns a single string unchanged when given one meaning', () => {
    expect(joinMeanings(['hello'])).toBe('hello');
  });

  it('returns empty string for empty array', () => {
    expect(joinMeanings([])).toBe('');
  });

  it('round-trips with parseMeanings for typical meaning strings', () => {
    const original = 'to study/to learn/to practice';
    const parsed = parseMeanings(original);
    const rejoined = joinMeanings(parsed);
    expect(rejoined).toBe(original);
  });
});
