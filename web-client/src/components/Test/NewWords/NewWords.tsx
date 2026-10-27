import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, ButtonBase } from '@mui/material';

import StepRail from './StepRail';
import { STEPS, StepKey } from './steps';
import UnderstandStep from './UnderstandStep';
import SpeakStep from './SpeakStep';
import WriteStep from './WriteStep';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';
import { StudyButton } from '../Study/parts';
import AudioSettingsDrawer from '../AudioSettingsDrawer/AudioSettingsDrawer';
import * as ttsService from '../../../services/ttsService';
import { getAudioSettings } from '../../../utils/audioSettings';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';

interface NewWordsProps {
  words: Word[];
  startTest?: () => void;
}

const NO_STEPS_DONE: Record<StepKey, boolean> = { understand: false, speak: false, write: false };

/** Play a text through the app's TTS, with a flag while the audio loads. */
function useSpeak(): { speak: (text: string) => void; loading: boolean } {
  const voice = useSelector((state: RootState) => state.settings.voice);
  const lang = useSelector((state: RootState) => state.settings.lang);
  const [loading, setLoading] = useState(false);
  const speak = useCallback(
    (text: string) => {
      setLoading(true);
      try {
        ttsService.speak(text, {
          fallbackVoice: voice,
          fallbackLang: lang || 'zh-CN',
          onStart: () => setLoading(false),
          onEnd: () => setLoading(false),
          onError: () => setLoading(false),
        });
      } catch {
        // Speech can fail on a phone; the word stays on screen.
        setLoading(false);
      }
    },
    [lang, voice],
  );
  return { speak, loading };
}

/**
 * The introduction of new words, before the test. Each word goes through three
 * steps that echo the directions of the test: Understand (meaning), Speak
 * (sound) and Write (characters). Continue moves on from any step, finished or
 * not, and Skip to test ends the introduction. Nothing here records a result.
 */
const NewWords: React.FC<NewWordsProps> = ({ words, startTest }) => {
  const history = useHistory();
  const speechAvailable = useSelector((state: RootState) => state.settings.speechAvailable);
  const synthAvailable = useSelector((state: RootState) => state.settings.synthAvailable);
  const [charSet] = useState<'simp' | 'trad'>(
    () => (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad',
  );
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  // The steps of this word the learner finished, not skipped.
  const [done, setDone] = useState(NO_STEPS_DONE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { speak, loading } = useSpeak();

  const word = words[index];
  const lastWord = index === words.length - 1;
  const current = STEPS[step].key;

  useEffect(() => {
    setStep(0);
    setDone(NO_STEPS_DONE);
    if (word && getAudioSettings().useSound) speak(word[charSet]);
    // Only a new word plays itself; a change of voice does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const markDone = useCallback((key: StepKey) => setDone((prev) => ({ ...prev, [key]: true })), []);
  const onSpoken = useCallback(() => markDone('speak'), [markDone]);
  const onTraced = useCallback(() => markDone('write'), [markDone]);

  const advance = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else if (!lastWord) setIndex(index + 1);
    else startTest?.();
  }, [index, lastWord, startTest, step]);

  // Continue is always on: no step blocks the learner. A disabled Continue on
  // Speak read as a dead button (#443).
  const onContinue = useCallback(() => {
    if (current === 'understand') markDone('understand');
    advance();
  }, [advance, current, markDone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onContinue();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onContinue]);

  if (!word) return null;

  const primaryLabel =
    current !== 'write'
      ? copy.newWords.continue
      : lastWord
        ? copy.newWords.startTest
        : copy.newWords.nextWord;
  // The bar fills by step; a traced word fills its last third.
  const stepsPassed = step + (current === 'write' && done.write ? 1 : 0);

  return (
    <StudyScreen>
      <StudyTop
        stage={copy.newWords.stage}
        done={index + stepsPassed / STEPS.length}
        position={index + 1}
        total={words.length}
        onEnd={() => history.push('/')}
        onSettings={() => setSettingsOpen(true)}
      />
      <StepRail at={step} done={done} onPick={setStep} />

      {current === 'understand' && (
        <UnderstandStep key={index} word={word} charSet={charSet} speak={speak} loading={loading} />
      )}
      {current === 'speak' && (
        <SpeakStep
          key={index}
          word={word}
          charSet={charSet}
          speechAvailable={speechAvailable}
          speak={speak}
          loading={loading}
          onSpoken={onSpoken}
        />
      )}
      {current === 'write' && (
        <WriteStep
          key={index}
          word={word}
          charSet={charSet}
          traced={done.write}
          onTraced={onTraced}
        />
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <ButtonBase
        onClick={() => startTest?.()}
        sx={{
          alignSelf: 'center',
          mb: 1,
          height: 40,
          px: 1.5,
          fontFamily: fonts.body,
          fontSize: 14,
          color: colors.textSecondary,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        {copy.newWords.skipToTest}
      </ButtonBase>
      <StudyButton variant="primary" onClick={onContinue}>
        {primaryLabel}
      </StudyButton>
      <AudioSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        speechAvailable={speechAvailable}
        synthAvailable={synthAvailable}
      />
    </StudyScreen>
  );
};

export default NewWords;
