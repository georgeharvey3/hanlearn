import React, { CSSProperties } from 'react';

import { copy } from '../../copy';
import { colors } from '../../theme';
import Input from '../UI/Input/Input';
import PictureButton from '../UI/Buttons/PictureButton/PictureButton';
import Button from '../UI/Buttons/Button/Button';
import Toggle from '../UI/Toggle/Toggle';
import { buttonStyle, activeButtonStyle, fail } from './constants';

import micPic from '../../assets/images/microphone.png';
import likePic from '../../assets/images/like.png';
import nearlyPic from '../../assets/images/nearly.png';
import dislikePic from '../../assets/images/dislike.png';

import { TestState } from './types';
import { DirectionResult } from '../../types/models';
import { QuizType } from '../../utils/audioSettings';

interface AnswerInputProps {
  state: TestState;
  speechAvailable: boolean;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputChanged: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocusEntry: (e: React.FocusEvent<HTMLInputElement>) => void;
  onListen: () => void;
  onShowAnswer: () => void;
  onCorrectAnswer: () => void;
  onNearlyKnew: () => void;
  onIDontKnow: () => void;
  onSubmitAnswer: () => void;
  setStateMerged: (update: Partial<TestState> | ((prev: TestState) => Partial<TestState>)) => void;
}

const answerQuizType = (state: TestState): QuizType =>
  (state.answerCategory === 'pinyin'
    ? state.pinyinQuizType
    : state.answerCategory === 'meaning'
      ? state.meaningQuizType
      : 'input') || 'input';

const AnswerInput: React.FC<AnswerInputProps> = ({
  state,
  speechAvailable,
  onKeyPress,
  onInputChanged,
  onFocusEntry,
  onListen,
  onShowAnswer,
  onCorrectAnswer,
  onNearlyKnew,
  onIDontKnow,
  onSubmitAnswer,
  setStateMerged,
}) => {
  const textInput = (
    <Input
      id="answer-input"
      aria-label={copy.test.answerInput}
      size="large"
      keyPressed={onKeyPress}
      value={state.answerInput}
      changed={onInputChanged}
      focussed={onFocusEntry}
      autoFocus={!speechAvailable}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );

  // A grade is final until the next question, so the pressed button keeps a ring
  // and the other two fade. This works with sound effects off.
  const graded = state.gradeClicked !== null;
  const gradeStyle = (grade: DirectionResult, ring: string): CSSProperties => {
    const pressed = state.gradeClicked === grade;
    return {
      ...(pressed ? activeButtonStyle : buttonStyle),
      ...(pressed ? { boxShadow: `0 0 0 3px ${ring}` } : null),
      opacity: graded && !pressed ? 0.3 : 1,
      transition: 'opacity 150ms ease, box-shadow 150ms ease',
    };
  };

  // Flashcard mode has no attempt to read, so the learner grades the question
  // and the reveal offers all three grades.
  const showAnswerContent = state.showAnswer ? (
    <div style={{ pointerEvents: graded ? 'none' : 'auto' }}>
      <PictureButton
        style={gradeStyle('fail', colors.error)}
        clicked={() => {
          if (state.useSoundEffects) fail.play();
          onIDontKnow();
        }}
        src={dislikePic}
        aria-label={copy.test.gradeFail}
      />
      <PictureButton
        style={gradeStyle('lapse', colors.warning)}
        clicked={onNearlyKnew}
        src={nearlyPic}
        aria-label={copy.test.gradeLapse}
      />
      <PictureButton
        style={gradeStyle('pass', colors.success)}
        // Wrapped, because the click event would otherwise arrive as the grade.
        clicked={() => onCorrectAnswer()}
        src={likePic}
        aria-label={copy.test.gradePass}
      />
    </div>
  ) : (
    <Button style={{ width: '230px', margin: '0 auto' }} clicked={onShowAnswer}>
      {copy.test.showAnswer}
    </Button>
  );

  const characterInput = (
    <div
      id="character-target-div"
      role="img"
      aria-label={copy.test.drawArea}
      style={{
        backgroundColor: colors.card,
        width: '150px',
        margin: '0 auto',
        borderRadius: '4px',
        border: `2px dashed ${colors.borderStrong}`,
        minHeight: '150px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.text,
        fontSize: '0.875rem',
        opacity: 0.6,
      }}
    >
      {copy.test.drawHere}
    </div>
  );

  // The input had no submit control other than the Enter key, and a learner who
  // speaks has no keyboard open. Speech puts its transcript in the input and
  // sends nothing, so this button is how a spoken answer becomes an attempt.
  const submitButton = (
    <Button
      id="submit-answer"
      disabled={state.submitDisabled || state.answerInput === ''}
      clicked={onSubmitAnswer}
    >
      {copy.test.submit}
    </Button>
  );

  const inputWithMic = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      {textInput}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {speechAvailable ? (
          <>
            <PictureButton
              type="secondary"
              src={micPic}
              aria-label={copy.test.recordSpeech}
              clicked={() => onListen()}
            />
            <Toggle
              checked={state.useAutoRecord}
              changed={(event) => {
                state.recognition?.abort();
                setStateMerged({ useAutoRecord: event.target.checked });
                if (event.target.checked) onListen();
              }}
            />
          </>
        ) : null}
        {submitButton}
      </div>
    </div>
  );

  if (state.answerCategory === 'character') {
    // The review that follows a missed character holds the session here, and
    // the box has already been cleared by then: it is 150px of nothing in the
    // way of the reveal, so it goes until the next question needs it.
    return reviewHidesAnswerInput(state) ? null : characterInput;
  }

  if (answerQuizType(state) === 'flashcard') {
    return showAnswerContent;
  }

  // Typing and the microphone are how an attempt is made, so they go once the
  // question is graded: the answer is on screen and nothing sent now can
  // change it. Leaving the mic live was worse than untidy — a transcript
  // clears the result line, so recording over the reveal erased it.
  return attemptIsOver(state) ? null : inputWithMic;
};

/**
 * Whether the question has been graded, so the attempt is over.
 *
 * Both grading paths disable Submit — a correct answer and a reveal — and the
 * next question turns it back on. A wrong attempt does not: the input stays
 * live there so the learner can edit and send it again.
 */
function attemptIsOver(state: TestState): boolean {
  return state.submitDisabled;
}

/**
 * Whether the answer area renders nothing while the component review is up.
 *
 * Only flashcard mode has anything left to show, since its grade buttons are
 * the record of what the learner pressed. Handwriting has cleared its box by
 * then, and a graded input is gone with the rest of the attempt. The layout
 * reads this too, so that it reserves no room for an area that is not there.
 */
export function reviewHidesAnswerInput(state: TestState): boolean {
  return state.componentReviewChars.length > 0 && answerQuizType(state) !== 'flashcard';
}

export function getVerb(state: TestState): string {
  if (state.answerCategory === 'character') {
    return copy.test.verbDraw;
  }
  return answerQuizType(state) === 'flashcard' ? copy.test.verbFlashcard : copy.test.verbEnter;
}

export default React.memo(AnswerInput);
