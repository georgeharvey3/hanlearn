import React, { useCallback, useState } from 'react';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';

import { Box } from '@mui/material';

import StudyTop from './Study/StudyTop';
import StudyScreen from './Study/StudyScreen';
import { useLockedScroll } from './Study/useLockedScroll';
import { Prompt, StatusLine, StatusTone } from './Study/parts';
import QuestionDisplay from './QuestionDisplay';
import AnswerInput from './AnswerInput';
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

const { status } = copy.test;

/** How the status line reads a result: its colour and its icon. */
export function resultTone(result: string): { tone: StatusTone; icon?: 'check' | 'retry' | 'dot' } {
  if (result === status.correct || result === status.finished)
    return { tone: 'success', icon: 'check' };
  if (result === status.nearly || result === status.tones) return { tone: 'warning' };
  if (result === status.tryAgain) return { tone: 'error', icon: 'retry' };
  if (result === status.notKnown || result === status.audioFailed) return { tone: 'error' };
  if (result === status.listening) return { tone: 'neutral', icon: 'dot' };
  return { tone: 'neutral' };
}

const Test: React.FC<Props> = (props) => {
  const {
    state,
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
    onPlayHintSentence,
    onShowAnswer,
    onToggleShowPinyin,
    onToggleComponents,
    onContinue,
    onCountAsKnown,
    onToggleDisambiguator,
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

  useLockedScroll();

  const { history } = props;
  const onEnd = useCallback(() => history.push('/'), [history]);

  if (state.testSet.length === 0 && !props.isDemo) return null;

  const answeredCount = state.initialQueueLength - state.queue.length;
  const { tone, icon } = resultTone(state.result);
  const compact = state.componentReviewChars.length > 0;

  return (
    <StudyScreen fixed>
      <StudyTop
        stage={copy.study.stageTest}
        done={answeredCount}
        total={state.initialQueueLength}
        onEnd={onEnd}
        onSettings={() => setSettingsDrawerOpen(true)}
      />
      {/* Everything between the bar and the buttons shares the room left. The
          buttons stay on screen; this part scrolls only if a reveal cannot fit. */}
      <Box
        data-testid="test-body"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          mx: -2,
          px: 2,
          pb: 1,
        }}
      >
        <Prompt sx={compact ? { mt: 2, mb: 1.25 } : undefined}>
          {copy.test.promptBefore}
          <em>{state.answerCategory}</em>
          {state.questionCategory === 'pinyin' ? copy.test.promptOf : copy.test.promptFor}
        </Prompt>
        <QuestionDisplay
          state={state}
          onSpeak={onSpeak}
          onPlayHintSentence={onPlayHintSentence}
          onToggleShowPinyin={onToggleShowPinyin}
          onToggleDisambiguator={onToggleDisambiguator}
        />
        {/* The handwriting box sits right under the card; its status goes below it. */}
        {state.answerCategory === 'character' && !state.showComponents && (
          <AnswerInput
            state={state}
            speechAvailable={props.speechAvailable}
            onKeyPress={onKeyPress}
            onInputChanged={onInputChanged}
            onFocusEntry={onFocusEntry}
            onListen={onListen}
          />
        )}
        <StatusLine tone={tone} icon={icon}>
          {state.result}
        </StatusLine>
        <ComponentReview
          chars={state.componentReviewChars}
          charSet={state.charSet}
          open={state.showComponents}
          onToggle={onToggleComponents}
        />
        {state.answerCategory !== 'character' && !compact && (
          <AnswerInput
            state={state}
            speechAvailable={props.speechAvailable}
            onKeyPress={onKeyPress}
            onInputChanged={onInputChanged}
            onFocusEntry={onFocusEntry}
            onListen={onListen}
          />
        )}
      </Box>
      <Box sx={{ flexShrink: 0, pt: 1.5 }}>
        <TestActions
          state={state}
          onIDontKnow={onIDontKnow}
          onHint={onHint}
          onShowAnswer={onShowAnswer}
          onCorrectAnswer={onCorrectAnswer}
          onNearlyKnew={onNearlyKnew}
          onSubmitAnswer={onSubmitAnswer}
          onContinue={onContinue}
          onCountAsKnown={onCountAsKnown}
        />
      </Box>
      <AudioSettingsDrawer
        open={settingsDrawerOpen}
        onClose={handleSettingsClose}
        speechAvailable={props.speechAvailable}
        synthAvailable={props.synthAvailable}
      />
    </StudyScreen>
  );
};

export default withRouter(connector(Test));
