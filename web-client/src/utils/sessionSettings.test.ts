import { describe, it, expect, beforeEach } from 'vitest';

import {
  QUESTIONS_PER_SESSION_DEFAULT,
  QUESTIONS_PER_SESSION_KEY,
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  WORDS_PER_SESSION_KEY,
  readQuestionsPerSession,
  writeQuestionsPerSession,
} from './sessionSettings';

describe('readQuestionsPerSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default for a learner with no setting', () => {
    expect(readQuestionsPerSession()).toBe(QUESTIONS_PER_SESSION_DEFAULT);
    expect(localStorage.getItem(QUESTIONS_PER_SESSION_KEY)).toBeNull();
  });

  it('returns the stored value', () => {
    localStorage.setItem(QUESTIONS_PER_SESSION_KEY, '30');
    expect(readQuestionsPerSession()).toBe(30);
  });

  it('clamps a stored value to the range', () => {
    localStorage.setItem(QUESTIONS_PER_SESSION_KEY, '500');
    expect(readQuestionsPerSession()).toBe(QUESTIONS_PER_SESSION_MAX);

    localStorage.setItem(QUESTIONS_PER_SESSION_KEY, '0');
    expect(readQuestionsPerSession()).toBe(QUESTIONS_PER_SESSION_MIN);
  });

  it('migrates the old words-per-session value at five questions for each word', () => {
    localStorage.setItem(WORDS_PER_SESSION_KEY, '4');

    expect(readQuestionsPerSession()).toBe(20);
    expect(localStorage.getItem(QUESTIONS_PER_SESSION_KEY)).toBe('20');
  });

  it('caps the migrated value at the top of the new range', () => {
    localStorage.setItem(WORDS_PER_SESSION_KEY, '20');

    expect(readQuestionsPerSession()).toBe(QUESTIONS_PER_SESSION_MAX);
  });

  it('leaves the old value in place, so a rollback still reads it', () => {
    localStorage.setItem(WORDS_PER_SESSION_KEY, '4');

    readQuestionsPerSession();

    expect(localStorage.getItem(WORDS_PER_SESSION_KEY)).toBe('4');
  });

  it('migrates one time only, and later changes win', () => {
    localStorage.setItem(WORDS_PER_SESSION_KEY, '4');
    readQuestionsPerSession();

    writeQuestionsPerSession(10);

    expect(readQuestionsPerSession()).toBe(10);
  });

  it('ignores a value that is not a number', () => {
    localStorage.setItem(QUESTIONS_PER_SESSION_KEY, 'many');
    expect(readQuestionsPerSession()).toBe(QUESTIONS_PER_SESSION_DEFAULT);
  });
});

describe('writeQuestionsPerSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the value', () => {
    writeQuestionsPerSession(15);
    expect(localStorage.getItem(QUESTIONS_PER_SESSION_KEY)).toBe('15');
  });

  it('clamps the value to the range', () => {
    writeQuestionsPerSession(1000);
    expect(localStorage.getItem(QUESTIONS_PER_SESSION_KEY)).toBe(String(QUESTIONS_PER_SESSION_MAX));
  });
});
