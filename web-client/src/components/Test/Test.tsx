import React, { useCallback, useState } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import { Box, CircularProgress, IconButton, Paper, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import ProgressBar from './ProgressBar/ProgressBar';
import QuestionDisplay from './QuestionDisplay';
import AnswerInput, { getVerb, reviewHidesAnswerInput } from './AnswerInput';
import TestActions from './TestActions';
import ComponentReview from './ComponentReview/ComponentReview';
import AudioSettingsDrawer from './AudioSettingsDrawer/AudioSettingsDrawer';
import { useTestEngine } from './useTestEngine';
import { AudioSettings } from '../../utils/audioSettings';

import { RootState } from '../../types/store';
import { WordDirectionResults } from '../../types/models';
import { AppDispatch } from '../../types/actions';
import * as actions from '../../store/actions/index';
import { Props } from './types';
import { copy } from '../../copy';
import { colors, fonts, shadows } from '../../theme';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  speechAvailable: state.settings.speechAvailable,
  synthAvailable: state.settings.synthAvailable,
  voice: state.settings.voice,
  lang: state.settings.lang,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onFinishTest: (results: WordDirectionResults[]) => dispatch(actions.finishTest(results)),
});

export const connector = connect(mapStateToProps, mapDispatchToProps);

export function getResultColor(result: string, showAnswer: boolean): string {
  if (result === 'Correct' || result === 'Finished!') return 'success.main';
  if (result === 'Incorrect tones' || result === 'Nearly') return 'warning.main';
  if (
    (result.startsWith('Answer was') && !showAnswer) ||
    result.startsWith('Try') ||
    result.startsWith('Not known')
  )
    return 'error.main';
  return 'text.primary';
}

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
    onNearlyKnew,
    onSubmitAnswer,
    onIDontKnow,
    onHint,
    onShowAnswer,
    onToggleShowPinyin,
    onToggleComponents,
    onContinue,
    showCharacter,
    refreshSettings,
  } = useTestEngine(props);

  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  const handleSettingsClose = useCallback(
    (updated: AudioSettings) => {
      setSettingsDrawerOpen(false);
      refreshSettings(updated);
    },
    [refreshSettings],
  );

  const progressNum = Math.floor((state.queue.length / state.initialQueueLength) * 100) || 0;
  const verb = getVerb(state);
  const answeredCount = state.initialQueueLength - state.queue.length;

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
              bgcolor: 'rgba(250, 248, 245, 0.75)',
              zIndex: 1200,
            }}
          >
            <CircularProgress aria-label={copy.test.loadingTest} />
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
              fontWeight: 400,
              fontSize: '0.95rem',
              letterSpacing: '0.02em',
              color: 'text.secondary',
              mt: 4,
              mb: 2,
            },
            '& h3 span': {
              color: 'primary.light',
              fontWeight: 600,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <ProgressBar progress={progressNum} />
            </Box>
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {copy.test.progressCount(answeredCount, state.initialQueueLength)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setSettingsDrawerOpen(true)}
              aria-label={copy.test.audioSettings}
              sx={{ color: 'text.secondary' }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Box>
          <h3 id="q-phrase-box">
            {verb}
            <span>{state.answerCategory}</span>
            {copy.test.promptAfter}
          </h3>
          <Paper
            elevation={0}
            sx={{
              position: 'relative',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: shadows.card,
              color: 'text.primary',
              borderRadius: 1,
              minHeight: { xs: 220, sm: 260 },
              boxSizing: 'border-box',
              mx: 'auto',
              p: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              '& h2': { overflowWrap: 'normal', fontWeight: 500, fontSize: '1.8rem', m: 0 },
            }}
          >
            {state.gradeCap === 'lapse' && (
              <Box
                role="img"
                data-testid="lapse-marker"
                aria-label={copy.test.lapseMarker}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'warning.main',
                }}
              />
            )}
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                right: 14,
                bottom: 14,
                width: 26,
                height: 26,
                border: `2px solid ${colors.primaryLight}`,
                borderRadius: '3px',
                color: 'primary.light',
                fontFamily: fonts.hanzi,
                fontSize: 14,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              {copy.test.seal}
            </Box>
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
          <Typography
            aria-live="polite"
            sx={{
              minHeight: 30,
              mt: 1.5,
              fontSize: '0.95rem',
              fontWeight: 500,
              color: getResultColor(state.result, state.showAnswer),
            }}
          >
            {state.result}
          </Typography>
          <ComponentReview
            chars={state.componentReviewChars}
            charSet={state.charSet}
            open={state.showComponents}
            onToggle={onToggleComponents}
            onContinue={onContinue}
          />
          <Box
            sx={{
              minHeight: reviewHidesAnswerInput(state) ? 0 : { xs: 0, sm: 160 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <AnswerInput
              state={state}
              speechAvailable={props.speechAvailable}
              onKeyPress={onKeyPress}
              onInputChanged={onInputChanged}
              onFocusEntry={onFocusEntry}
              onListen={onListen}
              onShowAnswer={onShowAnswer}
              onCorrectAnswer={onCorrectAnswer}
              onNearlyKnew={onNearlyKnew}
              onIDontKnow={onIDontKnow}
              onSubmitAnswer={onSubmitAnswer}
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
