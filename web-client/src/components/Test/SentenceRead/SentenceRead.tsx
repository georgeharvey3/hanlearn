import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { pinyin as toPinyin } from 'pinyin-pro';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import SimilarityScore from '../../UI/SimilarityScore/SimilarityScore';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';
import WordSheet from '../Study/WordSheet';
import {
  MicButton,
  Overline,
  PillToggle,
  PlayButton,
  StatusLine,
  StudyButton,
  StudyCard,
  hanziSx,
} from '../Study/parts';

import { beep } from '../constants';

import * as wordActions from '../../../store/actions/index';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { AppDispatch } from '../../../types/actions';
import { getSegmentedSentence, takeSentenceStart } from '../../../services/sentenceService';
import { resolveSentence, SentenceWord, ResolvedSentence } from '../../../utils/sentenceUtils';
import * as ttsService from '../../../services/ttsService';
import { getSimilarityScore } from '../../../services/similarityService';
import { reportError } from '../../../services/errorReporting';

interface SentenceReadState {
  sentence: ResolvedSentence | null;
  charSet: 'simp' | 'trad';
  wordIndex: number;
  submitted: boolean;
  entered: string;
  loading: boolean;
  synthLoading: boolean;
  useSound: boolean;
  showText: boolean;
  /** The word whose definition is open, or null. */
  popup: SentenceWord | null;
  /** Whether the sentence for the current word failed to load. */
  loadError: boolean;
  message: string;
  recognition: SpeechRecognition | null;
  listening: boolean;
  score: number | null;
  scoreLoading: boolean;
}

const mapStateToProps = (state: RootState) => ({
  synthAvailable: state.settings.synthAvailable,
  speechAvailable: state.settings.speechAvailable,
  voice: state.settings.voice,
  lang: state.settings.lang,
  addedWords: state.addWords.words,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onPostWord: (word: Word) => dispatch(wordActions.postWord(word)),
});

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  words: Word[];
  sentenceWriteEnabled?: boolean;
  startSentenceWrite?: (
    seenOffsets: Record<string, { offset: number; text: string; english: string }>,
  ) => void;
  isDemo?: boolean;
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

/** The speed of speech in slow mode. */
const SLOW_SPEED = 0.7;

const SentenceRead: React.FC<Props> = ({
  synthAvailable,
  speechAvailable,
  voice,
  lang,
  addedWords,
  onPostWord,
  words,
  sentenceWriteEnabled,
  startSentenceWrite,
  isDemo,
  history,
}) => {
  const [slowMode, setSlowMode] = useState<boolean>(
    () => localStorage.getItem('slowMode') === 'true',
  );
  const [state, setState] = useState<SentenceReadState>({
    sentence: null,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad',
    wordIndex: 0,
    submitted: false,
    entered: '',
    loading: false,
    synthLoading: false,
    useSound: true,
    showText: false,
    popup: null,
    loadError: false,
    message: '',
    recognition: null,
    listening: false,
    score: null,
    scoreLoading: false,
  });

  const slowModeRef = useRef(slowMode);
  useEffect(() => {
    slowModeRef.current = slowMode;
  }, [slowMode]);

  const onToggleSlowMode = useCallback((): void => {
    setSlowMode((prev) => {
      const next = !prev;
      localStorage.setItem('slowMode', String(next));
      return next;
    });
  }, []);

  const stateRef = useRef(state);
  const hasInitialized = useRef(false);
  const seenOffsets = useRef<Record<string, { offset: number; text: string; english: string }>>({});
  const currentOffset = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceReadState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const initialiseSettings = useCallback((): void => {
    const useSound =
      synthAvailable && (localStorage.getItem('useSound') !== 'false' || Boolean(isDemo));

    updateState({ useSound });
  }, [isDemo, synthAvailable, updateState]);

  const onSpeakPinyin = useCallback(
    (sentence: string): void => {
      stateRef.current.recognition?.abort();
      ttsService.stopAll();

      updateState({ synthLoading: true });
      ttsService.speak(sentence, {
        speed: slowModeRef.current ? SLOW_SPEED : 1.0,
        fallbackVoice: voice,
        fallbackLang: lang || 'zh-CN',
        onStart: () => {
          updateState({ synthLoading: false });
        },
        onEnd: () => {
          updateState({ synthLoading: false });
        },
        onError: () => {
          updateState({ synthLoading: false });
        },
      });
    },
    [lang, voice, updateState],
  );

  const onListenPinyin = useCallback((): void => {
    stateRef.current.recognition?.abort();
    ttsService.stopAll();

    const recognition = new window.webkitSpeechRecognition();
    updateState({ recognition, message: '' });

    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      result = event.results[0][0].transcript;
      updateState({ entered: result, message: '' });
      document.getElementById('answerInput')?.focus();
    });

    recognition.addEventListener('end', () => {
      updateState({ listening: false });
      if (!result) updateState({ message: copy.test.status.heardNothing });
    });

    recognition.addEventListener('audiostart', () => {
      updateState({ message: copy.test.status.listening, listening: true });
    });

    recognition.start();
  }, [updateState]);

  const onEndStage = useCallback((): void => {
    if (sentenceWriteEnabled) {
      startSentenceWrite?.(seenOffsets.current);
    } else {
      history.push('/');
    }
  }, [history, sentenceWriteEnabled, startSentenceWrite]);

  const fetchSentence = useCallback(async (): Promise<void> => {
    updateState({ loading: true, loadError: false });

    const currentWord = words[stateRef.current.wordIndex].simp;
    const offset = takeSentenceStart(currentWord);
    currentOffset.current = offset;

    try {
      const { sentence: cloudSentence } = await getSegmentedSentence(
        currentWord,
        stateRef.current.charSet,
        offset,
      );

      if (!cloudSentence) {
        console.warn(`No sentences found for word: ${currentWord}`);
        if (stateRef.current.wordIndex >= words.length - 1) {
          onEndStage();
        } else {
          setState((prevState) => ({ ...prevState, wordIndex: prevState.wordIndex + 1 }));
        }
        return;
      }

      const resolved = await resolveSentence(cloudSentence);

      const willSpeak = stateRef.current.useSound;

      setState((prevState) => ({
        ...prevState,
        sentence: resolved,
        loading: false,
        showText: false,
        synthLoading: willSpeak,
      }));

      if (willSpeak) {
        stateRef.current.recognition?.abort();
        ttsService.stopAll();
        ttsService.speak(resolved.chinese.sentence, {
          speed: slowModeRef.current ? SLOW_SPEED : 1.0,
          fallbackVoice: voice,
          fallbackLang: lang || 'zh-CN',
          onStart: () => {
            updateState({ synthLoading: false });
          },
          onEnd: () => {
            updateState({ synthLoading: false });
          },
          onError: () => {
            updateState({ synthLoading: false });
          },
        });
      }
    } catch (error) {
      console.error('Error fetching sentence:', error);
      reportError(error, { feature: 'sentence-read' });
      // The learner chooses: try the word again, or skip it.
      updateState({ loading: false, loadError: true });
    }
  }, [onEndStage, updateState, words, voice, lang]);

  /** Move to the next word, or end the stage after the last. */
  const advance = (): void => {
    if (stateRef.current.wordIndex >= words.length - 1) {
      onEndStage();
    } else {
      setState((prevState) => ({
        ...prevState,
        wordIndex: prevState.wordIndex + 1,
        sentence: null,
        submitted: false,
        entered: '',
        showText: false,
        score: null,
        scoreLoading: false,
        loadError: false,
      }));
    }
  };

  const onYesClicked = (): void => {
    if (stateRef.current.useSound) beep.play();

    const currentWord = words[stateRef.current.wordIndex];
    const currentSentence = stateRef.current.sentence;
    seenOffsets.current[currentWord.simp] = {
      offset: currentOffset.current,
      text: currentSentence?.chinese.sentence ?? '',
      english: currentSentence?.english.sentence ?? '',
    };
    advance();
  };

  const onInputChanged = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    updateState({ entered: event.target.value });
  };

  const onSubmit = (): void => {
    if (stateRef.current.entered === '') return;
    stateRef.current.recognition?.abort();
    updateState({ submitted: true, scoreLoading: true, score: null, message: '' });

    const currentSentence = stateRef.current.sentence;
    if (currentSentence) {
      getSimilarityScore(stateRef.current.entered, currentSentence.english.sentence, 'en')
        .then((result) => {
          updateState({ score: result.score, scoreLoading: false });
        })
        .catch((error) => {
          reportError(error, { feature: 'sentence-score', context: { language: 'en' } });
          updateState({ score: null, scoreLoading: false });
        });
    }
  };

  // Enter sends the translation; Shift+Enter is a new line.
  const onKeyPressed = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    onSubmit();
  };

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      const tag = (event.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (event.ctrlKey && event.key === 'b') {
        document.getElementById('answerInput')?.focus();
      }

      if (event.key === 'ArrowUp' && stateRef.current.submitted) {
        onYesClicked();
      }
    },
    [onYesClicked, updateState],
  );

  const onToggleText = (): void => {
    setState((prevState) => ({ ...prevState, showText: !prevState.showText }));
  };

  const onShowPopup = (word: SentenceWord): void => {
    if (stateRef.current.useSound) onSpeakPinyin(word[stateRef.current.charSet]);
    updateState({ popup: word });
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchSentence();
      initialiseSettings();
    }
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [fetchSentence, initialiseSettings, onKeyUp]);

  const prevWordIndex = useRef(state.wordIndex);
  useEffect(() => {
    if (prevWordIndex.current !== state.wordIndex) {
      fetchSentence();
    }
    prevWordIndex.current = state.wordIndex;
  }, [fetchSentence, state.wordIndex]);

  // ── Render ────────────────────────────────────────────────────────────────
  const onEnd = (): void => {
    stateRef.current.recognition?.abort();
    ttsService.stopAll();
    history.push('/');
  };

  const currentWordText = words[state.wordIndex]?.[state.charSet] || '';
  const isLast = state.wordIndex >= words.length - 1;
  const top = (
    <StudyTop
      stage={copy.study.stageRead}
      done={state.wordIndex + (state.submitted ? 1 : 0)}
      position={state.wordIndex + 1}
      total={words.length}
      onEnd={onEnd}
    />
  );

  const highlight = (text: React.ReactNode, key?: React.Key) => (
    <Box
      component="span"
      key={key}
      sx={{
        color: colors.primaryDark,
        bgcolor: colors.successSurface,
        borderRadius: '3px',
        px: 0.5,
      }}
    >
      {text}
    </Box>
  );

  // The sentence as text: each word a button that opens its definition, and
  // the word under study highlighted.
  const renderSentence = (sentence: ResolvedSentence, tappable: boolean) =>
    sentence.chinese.words.map((word, index) => {
      if (index === sentence.chinese.targetIndex) return highlight(currentWordText, index);
      if (typeof word === 'string') return <React.Fragment key={index}>{word}</React.Fragment>;

      const renderWord = (w: SentenceWord, key: React.Key) =>
        tappable ? (
          <Box
            component="button"
            key={key}
            type="button"
            aria-label={copy.sentence.wordMeaning(w[state.charSet])}
            onClick={() => onShowPopup(w)}
            sx={{
              border: 'none',
              background: state.popup === w ? colors.text : 'transparent',
              color: state.popup === w ? colors.white : 'inherit',
              borderRadius: '3px',
              p: 0,
              font: 'inherit',
              letterSpacing: 'inherit',
              cursor: 'pointer',
              borderBottom: state.popup === w ? 'none' : `1px dotted ${colors.borderStrong}`,
            }}
          >
            {w[state.charSet]}
          </Box>
        ) : (
          <React.Fragment key={key}>{w[state.charSet]}</React.Fragment>
        );

      return Array.isArray(word) ? (
        <React.Fragment key={index}>
          {word.map((sub, subIndex) => renderWord(sub, `${index}-${subIndex}`))}
        </React.Fragment>
      ) : (
        renderWord(word, index)
      );
    });

  if (state.loadError) {
    return (
      <StudyScreen>
        {top}
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
            {currentWordText}
          </Box>
          <Box role="alert" sx={{ fontSize: 17, fontWeight: 600 }}>
            {copy.sentence.loadFailed}
          </Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        <StudyButton onClick={advance}>{copy.sentence.skipWord}</StudyButton>
        <StudyButton variant="primary" onClick={() => fetchSentence()} sx={{ mt: 1.25 }}>
          {copy.sentence.tryAgain}
        </StudyButton>
      </StudyScreen>
    );
  }

  if (!state.sentence || state.loading) {
    return (
      <StudyScreen>
        {top}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress aria-label={copy.study.loading} sx={{ color: colors.primaryDark }} />
        </Box>
      </StudyScreen>
    );
  }

  const sentence = state.sentence;

  if (state.submitted) {
    const english = sentence.english.sentence;
    const [start, end] = sentence.english.highlight[0] ?? [0, 0];
    const box = {
      p: 1.75,
      border: `1px solid ${colors.divider}`,
      borderRadius: 1,
      bgcolor: colors.card,
      fontSize: 17,
    };

    return (
      <StudyScreen>
        {top}
        <StudyCard seal={false} sx={{ mt: 2.5, px: 2.5, py: 2.25, gap: 0.75 }}>
          <Box
            component="p"
            lang="zh"
            sx={{
              m: 0,
              fontFamily: fonts.hanzi,
              fontSize: 30,
              lineHeight: 1.5,
              letterSpacing: '0.04em',
            }}
          >
            {renderSentence(sentence, false)}
          </Box>
          <Box
            component="p"
            lang="zh-Latn"
            sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
          >
            {toPinyin(sentence.chinese.sentence, { nonZh: 'consecutive' })}
          </Box>
        </StudyCard>
        <Overline sx={{ mt: 2.75, mb: 0.75 }}>{copy.sentence.yourTranslation}</Overline>
        <Box sx={box}>{state.entered}</Box>
        <Overline sx={{ mt: 2, mb: 0.75 }}>{copy.sentence.correctTranslation}</Overline>
        <Box sx={box}>
          {end > start ? (
            <>
              {english.slice(0, start)}
              <Box component="span" sx={{ color: colors.primaryDark, fontWeight: 600 }}>
                {english.slice(start, end)}
              </Box>
              {english.slice(end)}
            </>
          ) : (
            english
          )}
        </Box>
        <Box sx={{ mt: 2.75 }}>
          {state.scoreLoading ? (
            <SimilarityScore score={0} loading />
          ) : state.score !== null ? (
            <SimilarityScore score={state.score} />
          ) : (
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
              {copy.sentence.scoreUnavailable}
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, minHeight: 24 }} />
        <StudyButton variant="primary" onClick={onYesClicked}>
          {isLast
            ? sentenceWriteEnabled
              ? copy.sentence.nextStage
              : copy.sentence.finish
            : copy.sentence.nextWord}
        </StudyButton>
      </StudyScreen>
    );
  }

  const textShown = !state.useSound || state.showText;
  const slowToggle = (size: number) => (
    <Box
      component="button"
      type="button"
      aria-label={copy.sentence.slowMode}
      aria-pressed={slowMode}
      onClick={onToggleSlowMode}
      sx={{
        width: size,
        height: size,
        borderRadius: `${size / 2}px`,
        border: `1px solid ${slowMode ? colors.primaryDark : colors.borderStrong}`,
        bgcolor: slowMode ? colors.successSurface : colors.card,
        color: slowMode ? colors.primaryDark : colors.textSecondary,
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
  const play = () => onSpeakPinyin(sentence.chinese.sentence);

  return (
    <StudyScreen>
      {top}
      <Box sx={{ mt: 3, textAlign: 'center', fontSize: 15, color: colors.textSecondary }}>
        {copy.sentence.readPrompt}
        <Box
          component="span"
          lang="zh"
          sx={{ fontFamily: fonts.hanzi, fontSize: 20, color: colors.primaryLight }}
        >
          {currentWordText}
        </Box>
      </Box>
      <StudyCard
        height={260}
        seal={false}
        sx={{ mt: 1.5, gap: 2, justifyContent: textShown ? 'flex-start' : 'center' }}
      >
        {state.useSound && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: textShown ? 1.25 : 1.75 }}>
            <PlayButton
              size={textShown ? 44 : 88}
              loading={state.synthLoading}
              onClick={play}
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
            {renderSentence(sentence, true)}
          </Box>
        )}
        {state.useSound && (
          <PillToggle pressed={state.showText} onClick={onToggleText}>
            {state.showText ? copy.sentence.hideText : copy.sentence.showText}
          </PillToggle>
        )}
      </StudyCard>
      {speechAvailable && (
        <MicButton
          listening={state.listening}
          onClick={() => (state.listening ? state.recognition?.abort() : onListenPinyin())}
          sx={{ mt: 2.75 }}
        />
      )}
      {state.message && (
        <StatusLine
          tone="neutral"
          icon={state.message === copy.test.status.listening ? 'dot' : undefined}
        >
          {state.message}
        </StatusLine>
      )}
      <Overline component="label" htmlFor="answerInput" sx={{ mt: 2.5 }}>
        {copy.sentence.englishTranslation}
      </Overline>
      <Box
        component="textarea"
        id="answerInput"
        value={state.entered}
        onChange={onInputChanged}
        onKeyDown={onKeyPressed}
        placeholder={copy.sentence.translationPlaceholder}
        autoComplete="off"
        sx={{
          mt: 1,
          height: 96,
          boxSizing: 'border-box',
          borderRadius: 1,
          border: `1px solid ${colors.borderStrong}`,
          bgcolor: colors.card,
          px: 1.75,
          py: 1.5,
          fontFamily: fonts.body,
          fontSize: 17,
          color: colors.text,
          outline: 'none',
          resize: 'none',
          '&:focus': { border: `2px solid ${colors.primaryDark}`, px: '13px', py: '11px' },
          '&::placeholder': { color: colors.placeholder },
        }}
      />
      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton variant="primary" disabled={state.entered === ''} onClick={onSubmit}>
        {copy.test.check}
      </StudyButton>
      <WordSheet
        word={state.popup}
        charSet={state.charSet}
        added={Boolean(state.popup && addedWords.find((w) => w.id === state.popup!.id))}
        onClose={() => updateState({ popup: null })}
        onSpeak={onSpeakPinyin}
        onAdd={(w) => onPostWord(w as Word)}
      />
    </StudyScreen>
  );
};

export default withRouter(connector(SentenceRead));
