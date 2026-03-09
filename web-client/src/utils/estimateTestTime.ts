export interface TestTimeEstimateParams {
  numWords: number;
  useHandwriting: boolean;
  priority: string;
  onlyPriority: boolean;
  newWordsEnabled: boolean;
  sentenceReadEnabled: boolean;
  sentenceWriteEnabled: boolean;
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
  if (sentenceReadEnabled) {
    totalSeconds += numWords * SENTENCE_SECONDS_PER_WORD;
  }
  if (sentenceWriteEnabled) {
    totalSeconds += numWords * SENTENCE_SECONDS_PER_WORD;
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
