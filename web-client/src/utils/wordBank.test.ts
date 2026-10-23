import { describe, it, expect } from 'vitest';
import { isCovered, isInBank, matchesBank } from './wordBank';
import { makeDirections } from './directions';
import { Word } from '../types/models';

const today = new Date(2026, 9, 23, 15, 0);

const word = (level: number, due: string): Word => ({
  id: 1,
  simp: '附近',
  trad: '附近',
  pinyin: 'fù jìn',
  meaning: 'nearby',
  level,
  due_date: due,
  directions: makeDirections(level, due),
});

describe('isCovered', () => {
  it('covers a word due today, tomorrow or overdue', () => {
    expect(isCovered(word(3, '2026/10/23'), today)).toBe(true);
    expect(isCovered(word(3, '2026/10/24'), today)).toBe(true);
    expect(isCovered(word(3, '2026/10/01'), today)).toBe(true);
  });

  it('shows a word due in 2 days or later', () => {
    expect(isCovered(word(3, '2026/10/25'), today)).toBe(false);
    expect(isCovered(word(5, '2027/01/10'), today)).toBe(false);
  });

  it('never covers a new word', () => {
    expect(isCovered(word(1, '2026/10/23'), today)).toBe(false);
  });

  it('shows a word with no due date', () => {
    expect(isCovered({ ...word(3, '2026/10/23'), due_date: undefined }, today)).toBe(false);
  });
});

describe('matchesBank', () => {
  const w = {
    ...word(3, '2026/11/01'),
    simp: '图书馆',
    trad: '圖書館',
    pinyin: 'tú shū guǎn',
    meaning: 'library',
  };

  it('finds a word by its characters in either set', () => {
    expect(matchesBank(w, '书', today)).toBe(true);
    expect(matchesBank(w, '書館', today)).toBe(true);
    expect(matchesBank(w, '好', today)).toBe(false);
  });

  it('finds a word by its pinyin, without tone marks or spaces', () => {
    expect(matchesBank(w, 'tushu', today)).toBe(true);
    expect(matchesBank(w, 'shū guǎn', today)).toBe(true);
  });

  it('finds a word by its meaning, in any case', () => {
    expect(matchesBank(w, 'Libr', today)).toBe(true);
  });

  it('finds a word due soon by its characters only', () => {
    const due = { ...w, due_date: '2026/10/24' };
    expect(matchesBank(due, '书', today)).toBe(true);
    expect(matchesBank(due, 'tushu', today)).toBe(false);
    expect(matchesBank(due, 'library', today)).toBe(false);
  });

  it('matches nothing on a blank query', () => {
    expect(matchesBank(w, '  ', today)).toBe(false);
  });
});

describe('isInBank', () => {
  const bank = [word(3, '2026/11/01')];

  it('knows a dictionary entry the bank already holds', () => {
    expect(isInBank({ ...bank[0], id: 77 }, bank)).toBe(true);
  });

  it('tells apart two entries with the same characters', () => {
    expect(isInBank({ ...bank[0], id: 77, pinyin: 'fù jin' }, bank)).toBe(false);
  });
});
