import { TestState } from './types';
import { QuizType } from '../../utils/audioSettings';

/** How the current question is answered: typed or spoken, or as a flashcard. */
export const answerQuizType = (state: TestState): QuizType =>
  (state.answerCategory === 'pinyin'
    ? state.pinyinQuizType
    : state.answerCategory === 'meaning'
      ? state.meaningQuizType
      : 'input') || 'input';
