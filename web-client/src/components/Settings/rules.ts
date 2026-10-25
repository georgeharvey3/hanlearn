import { QuizType } from '../../utils/audioSettings';
import { copy } from '../../copy';

// Why a control is off, or null when the learner can use it. The Settings
// page and the session's sheet show the same reason under the same switch.

export const ttsBlock = (synthAvailable: boolean): string | null =>
  synthAvailable ? null : copy.settings.unsupported;

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
