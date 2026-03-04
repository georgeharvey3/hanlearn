import React, { useCallback, useState } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import { Box, CircularProgress, IconButton, Paper, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import ProgressBar from './ProgressBar/ProgressBar';
import QuestionDisplay from './QuestionDisplay';
import AnswerInput, { getVerb } from './AnswerInput';
import TestActions from './TestActions';
import AudioSettingsDrawer from './AudioSettingsDrawer/AudioSettingsDrawer';
import { useTestEngine } from './useTestEngine';
import { AudioSettings } from '../../utils/audioSettings';

import { RootState } from '../../types/store';
import { AppDispatch } from '../../types/actions';
import * as actions from '../../store/actions/index';
import { Props } from './types';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  speechAvailable: state.settings.speechAvailable,
  synthAvailable: state.settings.synthAvailable,
  voice: state.settings.voice,
  lang: state.settings.lang,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onFinishTest: (scores: { word_id: number; score: number }[]) =>
    dispatch(actions.finishTest(scores)),
});

export const connector = connect(mapStateToProps, mapDispatchToProps);

const Test: React.FC<Props> = (props) => {
  const {
    state,
    setStateMerged,
    onFocusEntry,
    onInputChanged,
    onKeyPress,
    onListen,
    onSpeak,
    onCorrectAnswer,
    onIDontKnow,
    onHint,
    onShowAnswer,
    onToggleShowPinyin,
    showCharacter,
    refreshSettings,
  } = useTestEngine(props);

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  const handleSettingsClose = useCallback((updated: AudioSettings) => {
    setSettingsDrawerOpen(false);
    refreshSettings(updated);
  }, [refreshSettings]);

  const progressNum = Math.floor((state.permList.length / state.initNumPerms) * 100) || 0;
  const verb = getVerb(state);

  if (state.testSet.length !== 0 || props.isDemo) {
    return (
      <>
        {state.testFinished && state.sentenceCheckStatus === 'pending' && (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.75)',
              zIndex: 1200,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Box
          sx={{
            width: '90%',
            maxWidth: 400,
            textAlign: 'center',
            mx: 'auto',
            py: '30px',
            color: 'text.primary',
            '& h3': {
              fontWeight: 500,
              fontSize: '1.1rem',
              color: 'text.secondary',
              mb: 2,
            },
            '& h3 span': {
              bgcolor: 'primary.dark',
              color: '#fff',
              borderRadius: '4px',
              px: '6px',
              py: '2px',
              fontWeight: 600,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <ProgressBar progress={progressNum} />
            </Box>
            <IconButton
              size="small"
              onClick={() => setSettingsDrawerOpen(true)}
              aria-label="Audio settings"
              sx={{ color: 'text.secondary' }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Box>
          <h3 id="q-phrase-box">
            {verb}
            <span>{state.answerCategory}</span> for...
          </h3>
          <Paper
            elevation={0}
            sx={{
              width: '90%',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.primary',
              borderRadius: 3,
              minHeight: 100,
              height: 160,
              boxSizing: 'border-box',
              mx: 'auto',
              p: '20px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              '& h2': { overflowWrap: 'normal', fontWeight: 500, fontSize: '1.8rem', m: 0 },
            }}
          >
            <QuestionDisplay
              questionCategory={state.questionCategory}
              question={state.question}
              useSound={state.useSound}
              showPinyin={state.showPinyin}
              showQuestionPinyin={state.showQuestionPinyin}
              synthLoading={state.synthLoading}
              chosenCharacter={state.chosenCharacter}
              onSpeak={onSpeak}
              onToggleShowPinyin={onToggleShowPinyin}
            />
          </Paper>
          <Typography sx={{
            minHeight: 30,
            mt: 1.5,
            fontSize: '0.95rem',
            fontWeight: 500,
            color: state.result === 'Correct' || state.result === 'Finished!'
              ? 'success.main'
              : (state.result.startsWith('Answer was') && !state.showAnswer) || state.result.startsWith('Try') || state.result === 'Incorrect tones'
                ? 'error.main'
                : 'text.primary',
          }}>{state.result}</Typography>
          <Box
            sx={{
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <AnswerInput
              state={state}
              onKeyPress={onKeyPress}
              onInputChanged={onInputChanged}
              onFocusEntry={onFocusEntry}
              onListen={onListen}
              onShowAnswer={onShowAnswer}
              onCorrectAnswer={onCorrectAnswer}
              onIDontKnow={onIDontKnow}
              setStateMerged={setStateMerged}
            />
          </Box>
          <TestActions
            state={state}
            onIDontKnow={onIDontKnow}
            onHint={onHint}
            showCharacter={showCharacter}
          />
        </Box>
        <AudioSettingsDrawer
          open={settingsDrawerOpen}
          onClose={handleSettingsClose}
          speechAvailable={props.speechAvailable}
          synthAvailable={props.synthAvailable}
        />
      </>
    );
  }

  return null;
};

export default withRouter(connector(Test));
