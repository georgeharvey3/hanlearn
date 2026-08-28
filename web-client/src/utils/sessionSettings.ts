/**
 * The "Questions per session" setting.
 *
 * A session used to be counted in words, and every word gave five questions.
 * The queue asks one direction of a word, so one word now gives one question,
 * and the budget counts questions. The old `numWords` value would make a
 * session five times shorter under that rule, so the setting has a new key and
 * a new range. See the plan on issue #328.
 */
export const QUESTIONS_PER_SESSION_KEY = 'questionsPerSession';

/** The key the setting had while a session was counted in words. */
export const WORDS_PER_SESSION_KEY = 'numWords';

export const QUESTIONS_PER_SESSION_MIN = 5;
export const QUESTIONS_PER_SESSION_MAX = 50;
export const QUESTIONS_PER_SESSION_STEP = 5;
export const QUESTIONS_PER_SESSION_DEFAULT = 25;

/** How many questions one word gave before the queue existed. */
const QUESTIONS_PER_WORD = 5;

const clamp = (value: number): number =>
  Math.min(QUESTIONS_PER_SESSION_MAX, Math.max(QUESTIONS_PER_SESSION_MIN, value));

/**
 * The session budget, in questions.
 *
 * A learner who has the old `numWords` value and no new one is migrated here,
 * on the first read: five questions for each word they asked for, capped at the
 * top of the new range. The old key is left alone, so the migration is
 * idempotent and a rollback still finds the value it wrote.
 */
export const readQuestionsPerSession = (): number => {
  const stored = parseInt(localStorage.getItem(QUESTIONS_PER_SESSION_KEY) ?? '', 10);
  if (Number.isFinite(stored)) return clamp(stored);

  const words = parseInt(localStorage.getItem(WORDS_PER_SESSION_KEY) ?? '', 10);
  if (!Number.isFinite(words)) return QUESTIONS_PER_SESSION_DEFAULT;

  const migrated = clamp(words * QUESTIONS_PER_WORD);
  localStorage.setItem(QUESTIONS_PER_SESSION_KEY, String(migrated));
  return migrated;
};

export const writeQuestionsPerSession = (value: number): void => {
  localStorage.setItem(QUESTIONS_PER_SESSION_KEY, String(clamp(value)));
};
