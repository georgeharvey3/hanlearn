import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Box } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import WordGlossPanel from '../Test/Study/WordGlossPanel';
import ReportSentenceButton from '../Test/Study/ReportSentenceButton';
import { PillToggle, PlayButton, StudyButton, StudyCard } from '../Test/Study/parts';
import * as wordActions from '../../store/actions/index';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import { AppDispatch } from '../../types/actions';
import { getSegmentedSentence } from '../../services/sentenceService';
import { reportError } from '../../services/errorReporting';
import * as ttsService from '../../services/ttsService';
import {
  ResolvedSentence,
  SentenceWord,
  dictionaryEntryOf,
  resolveSentence,
} from '../../utils/sentenceUtils';
import { SentenceResult } from '../../utils/sentenceQueue';
import {
  GradeButtons,
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
  onGrade: (outcome: TaskOutcome) => void;
  /** Leave the word out of the set, when its sentence does not load. */
  onSkip: () => void;
}

type Props = ConnectedProps<typeof connector> & OwnProps;

type Load = 'loading' | 'error' | 'ready';

/**
 * One Comprehend task: the learner hears or reads an example sentence,
 * reveals the English, and grades what they understood (#489).
 *
 * With sound on, the sentence plays and the Chinese is hidden until the
 * learner asks for it. Before the reveal each word except the target opens its
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
  onGrade,
  onSkip,
}) => {
  const [charSet] = useState(readCharSet);
  const [useSound] = useState(() => readUseSound(synthAvailable));
  const [slow, setSlow] = useState(() => localStorage.getItem('slowMode') === 'true');
  const [load, setLoad] = useState<Load>('loading');
  const [sentence, setSentence] = useState<ResolvedSentence | null>(null);
  const [textShown, setTextShown] = useState(!useSound);
  const [revealed, setRevealed] = useState(false);
  const [synthLoading, setSynthLoading] = useState(false);
  const [openWord, setOpenWord] = useState<SentenceWord | null>(null);

  // A ref, so that a new callback from the parent does not load the sentence again.
  const mounted = useRef(true);
  const skip = useRef(onSkip);
  skip.current = onSkip;
  const lookups = useRef(0);
  // Whether the text showed at any moment before the reveal.
  const textSeen = useRef(!useSound);
  const shownAt = useRef(0);
  const revealedAt = useRef(0);

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
      if (!found) {
        skip.current();
        return;
      }
      const resolved = resolveSentence(found, charSet);
      setSentence(resolved);
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

  const onReveal = () => {
    revealedAt.current = Date.now();
    setRevealed(true);
    setTextShown(true);
  };

  // A tap on the open word closes it. Only a tap that opens a word before the
  // reveal counts as a lookup.
  const onShowWord = (entry: SentenceWord) => {
    if (openWord === entry) {
      setOpenWord(null);
      return;
    }
    if (!revealed) lookups.current += 1;
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

  const grade = (result: SentenceResult) => {
    ttsService.stopAll();
    onGrade({
      grade: result,
      mode: useSound ? 'audio' : 'text',
      revealed: textSeen.current,
      lookups: lookups.current,
      answerMs: revealedAt.current - shownAt.current,
    });
  };

  if (load === 'error') {
    return <TaskLoadError word={word[charSet]} onSkip={onSkip} onRetry={fetchSentence} />;
  }
  if (load === 'loading' || !sentence) return <TaskLoading />;

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
        return revealed && sentence.chinese.target ? (
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
        {revealed && (
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
        height={revealed ? undefined : 260}
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
        {revealed && (
          <Box
            component="p"
            lang="zh-Latn"
            sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
          >
            {sentence.chinese.pinyin}
          </Box>
        )}
        {useSound && !revealed && (
          <PillToggle pressed={textShown} onClick={onToggleText}>
            {textShown ? copy.sentence.hideText : copy.sentence.showText}
          </PillToggle>
        )}
      </StudyCard>
      {revealed && (
        <>
          <Box
            sx={{
              mt: 2,
              p: 1.75,
              border: `1px solid ${colors.divider}`,
              borderRadius: 1,
              bgcolor: colors.card,
              fontSize: 17,
            }}
          >
            {sentence.english.sentence}
          </Box>
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
        </>
      )}
      <Box sx={{ flex: 1, minHeight: 24 }} />
      {revealed ? (
        <GradeButtons onGrade={grade} />
      ) : (
        <StudyButton variant="primary" onClick={onReveal}>
          {copy.sentenceTabs.showEnglish}
        </StudyButton>
      )}
    </>
  );
};

export default connector(ComprehendTask);
