import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Box } from '@mui/material';
import { pinyin as toPinyin } from 'pinyin-pro';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import ReportSentenceButton from '../Test/Study/ReportSentenceButton';
import {
  MicButton,
  Overline,
  StatusLine,
  StudyButton,
  StudyCard,
  hanziSx,
} from '../Test/Study/parts';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import { getSegmentedSentence } from '../../services/sentenceService';
import { reportError } from '../../services/errorReporting';
import * as ttsService from '../../services/ttsService';
import { toneMarks } from '../../utils/pinyinMarks';
import { parseMeanings } from '../../utils/meaningUtils';
import {
  SentenceWord,
  matchEnglishToSentenceWords,
  resolveSentence,
} from '../../utils/sentenceUtils';
import { SentenceResult } from '../../utils/sentenceQueue';
import {
  GradeButtons,
  TaskLoadError,
  TaskLoading,
  TaskOutcome,
  readCharSet,
  readUseSound,
  speak,
} from './shared';

const mapStateToProps = (state: RootState) => ({
  synthAvailable: state.settings.synthAvailable,
  speechAvailable: state.settings.speechAvailable,
  voice: state.settings.voice,
  lang: state.settings.lang,
});

const connector = connect(mapStateToProps);

interface OwnProps {
  word: Word;
  sentenceId: string;
  onGrade: (outcome: TaskOutcome) => void;
  /** Leave the word out of the set, when its sentence does not load. */
  onSkip: () => void;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

interface Loaded {
  id: string;
  chinese: string;
  english: string;
  /** The words of the sentence with an entry, for the hints of the English words. */
  words: SentenceWord[];
}

/** Strip the punctuation at each end of an English word, to match it. */
const stripPunctuation = (text: string): string =>
  text.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

/**
 * One Compose task: the learner says or types a Chinese sentence for an
 * English prompt, reveals the reference sentence, and grades their answer
 * (#489). No model scores the answer, so the task works offline.
 *
 * An answer is necessary before the reveal, so each task is a real attempt.
 * With sound on, the mic and the keyboard both take the answer, and the
 * reference plays at the reveal.
 */
const ComposeTask: React.FC<Props> = ({
  synthAvailable,
  speechAvailable,
  voice,
  lang,
  word,
  sentenceId,
  onGrade,
  onSkip,
}) => {
  const [charSet] = useState(readCharSet);
  const [useSound] = useState(() => readUseSound(synthAvailable));
  const [load, setLoad] = useState<'loading' | 'error' | 'ready'>('loading');
  const [sentence, setSentence] = useState<Loaded | null>(null);
  const [entered, setEntered] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognition = useRef<SpeechRecognition | null>(null);

  const skip = useRef(onSkip);
  skip.current = onSkip;
  const lookups = useRef(0);
  const shownAt = useRef(0);
  const revealedAt = useRef(0);

  const fetchSentence = useCallback(async () => {
    setLoad('loading');
    try {
      const { sentence: found } = await getSegmentedSentence(word.simp, charSet, sentenceId);
      if (!found) {
        skip.current();
        return;
      }
      const resolved = resolveSentence(found, charSet);
      setSentence({
        id: found.id,
        chinese: found.chinese.sentence,
        english: found.english.sentence,
        words: resolved.chinese.words.filter((w): w is SentenceWord => typeof w !== 'string'),
      });
      setLoad('ready');
      shownAt.current = Date.now();
    } catch (error) {
      reportError(error, { feature: 'sentence-compose' });
      setLoad('error');
    }
  }, [charSet, sentenceId, word.simp]);

  useEffect(() => {
    fetchSentence();
    return () => {
      recognition.current?.abort();
      ttsService.stopAll();
    };
  }, [fetchSentence]);

  const onListen = () => {
    recognition.current?.abort();
    ttsService.stopAll();
    const next = new window.webkitSpeechRecognition();
    next.lang = 'zh-CN';
    recognition.current = next;
    setMessage('');

    let result: string | undefined;
    next.addEventListener('result', (event: SpeechRecognitionEvent) => {
      result = event.results[0][0].transcript;
      setEntered(result);
      setMessage('');
    });
    next.addEventListener('end', () => {
      setListening(false);
      if (!result) setMessage(copy.test.status.heardNothing);
    });
    next.addEventListener('audiostart', () => {
      setListening(true);
      setMessage(copy.test.status.listening);
    });
    next.start();
  };

  const onToggleWord = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        lookups.current += 1;
      }
      return next;
    });
  };

  const onReveal = () => {
    if (entered.trim() === '' || !sentence) return;
    recognition.current?.abort();
    revealedAt.current = Date.now();
    setRevealed(true);
    setMessage('');
    if (useSound) speak(sentence.chinese, { slow: false, voice, lang }, () => {});
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onReveal();
  };

  const grade = (result: SentenceResult) => {
    ttsService.stopAll();
    onGrade({
      result,
      mode: useSound ? 'audio' : 'text',
      // The task shows no Chinese before the reveal.
      revealed: false,
      lookups: lookups.current,
      answerMs: revealedAt.current - shownAt.current,
      answer: entered,
    });
  };

  const target = word[charSet];

  if (load === 'error') {
    return <TaskLoadError word={target} onSkip={onSkip} onRetry={fetchSentence} />;
  }
  if (load === 'loading' || !sentence) return <TaskLoading />;

  // A line of Chinese with each use of the word under study highlighted.
  const withTarget = (text: string): React.ReactNode =>
    text.split(target).flatMap((part, i) =>
      i === 0
        ? [part]
        : [
            <Box
              component="span"
              key={i}
              sx={{
                color: colors.primaryDark,
                bgcolor: colors.successSurface,
                borderRadius: '3px',
                px: '3px',
              }}
            >
              {target}
            </Box>,
            part,
          ],
    );

  const answerBox = {
    p: 1.75,
    border: `1px solid ${colors.divider}`,
    borderRadius: 1,
    bgcolor: colors.card,
    fontFamily: fonts.hanzi,
    fontSize: 26,
    lineHeight: 1.4,
    minHeight: 48,
  };

  if (revealed) {
    return (
      <>
        <Box
          sx={{
            mt: 2.5,
            px: 2.5,
            py: 2,
            bgcolor: colors.card,
            border: `1px solid ${colors.divider}`,
            borderRadius: 1,
            fontSize: 18,
            textAlign: 'center',
            color: colors.textSecondary,
          }}
        >
          {sentence.english}
        </Box>
        <Overline sx={{ mt: 2.75, mb: 0.75 }}>{copy.sentence.yourAnswer}</Overline>
        <Box lang="zh" sx={answerBox}>
          {withTarget(entered)}
        </Box>
        <Overline sx={{ mt: 2, mb: 0.75 }}>{copy.sentence.original}</Overline>
        <Box lang="zh" sx={answerBox}>
          {withTarget(sentence.chinese)}
          <Box
            component="p"
            lang="zh-Latn"
            sx={{
              m: 0,
              mt: 0.75,
              fontFamily: fonts.body,
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            {toPinyin(sentence.chinese, { nonZh: 'consecutive' })}
          </Box>
        </Box>
        <ReportSentenceButton
          key={`${word.id}-${sentence.id}`}
          report={{
            sentenceId: sentence.id,
            word: word.simp,
            stage: 'write',
            sentence: sentence.chinese,
            english: sentence.english,
          }}
        />
        <Box sx={{ flex: 1, minHeight: 24 }} />
        <GradeButtons onGrade={grade} />
      </>
    );
  }

  const englishWords = sentence.english.split(/\s+/);
  const selectedText = Array.from(selected)
    .sort((a, b) => a - b)
    .map((i) => stripPunctuation(englishWords[i]))
    .filter((w) => w.length > 0)
    .join(' ');
  const hints = selected.size > 0 ? matchEnglishToSentenceWords(selectedText, sentence.words) : [];

  return (
    <>
      <StudyCard height={240} sx={{ mt: 3, px: 2.75, pt: 3.5, pb: 2.75, gap: 2.25 }}>
        <Box component="p" sx={{ m: 0, fontSize: 24, lineHeight: 1.6 }}>
          {englishWords.map((english, index) => {
            const on = selected.has(index);
            return (
              <React.Fragment key={index}>
                {index > 0 && ' '}
                <Box
                  component="button"
                  type="button"
                  aria-label={copy.sentence.englishWord(english)}
                  aria-pressed={on}
                  onClick={() => onToggleWord(index)}
                  sx={{
                    border: 'none',
                    p: on ? '0 6px' : '0 2px',
                    font: 'inherit',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    bgcolor: on ? colors.primaryDark : 'transparent',
                    color: on ? colors.white : 'inherit',
                    borderBottom: on ? 'none' : `1px dotted ${colors.borderStrong}`,
                  }}
                >
                  {english}
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
        {selected.size > 0 && (
          <Box
            sx={{
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              borderTop: `1px solid ${colors.divider}`,
              textAlign: 'left',
            }}
          >
            {hints.length > 0 ? (
              hints.map((hint, i) => (
                <Box
                  key={`${hint.id}-${i}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.75,
                    py: 1.25,
                    px: 0.25,
                    borderBottom: i === hints.length - 1 ? 'none' : `1px solid ${colors.divider}`,
                  }}
                >
                  <Box lang="zh" sx={hanziSx(30, { width: 64, flex: 'none' })}>
                    {hint[charSet]}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
                      {toneMarks(hint.pinyin)}
                    </Box>
                    <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
                      {parseMeanings(hint.meaning).join(' · ')}
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Box sx={{ pt: 1.25, fontSize: 14, color: colors.textSecondary }}>
                {copy.sentence.noTranslation}
              </Box>
            )}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Overline component="span">{copy.sentence.mustUse}</Overline>
          <Box
            component="span"
            lang="zh"
            sx={{
              px: 1.25,
              py: 0.5,
              border: `2px solid ${colors.primaryLight}`,
              borderRadius: '3px',
              color: colors.primaryLight,
              ...hanziSx(26, { lineHeight: 1.1 }),
            }}
          >
            {target}
          </Box>
        </Box>
      </StudyCard>
      {useSound && speechAvailable && (
        <MicButton
          listening={listening}
          onClick={() => (listening ? recognition.current?.abort() : onListen())}
          sx={{ mt: 2.75 }}
        />
      )}
      {message && (
        <StatusLine
          tone="neutral"
          icon={message === copy.test.status.listening ? 'dot' : undefined}
        >
          {message}
        </StatusLine>
      )}
      <Overline component="label" htmlFor="answerInput" sx={{ mt: 2.5 }}>
        {copy.sentence.yourAnswer}
      </Overline>
      <Box
        component="input"
        id="answerInput"
        lang="zh"
        autoComplete="off"
        value={entered}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setEntered(e.target.value);
          setMessage('');
        }}
        onKeyDown={onKeyDown}
        placeholder={copy.sentence.writePlaceholder}
        sx={{
          mt: 1,
          height: 48,
          boxSizing: 'border-box',
          borderRadius: 1,
          border: `1px solid ${colors.borderStrong}`,
          bgcolor: colors.card,
          px: 1.75,
          fontFamily: fonts.hanzi,
          fontSize: 22,
          color: colors.text,
          outline: 'none',
          '&:focus': { border: `2px solid ${colors.primaryDark}`, px: '13px' },
          '&::placeholder': { color: colors.placeholder },
        }}
      />
      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton variant="primary" disabled={entered.trim() === ''} onClick={onReveal}>
        {copy.test.check}
      </StudyButton>
    </>
  );
};

export default connector(ComposeTask);
