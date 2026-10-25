import { QuizType } from '../../utils/audioSettings';
import { copy } from '../../copy';

// Why a control is off, or null when the learner can use it. The Settings
// page and the session's sheet show the same reason under the same switch.

const needs = (available: boolean): string | null => (available ? null : copy.settings.unsupported);

/** Text-to-speech reads the word aloud with speech synthesis. */
export const ttsBlock = needs;

/** New words plays each word, so it needs speech synthesis. */
export const newWordsBlock = needs;

/** Translate sentences takes a spoken answer, so it needs speech recognition. */
export const sentenceReadBlock = needs;

/** The microphone starts only for an answer that is typed or spoken. */
export const autoRecordBlock = (
  speechAvailable: boolean,
  meaningQuizType: QuizType,
  pinyinQuizType: QuizType,
): string | null => {
  if (!speechAvailable) return copy.settings.unsupported;
  if (meaningQuizType !== 'input' && pinyinQuizType !== 'input') return copy.settings.needsInput;
  return null;
};

/** The answer types, for the Meaning and Pinyin rows. */
export const quizOptions: { value: QuizType; label: string }[] = [
  { value: 'input', label: copy.settings.input },
  { value: 'flashcard', label: copy.settings.flashcard },
];
