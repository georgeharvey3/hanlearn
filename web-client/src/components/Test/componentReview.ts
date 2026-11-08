import { DirectionResult } from '../../types/models';
import { TestState } from './types';

export type ReviewShape = Pick<
  TestState,
  'answerCategory' | 'questionCategory' | 'chosenCharacter' | 'missedCharIndexes'
>;

/** Whether the question asks the learner to draw the characters: the `CM` direction. */
export const isDrawQuestion = (state: Pick<TestState, 'answerCategory'>): boolean =>
  state.answerCategory === 'character';

/**
 * The characters to offer a component breakdown for once a question is graded.
 *
 * Only a question that puts the character on screen has components worth
 * showing, so `MP` and `PM` — pinyin and meaning alone — get none. A `pass`
 * gets none either: the breakdown is the aid for a direction the learner has
 * just lost, which is what issue #335 asks for.
 *
 * A draw question knows which characters the learner missed: the ones with a
 * hint, or with a stroke that reached the outline cap. Only those are offered.
 * "I don't know" is the only `fail` a draw question gets, and it offers every
 * character. `MC` and `PC` show the character, so the app cannot tell which one
 * the miss was on, and they offer them all. See issue #493.
 */
export const componentsToReview = (state: ReviewShape, result: DirectionResult): string[] => {
  if (result === 'pass') return [];
  if (state.answerCategory !== 'character' && state.questionCategory !== 'character') return [];
  const chars = Array.from(state.chosenCharacter ?? '');
  if (!isDrawQuestion(state) || result === 'fail') return chars;
  const missed = chars.filter((_, index) => state.missedCharIndexes.includes(index));
  // Every capped draw question records a character, so this fallback is only
  // a guard against an empty review that would hold the session for nothing.
  return missed.length > 0 ? missed : chars;
};
