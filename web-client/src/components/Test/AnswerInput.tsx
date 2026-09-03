import React, { CSSProperties } from 'react';

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
      aria-label="Enter your answer"
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
        style={gradeStyle('pass', colors.success)}
        // Wrapped, because the click event would otherwise arrive as the grade.
        clicked={() => onCorrectAnswer()}
        src={likePic}
        aria-label="I knew this"
      />
      <PictureButton
        style={gradeStyle('lapse', colors.warning)}
        clicked={onNearlyKnew}
        src={nearlyPic}
        aria-label="I nearly knew this"
      />
      <PictureButton
        style={gradeStyle('fail', colors.error)}
        clicked={() => {
          if (state.useSoundEffects) fail.play();
          onIDontKnow();
        }}
        src={dislikePic}
        aria-label="I didn't know this"
      />
    </div>
  ) : (
    <Button style={{ width: '230px', margin: '0 auto' }} clicked={onShowAnswer}>
      Show Answer
    </Button>
  );

  const characterInput = (
    <div
      id="character-target-div"
      role="img"
      aria-label="Handwriting input area — draw the character here"
      style={{
        backgroundColor: colors.divider,
        width: '150px',
        margin: '0 auto',
        borderRadius: '8px',
        border: `2px dashed ${colors.primaryDark ?? colors.primary}`,
        minHeight: '150px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.text,
        fontSize: '0.875rem',
        opacity: 0.6,
      }}
    >
      Draw here
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
      Submit
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
              aria-label="Record speech"
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
    return characterInput;
  }

  return answerQuizType(state) === 'flashcard' ? showAnswerContent : inputWithMic;
};

export function getVerb(state: TestState): string {
  if (state.answerCategory === 'character') {
    return 'Draw the ';
  }
  return answerQuizType(state) === 'flashcard' ? 'What is the ' : 'Enter the ';
}

export default React.memo(AnswerInput);
