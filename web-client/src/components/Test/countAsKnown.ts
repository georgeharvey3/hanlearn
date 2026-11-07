import { TestState } from './types';

/**
 * Whether the learner can count the current question as known.
 *
 * The stroke check of Hanzi Writer can count a correct stroke as a miss, and
 * five misses on one stroke cap a drawn character (`CM`) at a lapse. The
 * learner can change that lapse to a pass, once, on the held reveal. A hint
 * also caps the question at a lapse, and that lapse stays, even when the
 * stroke check capped the question too. A typed or flashcard lapse and a fail
 * stay as they are. See issue #475.
 */
export const canCountAsKnown = (state: TestState): boolean =>
  state.awaitingContinue &&
  state.answerCategory === 'character' &&
  state.outcome === 'lapse' &&
  !state.hintShown;
