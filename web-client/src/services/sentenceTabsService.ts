import { Word } from '../types/models';
import { getUserWords } from './wordService';
import { loadPractice } from './sentencePracticeService';
import { sentenceIndexOf } from './sentenceService';
import {
  PracticeByWord,
  SentenceIndex,
  buildSet,
  gatedWords,
  hasNeverPractised,
} from '../utils/sentenceQueue';
import { SENTENCE_TABS, SentenceTab } from '../utils/sentenceSettings';

/**
 * What the Comprehend and Compose tabs read to build their queue (#489): every
 * word of the learner, the `sentencePractice` documents, and the sentence ids of
 * the words that pass a gate. The sentence files load only for those words.
 */
export interface QueueData {
  words: Word[];
  practice: PracticeByWord;
  index: SentenceIndex;
}

export async function loadQueueData(
  userId: string,
  tabs: readonly SentenceTab[],
  now: Date,
): Promise<QueueData> {
  const [words, practice] = await Promise.all([getUserWords(userId), loadPractice(userId)]);
  const candidates = new Set<string>();
  for (const tab of tabs) {
    for (const word of gatedWords(words, tab, now)) candidates.add(word.simp);
  }
  const index = await sentenceIndexOf(Array.from(candidates));
  return { words, practice, index };
}

/** Whether a tab has something to practise, and whether some of it is new there. */
export interface TabStatus {
  ready: boolean;
  fresh: boolean;
}

export type TabStatuses = Record<SentenceTab, TabStatus>;

export function tabStatuses(data: QueueData, now: Date): TabStatuses {
  const status = (tab: SentenceTab): TabStatus => ({
    ready: buildSet({ ...data, tab, size: 1, now }).length > 0,
    fresh: hasNeverPractised({ ...data, tab, now }),
  });
  return { comprehend: status('comprehend'), compose: status('compose') };
}

export async function loadTabStatuses(userId: string, now: Date): Promise<TabStatuses> {
  return tabStatuses(await loadQueueData(userId, SENTENCE_TABS, now), now);
}
