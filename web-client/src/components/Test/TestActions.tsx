import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';

import Button from '../UI/Buttons/Button/Button';
import { TestState } from './types';
import { copy } from '../../copy';

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
        maxWidth: 360,
        margin: '0 auto',
      }}
    >
      <Button
        type="ghost"
        disabled={state.idkDisabled || state.showAnswer}
        clicked={onIDontKnow}
        id="idk"
      >
        {copy.test.iDontKnow}
      </Button>
      <Button
        type="ghost"
        disabled={
          (!pinyinQuestionWithSound &&
            !pinyinAnswerMeaningQuestion &&
            !meaningAnswer &&
            state.answerCategory !== 'character') ||
          state.showAnswer ||
          state.hintLoading
        }
        clicked={onHint}
      >
        {state.hintLoading ? (
          <>
            <CircularProgress
              size={14}
              color="inherit"
              aria-label={copy.test.loadingHintLabel}
              sx={{ mr: 1 }}
            />
            {copy.test.loadingHint}
          </>
        ) : state.questionCategory === 'pinyin' && state.useSound ? (
          copy.test.hint
        ) : state.showHint ? (
          copy.test.hideHint
        ) : (
          copy.test.showHint
        )}
      </Button>
      {state.questionCategory === 'pinyin' &&
      state.useSound &&
      state.chosenCharacter?.length === 1 ? (
        <Button type="ghost" clicked={showCharacter}>
          {state.result === state.chosenCharacter
            ? copy.test.hideCharacter
            : copy.test.showCharacter}
        </Button>
      ) : null}
    </div>
  );
};

export default React.memo(TestActions);
