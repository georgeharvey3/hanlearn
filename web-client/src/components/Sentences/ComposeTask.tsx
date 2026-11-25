import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Box, Theme, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { SystemStyleObject } from '@mui/system';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import ReportSentenceButton from '../Test/Study/ReportSentenceButton';
import {
  MicButton,
  Overline,
  PlayButton,
  StatusLine,
  StudyButton,
  StudyCard,
  hanziSx,
} from '../Test/Study/parts';
import { StudyBody } from '../Test/Study/StudyScreen';
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
import { ComposeAttempt, ComposeInput } from '../../utils/sentencePracticeDocuments';
import { AttemptMark, checkAttempt } from '../../utils/answerCompare';
import { shuffleTiles } from '../../utils/tiles';
import { toCharSet } from '../../utils/charSet';
import {
  TaskLoadError,
  TaskLoading,
  TaskOutcome,
  readCharSet,
  readComposeInput,
  readUseSound,
  speak,
  writeComposeInput,
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
  /** Save the grade at the reveal, and stay on the task. */
  onCheck: (outcome: TaskOutcome) => void;
  /** Go to the next task after the reveal. */
  onNext: () => void;
  /** Leave the word out of the set, when its sentence does not load. */
  onSkip: () => void;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

interface Loaded {
  id: string;
  chinese: string;
  /** The pinyin line, read from the simplified text (#492). */
  pinyin: string;
  english: string;
  /** The words of the sentence with an entry, for the hints of the English words. */
  words: SentenceWord[];
  /** The tiles in screen order, or null for a sentence with no tile mode. */
  tiles: string[] | null;
}

const switchSx = {
  px: 1.5,
  fontFamily: fonts.body,
  fontSize: 14,
  fontWeight: 600,
  textTransform: 'none',
  color: colors.textSecondary,
  borderColor: colors.borderStrong,
  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: colors.primaryDark, color: colors.white },
} as const;

const tileRowSx = { display: 'flex', flexWrap: 'wrap', gap: 0.75 } as const;

/** One tile: a character on a key, large enough to tap. */
const tileSx = {
  width: 44,
  height: 44,
  p: 0,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 1,
  bgcolor: colors.white,
  color: colors.text,
  fontFamily: fonts.hanzi,
  fontSize: 24,
  lineHeight: 1,
  cursor: 'pointer',
} as const;

/** The look of each mark: a colour, and a shape that does not need the colour. */
const markSx: Record<Exclude<AttemptMark['kind'], 'gap'>, SystemStyleObject<Theme>> = {
  placed: { bgcolor: colors.successSurface, color: colors.success },
  misplaced: {
    bgcolor: colors.warningSurface,
    color: colors.warningText,
    borderBottom: `2px dashed ${colors.warningText}`,
  },
  extra: { bgcolor: colors.errorSurface, color: colors.error, textDecoration: 'line-through' },
};

const markBoxSx = {
  minWidth: 32,
  height: 40,
  boxSizing: 'border-box',
  px: 0.5,
  borderRadius: '3px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...hanziSx(26, { lineHeight: 1 }),
} as const;

const gapSx = {
  ...markBoxSx,
  border: `2px dashed ${colors.borderStrong}`,
} as const;

/** Strip the punctuation at each end of an English word, to match it. */
const stripPunctuation = (text: string): string =>
  text.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

/**
 * One Compose task: the learner says or types a Chinese sentence for an
 * English prompt (#489), and the app compares each attempt with the
 * reference sentence (#597). A wrong attempt stays in the input, and its
 * marks show above it. The task ends at a match, or when the learner gives
 * up after the first attempt. Only a first-attempt match is right. No model
 * scores the answer, so the task works offline.
 *
 * With sound on, the mic and the keyboard both take the answer, and the
 * reference plays from a button after the reveal. It does not play by
 * itself, so the learner reads it first (#564).
 *
 * In tile mode the learner builds the sentence from the tiles of the build
 * (#386), and the attempts work in the same way: the placed tiles stay after
 * a wrong check. Tile mode gives no help, so the English words open nothing.
 * A check with no tile placed is an attempt too, so a stuck learner can give up.
 * The input switch hides after the first attempt, so one task has one input.
 */
const ComposeTask: React.FC<Props> = ({
  synthAvailable,
  speechAvailable,
  voice,
  lang,
  word,
  sentenceId,
  onCheck,
  onNext,
  onSkip,
}) => {
  const [charSet] = useState(readCharSet);
  const [useSound] = useState(() => readUseSound(synthAvailable));
  const [load, setLoad] = useState<'loading' | 'error' | 'ready'>('loading');
  const [sentence, setSentence] = useState<Loaded | null>(null);
  const [entered, setEntered] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [input, setInput] = useState<ComposeInput>(readComposeInput);
  /** The placed tiles, as indices into the tiles, in answer order. */
  const [placed, setPlaced] = useState<number[]>([]);
  /** The marks of the latest wrong attempt, or null before the first check. */
  const [marks, setMarks] = useState<AttemptMark[] | null>(null);
  const [checking, setChecking] = useState(false);
  /** The last attempt, which the reveal shows. */
  const [lastAttempt, setLastAttempt] = useState('');
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [synthLoading, setSynthLoading] = useState(false);
  const recognition = useRef<SpeechRecognition | null>(null);
  /** The spoken answer that waits for its conversion, if any. */
  const pendingSpeech = useRef<object | null>(null);

  const mounted = useRef(true);
  const skip = useRef(onSkip);
  skip.current = onSkip;
  const lookups = useRef(0);
  /** The lookups when the previous attempt was checked. */
  const lookupsAtCheck = useRef(0);
  const attempts = useRef<ComposeAttempt[]>([]);
  const shownAt = useRef(0);

  const fetchSentence = useCallback(async () => {
    setLoad('loading');
    try {
      const { sentence: found } = await getSegmentedSentence(word.simp, charSet, sentenceId);
      if (!mounted.current) return;
      if (!found) {
        skip.current();
        return;
      }
      const resolved = resolveSentence(found, charSet);
      const { tiles } = found;
      setSentence({
        id: found.id,
        chinese: found.chinese.sentence,
        pinyin: resolved.chinese.pinyin,
        english: found.english.sentence,
        words: resolved.chinese.words.filter((w): w is SentenceWord => typeof w !== 'string'),
        // A new order on each visit. The build writes no tiles for a sentence
        // with more than 20 characters.
        tiles: tiles ? shuffleTiles(tiles) : null,
      });
      setLoad('ready');
      shownAt.current = Date.now();
    } catch (error) {
      if (!mounted.current) return;
      reportError(error, { feature: 'sentence-compose' });
      setLoad('error');
    }
  }, [charSet, sentenceId, word.simp]);

  useEffect(() => {
    mounted.current = true;
    fetchSentence();
    return () => {
      mounted.current = false;
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
      setMessage('');
      // A zh-CN recognizer always gives simplified text (#494). The first
      // conversion loads the converter, so a later result, a typed edit or
      // the reveal makes this one stale.
      const heard = {};
      pendingSpeech.current = heard;
      toCharSet(result, charSet).then((answer) => {
        if (mounted.current && pendingSpeech.current === heard) setEntered(answer);
      });
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

  const tiles = sentence?.tiles ?? null;
  const tileMode = input === 'tiles' && tiles !== null;
  const tileAnswer = tiles ? placed.map((i) => tiles[i]).join('') : '';

  const onInput = (next: ComposeInput) => {
    setInput(next);
    writeComposeInput(next);
  };

  /** End the task: save the grade, and show the reference sentence. */
  const finish = (gaveUp: boolean) => {
    recognition.current?.abort();
    pendingSpeech.current = null;
    const list = attempts.current;
    setLastAttempt(list[list.length - 1]?.answer ?? '');
    setRevealed(true);
    setMessage('');
    onCheck({
      grade: !gaveUp && list.length === 1 ? 'right' : 'wrong',
      mode: useSound ? 'audio' : 'text',
      gaveUp,
      lookups: lookups.current,
      attempts: list,
      ...(tileMode && tiles ? { input: 'tiles' as const, tiles } : {}),
    });
  };

  const onCheckAnswer = async () => {
    if ((!tileMode && entered.trim() === '') || !sentence || checking) return;
    recognition.current?.abort();
    pendingSpeech.current = null;
    const answer = tileMode ? tileAnswer : entered;
    attempts.current = [
      ...attempts.current,
      {
        answer,
        answerMs: Date.now() - shownAt.current,
        lookups: lookups.current - lookupsAtCheck.current,
      },
    ];
    lookupsAtCheck.current = lookups.current;
    setChecking(true);
    // The first compare loads the converter of the traditional set.
    const check = await checkAttempt(answer, sentence.chinese, charSet);
    if (!mounted.current) return;
    setChecking(false);
    setMessage('');
    if (check.match) finish(false);
    else setMarks(check.marks);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onCheckAnswer();
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
        <StudyBody>
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
            {withTarget(lastAttempt)}
          </Box>
          <Overline sx={{ mt: 2, mb: 0.75 }}>{copy.sentence.original}</Overline>
          <Box sx={{ ...answerBox, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box lang="zh" sx={{ flex: 1 }}>
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
                {sentence.pinyin}
              </Box>
            </Box>
            {useSound && (
              <PlayButton
                size={44}
                loading={synthLoading}
                onClick={() =>
                  speak(sentence.chinese, { slow: false, voice, lang }, setSynthLoading)
                }
                label={copy.sentence.playSentence}
              />
            )}
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
        </StudyBody>
        <StudyButton variant="primary" onClick={onNext}>
          {copy.sentence.next}
        </StudyButton>
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

  // The marks of the latest wrong attempt, above the input or the placed tiles.
  const marksView = marks && (
    <>
      <Overline component="span" sx={{ mt: 2.5 }}>
        {copy.sentence.lastAttempt}
      </Overline>
      <Box
        role="group"
        aria-label={copy.sentence.lastAttempt}
        lang="zh"
        sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
      >
        {marks.map((mark, i) =>
          mark.kind === 'gap' ? (
            <Box key={i} component="span" role="img" aria-label={copy.sentence.gap} sx={gapSx} />
          ) : (
            <Box
              key={i}
              component="span"
              role="img"
              aria-label={copy.sentence[mark.kind](mark.char)}
              sx={{ ...markBoxSx, ...markSx[mark.kind] }}
            >
              {mark.char}
            </Box>
          ),
        )}
      </Box>
    </>
  );

  return (
    <>
      <StudyBody>
        <StudyCard height={240} sx={{ mt: 3, px: 2.75, pt: 3.5, pb: 2.75, gap: 2.25 }}>
          <Box component="p" sx={{ m: 0, fontSize: 24, lineHeight: 1.6 }}>
            {tileMode && sentence.english}
            {!tileMode &&
              englishWords.map((english, index) => {
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
          {!tileMode && selected.size > 0 && (
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
        {tiles && !marks && (
          <ToggleButtonGroup
            exclusive
            value={input}
            onChange={(_, next: ComposeInput | null) => next && onInput(next)}
            aria-label={copy.sentence.answerInput}
            sx={{ mt: 2, alignSelf: 'center', height: 36 }}
          >
            {(['free', 'tiles'] as const).map((value) => (
              <ToggleButton key={value} value={value} sx={switchSx}>
                {value === 'free' ? copy.sentence.freeAnswer : copy.sentence.tiles}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        {tileMode && (
          <>
            {marksView}
            <Overline sx={{ mt: 2.5 }}>{copy.sentence.yourAnswer}</Overline>
            <Box
              lang="zh"
              sx={{
                ...tileRowSx,
                mt: 1,
                minHeight: 60,
                boxSizing: 'border-box',
                p: 0.75,
                border: `1px solid ${colors.borderStrong}`,
                borderRadius: 1,
                bgcolor: colors.card,
              }}
            >
              {placed.map((index, at) => (
                <Box
                  key={index}
                  component="button"
                  type="button"
                  aria-label={copy.sentence.removeTile(tiles[index])}
                  onClick={() => setPlaced((prev) => prev.filter((_, i) => i !== at))}
                  sx={tileSx}
                >
                  {tiles[index]}
                </Box>
              ))}
            </Box>
            <Box
              role="group"
              aria-label={copy.sentence.tilesLeft}
              lang="zh"
              sx={{ ...tileRowSx, mt: 2, justifyContent: 'center' }}
            >
              {tiles.map((tile, index) =>
                placed.includes(index) ? null : (
                  <Box
                    key={index}
                    component="button"
                    type="button"
                    onClick={() => setPlaced((prev) => [...prev, index])}
                    sx={tileSx}
                  >
                    {tile}
                  </Box>
                ),
              )}
            </Box>
          </>
        )}
        {!tileMode && useSound && speechAvailable && (
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
        {!tileMode && marksView}
        {!tileMode && (
          <Overline component="label" htmlFor="answerInput" sx={{ mt: 2.5 }}>
            {copy.sentence.yourAnswer}
          </Overline>
        )}
        {!tileMode && (
          <Box
            component="input"
            id="answerInput"
            lang="zh"
            autoComplete="off"
            value={entered}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              pendingSpeech.current = null;
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
        )}
      </StudyBody>
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {marks && (
          <StudyButton onClick={() => finish(true)} disabled={checking}>
            {copy.sentence.giveUp}
          </StudyButton>
        )}
        <StudyButton
          variant="primary"
          disabled={(!tileMode && entered.trim() === '') || checking}
          onClick={onCheckAnswer}
        >
          {copy.test.check}
        </StudyButton>
      </Box>
    </>
  );
};

export default connector(ComposeTask);
