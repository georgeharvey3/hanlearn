import React from 'react';
import { Box, CircularProgress } from '@mui/material';

import { copy } from '../../copy';
import { colors } from '../../theme';
import { SentenceResult } from '../../utils/sentenceQueue';
import { SentenceGrade } from '../../utils/sentencePracticeDocuments';
import { StudyButton, hanziSx } from '../Test/Study/parts';
import * as ttsService from '../../services/ttsService';

/** What a task reports when the learner grades it: the grade, less what the tab knows. */
export type TaskOutcome = Omit<SentenceGrade, 'wordId' | 'sentenceId' | 'tab' | 'at'>;

export const SLOW_SPEED = 0.7;

/** The character set and the sound setting of the learner. */
export const readCharSet = (): 'simp' | 'trad' =>
  localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad';

export const readUseSound = (synthAvailable: boolean): boolean =>
  synthAvailable && localStorage.getItem('useSound') !== 'false';

/** Speak a Chinese text, and report when the audio loads. */
export function speak(
  text: string,
  options: { slow: boolean; voice?: SpeechSynthesisVoice | null; lang?: string | null },
  onLoading: (loading: boolean) => void,
): void {
  ttsService.stopAll();
  onLoading(true);
  ttsService.speak(text, {
    speed: options.slow ? SLOW_SPEED : 1.0,
    fallbackVoice: options.voice ?? undefined,
    fallbackLang: options.lang || 'zh-CN',
    onStart: () => onLoading(false),
    onEnd: () => onLoading(false),
    onError: () => onLoading(false),
  });
}

export const TaskLoading: React.FC = () => (
  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <CircularProgress aria-label={copy.study.loading} sx={{ color: colors.primaryDark }} />
  </Box>
);

/** The sentence of a task did not load: try again, or skip the word. */
export const TaskLoadError: React.FC<{
  word: string;
  onSkip: () => void;
  onRetry: () => void;
}> = ({ word, onSkip, onRetry }) => (
  <>
    <Box
      sx={{
        mt: 2.5,
        height: 300,
        boxSizing: 'border-box',
        p: 3,
        bgcolor: colors.card,
        border: `1px dashed ${colors.borderStrong}`,
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.75,
        textAlign: 'center',
      }}
    >
      <Box lang="zh" sx={hanziSx(48, { color: colors.disabledText })}>
        {word}
      </Box>
      <Box role="alert" sx={{ fontSize: 17, fontWeight: 600 }}>
        {copy.sentence.loadFailed}
      </Box>
    </Box>
    <Box sx={{ flex: 1 }} />
    <StudyButton onClick={onSkip}>{copy.sentence.skipWord}</StudyButton>
    <StudyButton variant="primary" onClick={onRetry} sx={{ mt: 1.25 }}>
      {copy.sentence.tryAgain}
    </StudyButton>
  </>
);

/** The two grade buttons at the foot of a revealed task. */
export const GradeButtons: React.FC<{ onGrade: (result: SentenceResult) => void }> = ({
  onGrade,
}) => (
  <Box sx={{ display: 'flex', gap: 1.25 }}>
    <StudyButton onClick={() => onGrade('wrong')}>{copy.sentenceTabs.wrong}</StudyButton>
    <StudyButton variant="primary" onClick={() => onGrade('right')}>
      {copy.sentenceTabs.right}
    </StudyButton>
  </Box>
);

/** A word of a sentence, highlighted as the word under study. */
export const Highlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="mark"
    sx={{
      font: 'inherit',
      color: colors.primaryDark,
      bgcolor: colors.successSurface,
      borderRadius: '3px',
      px: 0.5,
    }}
  >
    {children}
  </Box>
);
