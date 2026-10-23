import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

import WordCard from './WordCard';
import { HeardSyllable, SyllableMatch, compareSpeech } from './speechMatch';
import { MicButton, Overline, StatusLine, StatusTone } from '../Study/parts';
import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { Word } from '../../../types/models';

const matchColor: Record<SyllableMatch, string> = {
  match: colors.success,
  tone: colors.warningText,
  sound: colors.primaryLight,
};

const matchTone: Record<SyllableMatch, StatusTone> = {
  match: 'success',
  tone: 'warning',
  sound: 'error',
};

const matchStatus: Record<SyllableMatch, string> = {
  match: copy.newWords.wellSaid,
  tone: copy.newWords.checkTones,
  sound: copy.newWords.notQuite,
};

type Attempt =
  | { status: 'idle' }
  | { status: 'listening' }
  | { status: 'nothing' }
  | { status: 'heard'; syllables: HeardSyllable[]; result: SyllableMatch };

interface SayStepProps {
  word: Word;
  charSet: 'simp' | 'trad';
  speechAvailable: boolean;
  speak: (text: string) => void;
  loading: boolean;
  /** The learner said the word, right or wrong. The step records no result. */
  onSaid: () => void;
}

/** Step 2: hear the word, then say it and see each syllable that was heard. */
const SayStep: React.FC<SayStepProps> = ({
  word,
  charSet,
  speechAvailable,
  speak,
  loading,
  onSaid,
}) => {
  const [attempt, setAttempt] = useState<Attempt>({ status: 'idle' });
  const recognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  const listen = useCallback(() => {
    if (attempt.status === 'listening') {
      recognition.current?.stop();
      return;
    }
    const recognizer = new window.webkitSpeechRecognition();
    recognizer.lang = 'zh-CN';
    recognition.current = recognizer;
    let heard = false;
    recognizer.addEventListener('audiostart', () => setAttempt({ status: 'listening' }));
    recognizer.addEventListener('result', (event: SpeechRecognitionEvent) => {
      heard = true;
      setAttempt({
        status: 'heard',
        ...compareSpeech(event.results[0][0].transcript, word.pinyin),
      });
      onSaid();
    });
    recognizer.addEventListener('end', () => {
      if (!heard) setAttempt({ status: 'nothing' });
    });
    recognizer.start();
  }, [attempt.status, onSaid, word.pinyin]);

  const listening = attempt.status === 'listening';
  let status: React.ReactNode = null;
  let tone: StatusTone = 'neutral';
  let icon: 'check' | 'dot' | undefined;
  if (!speechAvailable) {
    status = copy.newWords.noSpeech;
  } else if (listening) {
    status = copy.newWords.listening;
    icon = 'dot';
  } else if (attempt.status === 'nothing') {
    status = copy.newWords.heardNothing;
    tone = 'error';
  } else if (attempt.status === 'heard') {
    status = matchStatus[attempt.result];
    tone = matchTone[attempt.result];
    if (attempt.result === 'match') icon = 'check';
  }

  return (
    <>
      <Box sx={{ mt: 3, textAlign: 'center', fontSize: 15, color: colors.textSecondary }}>
        {copy.newWords.sayPrompt}
      </Box>
      <WordCard
        word={word}
        charSet={charSet}
        compact
        speak={() => speak(word[charSet])}
        loading={loading}
      />
      <Box sx={{ minHeight: 64, mt: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {attempt.status === 'heard' && (
          <>
            <Overline sx={{ textAlign: 'center' }}>{copy.newWords.heard}</Overline>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.25, fontSize: 22 }}>
              {attempt.syllables.map((syllable, i) => (
                <Box
                  key={i}
                  component="span"
                  lang="zh-Latn"
                  sx={{ color: matchColor[syllable.match], fontWeight: 600 }}
                >
                  {syllable.text ? toneMarks(syllable.text.replace(/0$/, '')) : '·'}
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
      <StatusLine tone={tone} icon={icon}>
        {status}
      </StatusLine>
      <MicButton
        listening={listening}
        disabled={!speechAvailable}
        onClick={listen}
        sx={{ mt: 2.5 }}
      />
    </>
  );
};

export default SayStep;
