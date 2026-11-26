import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Box } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import WordGlossPanel from '../Test/Study/WordGlossPanel';
import ReportSentenceButton from '../Test/Study/ReportSentenceButton';
import { PillToggle, PlayButton, StudyButton, StudyCard } from '../Test/Study/parts';
import { StudyBody } from '../Test/Study/StudyScreen';
import * as wordActions from '../../store/actions/index';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import { AppDispatch } from '../../types/actions';
import { getSegmentedSentence } from '../../services/sentenceService';
import { reportError } from '../../services/errorReporting';
import * as ttsService from '../../services/ttsService';
import {
  ResolvedSentence,
  SentenceOption,
  SentenceWord,
  dictionaryEntryOf,
  resolveSentence,
} from '../../utils/sentenceUtils';
import {
  Highlight,
  SentenceWordButton,
  TaskLoadError,
  TaskLoading,
  TaskOutcome,
  readCharSet,
  readUseSound,
  speak,
} from './shared';

const mapStateToProps = (state: RootState) => ({
  synthAvailable: state.settings.synthAvailable,
  voice: state.settings.voice,
  lang: state.settings.lang,
  addedWords: state.addWords.words,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onPostWord: (word: Word) => dispatch(wordActions.postWord(word)),
  onAddFailed: () => dispatch(wordActions.showNotification(copy.sentence.addFailed, 'error')),
});

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {
  word: Word;
  sentenceId: string;
  /** Save the grade of the first pick. The task stays on screen. */
  onCheck: (outcome: TaskOutcome) => void;
  /** Go to the next task. */
  onNext: () => void;
  /** Leave the word out of the set, when its sentence does not load or has no options. */
  onSkip: () => void;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

type Load = 'loading' | 'error' | 'ready';

/** The border and the background of an option, after the pick: the answer and a wrong pick. */
const OPTION_COLORS = {
  plain: { border: colors.divider, background: colors.card },
  answer: { border: colors.success, background: colors.successSurface },
  picked: { border: colors.error, background: colors.errorSurface },
};

/** The options in a random order, so that the place of the right one tells nothing. */
function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * One Comprehend task: the learner hears or reads an example sentence and
 * picks its English from the options (#489, #601). The first pick is the
 * grade: right for the sentence's own English, wrong for a distractor.
 *
 * With sound on, the sentence plays and the Chinese is hidden until the
 * learner asks for it. Before the pick each word except the target opens its
 * meaning, so an unknown word does not block the sentence, and the sentence
 * still tests the word under study.
 */
const ComprehendTask: React.FC<Props> = ({
  synthAvailable,
  voice,
  lang,
  addedWords,
  onPostWord,
  onAddFailed,
  word,
  sentenceId,
  onCheck,
  onNext,
  onSkip,
}) => {
  const [charSet] = useState(readCharSet);
  const [useSound] = useState(() => readUseSound(synthAvailable));
  const [slow, setSlow] = useState(() => localStorage.getItem('slowMode') === 'true');
  const [load, setLoad] = useState<Load>('loading');
  const [sentence, setSentence] = useState<ResolvedSentence | null>(null);
  const [textShown, setTextShown] = useState(!useSound);
  const [options, setOptions] = useState<SentenceOption[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const hasPicked = picked !== null;
  const descriptionId = useId();
  const [synthLoading, setSynthLoading] = useState(false);
  const [openWord, setOpenWord] = useState<SentenceWord | null>(null);

  // A ref, so that a new callback from the parent does not load the sentence again.
  const mounted = useRef(true);
  const skip = useRef(onSkip);
  skip.current = onSkip;
  const lookups = useRef(0);
  // Whether the text showed at any moment before the pick.
  const textSeen = useRef(!useSound);
  const shownAt = useRef(0);

  const play = useCallback(
    (text: string, slowSpeech = slow) => {
      speak(text, { slow: slowSpeech, voice, lang }, setSynthLoading);
    },
    [lang, slow, voice],
  );

  const fetchSentence = useCallback(async () => {
    setLoad('loading');
    try {
      const { sentence: found } = await getSegmentedSentence(word.simp, charSet, sentenceId);
      if (!mounted.current) return;
      // A sentence with no distractor left gives no choice: the word leaves the set.
      if (!found || !found.distractors?.length) {
        skip.current();
        return;
      }
      const resolved = resolveSentence(found, charSet);
      setSentence(resolved);
      setOptions(
        shuffled([{ id: found.id, english: found.english.sentence }, ...found.distractors]),
      );
      setLoad('ready');
      shownAt.current = Date.now();
      if (useSound) play(resolved.chinese.sentence);
    } catch (error) {
      if (!mounted.current) return;
      reportError(error, { feature: 'sentence-comprehend' });
      setLoad('error');
    }
    // `play` reads the slow setting, which must not reload the sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charSet, sentenceId, useSound, word.simp]);

  useEffect(() => {
    mounted.current = true;
    fetchSentence();
    return () => {
      mounted.current = false;
      ttsService.stopAll();
    };
  }, [fetchSentence]);

  const onToggleSlow = () => {
    setSlow((prev) => {
      localStorage.setItem('slowMode', String(!prev));
      return !prev;
    });
  };

  const onToggleText = () => {
    textSeen.current = true;
    setTextShown((prev) => !prev);
  };

  // A tap on the open word closes it. Only a tap that opens a word before the
  // pick counts as a lookup.
  const onShowWord = (entry: SentenceWord) => {
    if (openWord === entry) {
      setOpenWord(null);
      return;
    }
    if (!hasPicked) lookups.current += 1;
    if (useSound) play(entry[charSet]);
    setOpenWord(entry);
  };

  const onAddWord = (entry: SentenceWord) => {
    dictionaryEntryOf(entry)
      .then((found) => (found ? onPostWord(found) : onAddFailed()))
      .catch((error) => {
        reportError(error, { feature: 'sentence-add-word' });
        onAddFailed();
      });
  };

  // Only the first pick counts: a later tap changes nothing.
  const onPick = (option: SentenceOption) => {
    if (picked !== null || !sentence) return;
    setPicked(option.id);
    setTextShown(true);
    onCheck({
      grade: option.id === sentence.id ? 'right' : 'wrong',
      mode: useSound ? 'audio' : 'text',
      revealed: textSeen.current,
      lookups: lookups.current,
      answerMs: Date.now() - shownAt.current,
      options: options.map(({ id }) => id),
      picked: option.id,
    });
  };

  const onNextTask = () => {
    ttsService.stopAll();
    onNext();
  };

  if (load === 'error') {
    return <TaskLoadError word={word[charSet]} onSkip={onSkip} onRetry={fetchSentence} />;
  }
  if (load === 'loading' || !sentence) return <TaskLoading />;

  const pickedRight = picked === sentence.id;

  const wordButton = (entry: SentenceWord, key: React.Key) => (
    <SentenceWordButton
      key={key}
      entry={entry}
      charSet={charSet}
      open={openWord === entry}
      onClick={() => onShowWord(entry)}
    />
  );

  // Each word a button that opens its meaning. The target stays locked until
  // the reveal.
  const renderSentence = () =>
    sentence.chinese.words.map((segment, i) => {
      if (i === sentence.chinese.targetIndex) {
        const text = word[charSet];
        return hasPicked && sentence.chinese.target ? (
          <Highlight key={i}>{wordButton(sentence.chinese.target, 'target')}</Highlight>
        ) : (
          <Highlight key={i}>{text}</Highlight>
        );
      }
      if (typeof segment === 'string') return <React.Fragment key={i}>{segment}</React.Fragment>;
      return wordButton(segment, i);
    });

  const slowToggle = (size: number) => (
    <Box
      component="button"
      type="button"
      aria-label={copy.sentence.slowMode}
      aria-pressed={slow}
      onClick={onToggleSlow}
      sx={{
        width: size,
        height: size,
        borderRadius: `${size / 2}px`,
        border: `1px solid ${slow ? colors.primaryDark : colors.borderStrong}`,
        bgcolor: slow ? colors.successSurface : colors.card,
        color: slow ? colors.primaryDark : colors.textSecondary,
        fontFamily: fonts.body,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        p: 0,
      }}
    >
      {copy.sentence.slowLabel}
    </Box>
  );

  return (
    <>
      <StudyBody>
        {/* The line names the target word, so it stays empty until the reveal (#504).
          The fixed height keeps the top of the card in place when it fills. */}
        <Box
          sx={{
            mt: 3,
            height: 30,
            lineHeight: '30px',
            textAlign: 'center',
            fontSize: 15,
            color: colors.textSecondary,
          }}
        >
          {hasPicked && (
            <>
              {copy.sentence.readPrompt}
              <Box
                component="span"
                lang="zh"
                sx={{ fontFamily: fonts.hanzi, fontSize: 20, color: colors.primaryLight }}
              >
                {word[charSet]}
              </Box>
            </>
          )}
        </Box>
        <StudyCard
          height={hasPicked ? undefined : 260}
          sx={{ mt: 1.5, gap: 2, justifyContent: textShown ? 'flex-start' : 'center' }}
        >
          {useSound && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: textShown ? 1.25 : 1.75 }}>
              <PlayButton
                size={textShown ? 44 : 88}
                loading={synthLoading}
                onClick={() => play(sentence.chinese.sentence)}
                label={copy.sentence.playSentence}
              />
              {slowToggle(textShown ? 44 : 48)}
            </Box>
          )}
          {textShown && (
            <Box
              component="p"
              lang="zh"
              sx={{
                m: 0,
                fontFamily: fonts.hanzi,
                fontSize: 34,
                lineHeight: 1.6,
                letterSpacing: '0.04em',
              }}
            >
              {renderSentence()}
            </Box>
          )}
          {textShown && (
            <WordGlossPanel
              word={openWord}
              charSet={charSet}
              added={Boolean(
                openWord &&
                addedWords.some((w) => w.simp === openWord.simp && w.trad === openWord.trad),
              )}
              onSpeak={(text) => play(text)}
              onAdd={onAddWord}
            />
          )}
          {hasPicked && (
            <Box
              component="p"
              lang="zh-Latn"
              sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
            >
              {sentence.chinese.pinyin}
            </Box>
          )}
          {useSound && !hasPicked && (
            <PillToggle pressed={textShown} onClick={onToggleText}>
              {textShown ? copy.sentence.hideText : copy.sentence.showText}
            </PillToggle>
          )}
        </StudyCard>
        {hasPicked && (
          <Box
            role="status"
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              color: pickedRight ? colors.success : colors.error,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {pickedRight ? (
              <CheckRoundedIcon sx={{ fontSize: 18 }} />
            ) : (
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            )}
            {pickedRight ? copy.sentenceTabs.right : copy.sentenceTabs.wrong}
          </Box>
        )}
        <Box
          role="group"
          aria-label={copy.sentence.options}
          sx={{ mt: hasPicked ? 1 : 2, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {options.map((option) => {
            const isAnswer = option.id === sentence.id;
            const isPicked = option.id === picked;
            const marked = hasPicked && (isAnswer || isPicked);
            const { border, background } =
              OPTION_COLORS[
                !hasPicked ? 'plain' : isAnswer ? 'answer' : isPicked ? 'picked' : 'plain'
              ];
            return (
              <React.Fragment key={option.id}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => onPick(option)}
                  aria-describedby={marked ? `${descriptionId}-${option.id}` : undefined}
                  sx={{
                    p: 1.75,
                    textAlign: 'left',
                    fontFamily: fonts.body,
                    fontSize: 17,
                    lineHeight: 1.4,
                    color: colors.text,
                    cursor: hasPicked ? 'default' : 'pointer',
                    borderRadius: 1,
                    border: `1px solid ${border}`,
                    bgcolor: background,
                  }}
                >
                  {option.english}
                </Box>
                {marked && (
                  <Box
                    component="span"
                    id={`${descriptionId}-${option.id}`}
                    sx={{ display: 'none' }}
                  >
                    {isAnswer ? copy.sentence.answerOption : copy.sentence.pickedOption}
                  </Box>
                )}
                {hasPicked && !isAnswer && (
                  <ReportSentenceButton
                    key={`${word.id}-${sentence.id}-${option.id}`}
                    report={{
                      sentenceId: sentence.id,
                      word: word.simp,
                      stage: 'option',
                      distractorId: option.id,
                      sentence: sentence.chinese.sentence,
                      english: option.english,
                    }}
                    sx={{ alignSelf: 'flex-end', mt: -0.5 }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Box>
        {hasPicked && (
          <ReportSentenceButton
            key={`${word.id}-${sentence.id}`}
            report={{
              sentenceId: sentence.id,
              word: word.simp,
              stage: 'read',
              sentence: sentence.chinese.sentence,
              english: sentence.english.sentence,
            }}
          />
        )}
      </StudyBody>
      {hasPicked && (
        <StudyButton variant="primary" onClick={onNextTask}>
          {copy.sentence.next}
        </StudyButton>
      )}
    </>
  );
};

export default connector(ComprehendTask);
