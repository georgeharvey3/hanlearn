/**
 * The "Comprehend per set" and "Compose per set" settings (#395).
 *
 * A set is the tasks of one visit to a sentence tab (#489). Each tab has its
 * own size, because a Compose task takes longer than a Comprehend task. No
 * study gives a number of sentences, so the default of 5 is a start to tune
 * with the `sentenceLog` data. A tab is opt-in, so the range starts at 1.
 */
export type SentenceTab = 'comprehend' | 'compose';

export const SET_SIZE_MIN = 1;
export const SET_SIZE_MAX = 10;
export const SET_SIZE_STEP = 1;
export const SET_SIZE_DEFAULT = 5;

const KEYS: Record<SentenceTab, string> = {
  comprehend: 'comprehendPerSet',
  compose: 'composePerSet',
};

const clamp = (value: number): number => Math.min(SET_SIZE_MAX, Math.max(SET_SIZE_MIN, value));

/** The number of tasks in one set of the tab. */
export const readSetSize = (tab: SentenceTab): number => {
  const stored = parseInt(localStorage.getItem(KEYS[tab]) ?? '', 10);
  return Number.isFinite(stored) ? clamp(stored) : SET_SIZE_DEFAULT;
};

export const writeSetSize = (tab: SentenceTab, value: number): void => {
  localStorage.setItem(KEYS[tab], String(clamp(value)));
};
