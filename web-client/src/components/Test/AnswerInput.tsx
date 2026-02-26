import React from 'react';

import { colors } from '../../theme';
import Input from '../UI/Input/Input';
import PictureButton from '../UI/Buttons/PictureButton/PictureButton';
import Button from '../UI/Buttons/Button/Button';
import Toggle from '../UI/Toggle/Toggle';
import { buttonStyle, activeButtonStyle, fail } from './constants';

import micPic from '../../assets/images/microphone.png';
import likePic from '../../assets/images/like.png';
import dislikePic from '../../assets/images/dislike.png';

import { TestState } from './types';

interface AnswerInputProps {
  state: TestState;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputChanged: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocusEntry: (e: React.FocusEvent<HTMLInputElement>) => void;
  onListen: () => void;
  onShowAnswer: () => void;
  onCorrectAnswer: () => void;
  onIDontKnow: () => void;
  setStateMerged: (update: Partial<TestState> | ((prev: TestState) => Partial<TestState>)) => void;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  state,
  onKeyPress,
  onInputChanged,
  onFocusEntry,
  onListen,
  onShowAnswer,
  onCorrectAnswer,
  onIDontKnow,
  setStateMerged,
}) => {
  const textInput = (
    <Input
      id="answer-input"
      keyPressed={onKeyPress}
      value={state.answerInput}
      changed={onInputChanged}
      focussed={onFocusEntry}
      autoFocus={true}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );

  const showAnswerContent = state.showAnswer ? (
    <div>
      <PictureButton
        style={state.yesClicked ? activeButtonStyle : buttonStyle}
        clicked={onCorrectAnswer}
        src={likePic}
      />
      <PictureButton
        style={state.noClicked ? activeButtonStyle : buttonStyle}
        clicked={() => {
          if (state.useSound) fail.play();
          onIDontKnow();
        }}
        src={dislikePic}
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
      style={{
        backgroundColor: colors.divider,
        width: '150px',
        margin: '0 auto',
        borderRadius: '8px',
      }}
    ></div>
  );

  const micInput = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <PictureButton type="secondary" src={micPic} clicked={() => onListen()} />
        <Toggle
          checked={state.useAutoRecord}
          changed={(event) => {
            state.recognition?.abort();
            setStateMerged({ useAutoRecord: event.target.checked });
            if (event.target.checked) onListen();
          }}
        />
      </div>
      {state.showInput ? (
        <Input
          id="secondary-input"
          keyPressed={onKeyPress}
          value={state.answerInput}
          changed={onInputChanged}
          placeholder="Type answer..."
          autoFocus={true}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      ) : null}
    </div>
  );

  switch (state.answerCategory) {
    case 'pinyin':
      if (state.useChineseSpeechRecognition) {
        return micInput;
      }
      return textInput;
    case 'character':
      return characterInput;
    case 'meaning':
      if (state.useFlashcards) {
        return showAnswerContent;
      }
      if (state.useEnglishSpeechRecognition) {
        return micInput;
      }
      return textInput;
    default:
      return textInput;
  }
};

export function getVerb(state: TestState): string {
  switch (state.answerCategory) {
    case 'pinyin':
      return state.useChineseSpeechRecognition ? 'Speak the ' : 'Enter the ';
    case 'character':
      return 'Draw the ';
    case 'meaning':
      if (state.useFlashcards) return 'What is the ';
      if (state.useEnglishSpeechRecognition) return 'Speak the ';
      return 'Enter the ';
    default:
      return 'Enter the ';
  }
}

export default AnswerInput;
