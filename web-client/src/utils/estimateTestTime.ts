export interface TestTimeEstimateParams {
  numWords: number;
  useHandwriting: boolean;
  priority: string;
  onlyPriority: boolean;
  newWordsEnabled: boolean;
  sentenceReadEnabled: boolean;
  sentenceWriteEnabled: boolean;
  sentenceStagesForAllWords: boolean;
}

const PERM_SECONDS: Record<string, number> = {
  MP: 8,
  PM: 8,
  MC: 10,
  PC: 10,
  CM: 15,
};

const BASE_PERMS = ['PC', 'PM', 'MP', 'MC'];
const NEW_WORDS_SECONDS_PER_WORD = 5;
const SENTENCE_SECONDS_PER_WORD = 30;

export function estimateTestTime(params: TestTimeEstimateParams): number {
  const {
    numWords,
    useHandwriting,
    priority,
    onlyPriority,
    newWordsEnabled,
    sentenceReadEnabled,
    sentenceWriteEnabled,
    sentenceStagesForAllWords,
  } = params;

  let activePerms: string[];
  if (onlyPriority && priority !== 'none') {
    activePerms = [priority];
  } else {
    activePerms = [...BASE_PERMS];
    if (useHandwriting) {
      activePerms.push('CM');
    }
  }

  const vocabSecondsPerWord = activePerms.reduce((sum, perm) => sum + (PERM_SECONDS[perm] || 0), 0);

  let totalSeconds = numWords * vocabSecondsPerWord;

  if (newWordsEnabled) {
    totalSeconds += numWords * NEW_WORDS_SECONDS_PER_WORD;
  }

  // When sentenceStagesForAllWords is enabled, sentence stages run for every
  // correctly-answered word, so estimate time for all numWords.
  // When disabled (default), they only run for new/level-1 words, so use a
  // reduced estimate (roughly 1 in 5 words are new).
  const sentenceWordCount = sentenceStagesForAllWords
    ? numWords
    : Math.max(1, Math.round(numWords * 0.2));

  if (sentenceReadEnabled) {
    totalSeconds += sentenceWordCount * SENTENCE_SECONDS_PER_WORD;
  }
  if (sentenceWriteEnabled) {
    totalSeconds += sentenceWordCount * SENTENCE_SECONDS_PER_WORD;
  }

  return totalSeconds;
}

export function formatTestTime(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return '< 1 min';
  }
  const minutes = Math.ceil(totalSeconds / 60);
  return `~${minutes} min`;
}
