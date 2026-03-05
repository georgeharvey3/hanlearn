import React from 'react';

import Button from '../UI/Buttons/Button/Button';
import { TestState } from './types';

interface TestActionsProps {
  state: TestState;
  onIDontKnow: () => void;
  onHint: () => void;
  showCharacter: () => void;
}

const TestActions: React.FC<TestActionsProps> = ({ state, onIDontKnow, onHint, showCharacter }) => {
  const pinyinQuestionWithSound = state.questionCategory === 'pinyin' && state.useSound;
  const pinyinAnswerMeaningQuestion =
    state.answerCategory === 'pinyin' && state.questionCategory === 'meaning';
  const meaningAnswer = state.answerCategory === 'meaning';

  return (
    <div
      style={{
        paddingTop: '20px',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '4px',
      }}
    >
      <Button
        type="secondary"
        disabled={state.idkDisabled || state.showAnswer}
        clicked={onIDontKnow}
        id="idk"
      >
        I Don&apos;t Know
      </Button>
      <Button
        type="ghost"
        disabled={
          (!pinyinQuestionWithSound &&
            !pinyinAnswerMeaningQuestion &&
            !meaningAnswer &&
            state.answerCategory !== 'character') ||
          state.showAnswer
        }
        clicked={onHint}
      >
        {state.questionCategory === 'pinyin' && state.useSound
          ? 'Hint'
          : state.showHint
            ? 'Hide Hint'
            : 'Show Hint'}
      </Button>
      {state.questionCategory === 'pinyin' &&
      state.useSound &&
      state.chosenCharacter?.length === 1 ? (
        <Button type="ghost" clicked={showCharacter}>
          {state.result === state.chosenCharacter ? 'Hide Character' : 'Show Character'}
        </Button>
      ) : null}
    </div>
  );
};

export default TestActions;
