import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';

import { colors } from '../../../theme';
import Button from '../../UI/Buttons/Button/Button';
import Input from '../../UI/Input/Input';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Spinner from '../../UI/Spinner/Spinner';
import SimilarityScore from '../../UI/SimilarityScore/SimilarityScore';

import speakerPic from '../../../assets/images/speaker.png';
import micPic from '../../../assets/images/microphone.png';

import { beep } from '../constants';

import * as wordActions from '../../../store/actions/index';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { AppDispatch } from '../../../types/actions';
import { getSegmentedSentence } from '../../../services/sentenceService';
import { parseMeanings } from '../../../utils/meaningUtils';
import { resolveSentence, SentenceWord, ResolvedSentence } from '../../../utils/sentenceUtils';
import * as ttsService from '../../../services/ttsService';
import { getSimilarityScore } from '../../../services/similarityService';

interface SentenceReadState {
  sentence: ResolvedSentence | null;
  charSet: 'simp' | 'trad';
  wordIndex: number;
  submitted: boolean;
  entered: string;
  loading: boolean;
  synthLoading: boolean;
  useSound: boolean;
  useEnglishSpeechRecognition: boolean;
  showText: boolean;
  openPopup: string;
  message: string;
  recognition: SpeechRecognition | null;
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

// Keyframes for subtle underline fade-in
const tapAffordanceFadeIn = {
  '@keyframes tapAffordanceFadeIn': {
    '0%': { borderBottomColor: 'transparent' },
    '100%': { borderBottomColor: 'rgba(26, 92, 64, 0.35)' },
  },
};

// Popup styles
const popupBaseSx = {
  position: 'relative',
  borderRadius: 1,
  display: 'inline-block',
  cursor: 'pointer',
  userSelect: 'none',
  height: 36,
  boxSizing: 'border-box',
  border: 'none',
  borderBottom: '2px dotted rgba(26, 92, 64, 0.35)',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  width: 'auto',
  color: 'primary.dark',
  animation: 'tapAffordanceFadeIn 0.6s ease-in',
  ...tapAffordanceFadeIn,
  '&:hover': {
    bgcolor: 'primary.dark',
    color: 'common.white',
    cursor: 'pointer',
  },
} as const;

const popupTextStyle: React.CSSProperties = {
  visibility: 'hidden',
  backgroundColor: colors.divider,
  width: 200,
  color: colors.text,
  fontSize: '0.7em',
  textAlign: 'center',
  borderRadius: 6,
  boxSizing: 'border-box',
  padding: 5,
  position: 'absolute',
  zIndex: 1,
  top: '125%',
  left: '50%',
  marginLeft: -100,
  boxShadow: '0 3px 6px rgba(0, 0, 0, 0.3)',
};

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
  const [showTapHint, setShowTapHint] = useState<boolean>(
    () => localStorage.getItem('tapHintDismissed') !== 'true',
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
    useEnglishSpeechRecognition: false,
    showText: false,
    openPopup: '',
    message: '',
    recognition: null,
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceReadState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const initialiseSettings = useCallback((): void => {
    const useSound =
      synthAvailable && (localStorage.getItem('useSound') !== 'false' || Boolean(isDemo));
    const useEnglishSpeechRecognition =
      speechAvailable &&
      (localStorage.getItem('useEnglishSpeechRecognition') !== 'false' || Boolean(isDemo));

    updateState({ useSound, useEnglishSpeechRecognition });
  }, [isDemo, speechAvailable, synthAvailable, updateState]);

  const onSpeakPinyin = useCallback(
    (sentence: string): void => {
      stateRef.current.recognition?.abort();
      ttsService.stopAll();

      updateState({ synthLoading: true });
      ttsService.speak(sentence, {
        speed: slowModeRef.current ? 0.7 : 1.0,
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
      if (!result) updateState({ message: "Couldn't hear anything..." });
    });

    recognition.addEventListener('audiostart', () => {
      updateState({ message: 'Listening...' });
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

  const fetchSentence = useCallback(
    async (offset: number): Promise<void> => {
      updateState({ loading: true });

      const currentWord = words[stateRef.current.wordIndex].simp;

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
            speed: slowModeRef.current ? 0.7 : 1.0,
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
        if (stateRef.current.wordIndex >= words.length - 1) {
          onEndStage();
        } else {
          setState((prevState) => ({ ...prevState, wordIndex: prevState.wordIndex + 1 }));
        }
      }
    },
    [onEndStage, updateState, words, voice, lang],
  );

  const onYesClicked = (): void => {
    if (stateRef.current.useSound) beep.play();

    const currentWord = words[stateRef.current.wordIndex];
    const currentSentence = stateRef.current.sentence;
    seenOffsets.current[currentWord.simp] = {
      offset: 0,
      text: currentSentence?.chinese.sentence ?? '',
      english: currentSentence?.english.sentence ?? '',
    };

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
      }));
    }
  };

  const onInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ entered: event.target.value });
  };

  const onSubmit = (): void => {
    if (stateRef.current.entered === '') return;
    updateState({ submitted: true, scoreLoading: true, score: null });

    const currentSentence = stateRef.current.sentence;
    if (currentSentence) {
      getSimilarityScore(stateRef.current.entered, currentSentence.english.sentence, 'en')
        .then((result) => {
          updateState({ score: result.score, scoreLoading: false });
        })
        .catch(() => {
          updateState({ score: null, scoreLoading: false });
        });
    }
  };

  const onKeyPressed = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    onSubmit();
  };

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'input') return;

      if (event.key === 'Escape' && stateRef.current.openPopup !== '') {
        document.querySelectorAll('[data-popup-text]').forEach((el) => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
        updateState({ openPopup: '' });
      }

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

  const onShowPopup = (id: string, word: string): void => {
    const vocabs = document.querySelectorAll('[data-popup-text]');
    const popup = document.getElementById(id);

    if (popup && popup.style.visibility !== 'visible') {
      vocabs.forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
      if (stateRef.current.useSound) onSpeakPinyin(word);
    }

    if (popup) {
      popup.style.visibility = popup.style.visibility === 'visible' ? 'hidden' : 'visible';
    }
    updateState({ openPopup: id });

    // Dismiss first-use hint on first tap
    if (showTapHint) {
      setShowTapHint(false);
      localStorage.setItem('tapHintDismissed', 'true');
    }
  };

  const closePopup = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (
      stateRef.current.openPopup !== '' &&
      !target.hasAttribute('data-popup') &&
      !(
        target.parentElement?.hasAttribute('data-popup-text') ||
        target.hasAttribute('data-popup-text')
      )
    ) {
      document.querySelectorAll('[data-popup-text]').forEach((el) => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    }
  };

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchSentence(0);
      initialiseSettings();
    }
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', closePopup);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('click', closePopup);
    };
  }, [fetchSentence, initialiseSettings, onKeyUp]);

  const prevWordIndex = useRef(state.wordIndex);
  useEffect(() => {
    if (prevWordIndex.current !== state.wordIndex) {
      fetchSentence(0);
    }
    prevWordIndex.current = state.wordIndex;
  }, [fetchSentence, state.wordIndex]);

  // ── Sentence display content ──────────────────────────────────────────────
  let sentenceCardContent: React.ReactNode = <Spinner />;

  if (state.sentence && !state.loading) {
    const currentSentence = state.sentence;
    const targetIndex = currentSentence.chinese.targetIndex;
    const currentTargetWord = words[state.wordIndex]?.[state.charSet] || '';

    if (state.useSound && !state.showText) {
      // Audio mode: centred speaker button with hint
      sentenceCardContent = (
        <Stack alignItems="center" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                width: 40,
              }}
            >
              {state.synthLoading ? (
                <CircularProgress size={24} color="primary" aria-label="Loading speech" />
              ) : (
                <PictureButton
                  type="secondary"
                  src={speakerPic}
                  aria-label="Play sentence"
                  clicked={() => onSpeakPinyin(currentSentence.chinese.sentence)}
                />
              )}
            </Box>
            <Tooltip title={slowMode ? 'Slow mode on' : 'Slow mode off'}>
              <IconButton
                aria-label="Toggle slow mode"
                aria-pressed={slowMode}
                onClick={onToggleSlowMode}
                size="small"
                sx={{
                  fontSize: '1.2rem',
                  color: slowMode ? 'primary.main' : 'text.disabled',
                  bgcolor: slowMode ? 'primary.50' : 'transparent',
                  border: '1px solid',
                  borderColor: slowMode ? 'primary.main' : 'divider',
                  '&:hover': {
                    bgcolor: slowMode ? 'primary.100' : 'action.hover',
                  },
                }}
              >
                🐢
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
            {state.synthLoading ? 'Loading audio…' : 'Tap to replay'}
          </Typography>
        </Stack>
      );
    } else {
      // Text mode: render the segmented sentence
      const renderedWords = currentSentence.chinese.words.map((word, index) => {
        const isTarget = index === targetIndex;

        if (isTarget) {
          return (
            <Box
              component="span"
              key={index}
              sx={{
                color: 'primary.dark',
                bgcolor: 'primary.50',
                px: 0.5,
                borderRadius: 1,
                lineHeight: 'inherit',
              }}
            >
              {currentTargetWord}
            </Box>
          );
        }

        if (typeof word === 'string') {
          return <React.Fragment key={index}>{word}</React.Fragment>;
        }

        // Helper to render a single clickable word with popup
        const renderWordPopup = (w: SentenceWord, popupId: string, key: string | number) => (
          <Box
            component="span"
            role="button"
            tabIndex={0}
            data-popup
            aria-label={`${w[state.charSet]}: tap to see meaning`}
            onClick={(event: React.MouseEvent) => {
              if ((event.target as HTMLElement).hasAttribute('data-popup')) {
                onShowPopup(popupId, w[state.charSet]);
              }
            }}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onShowPopup(popupId, w[state.charSet]);
              }
            }}
            key={key}
            sx={popupBaseSx}
          >
            {w[state.charSet]}
            <Box component="span" data-popup-text id={popupId} style={popupTextStyle}>
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>
                Pinyin:
              </Typography>
              <Typography lang="zh-Latn" variant="body2">
                {w.pinyin || '—'}
              </Typography>
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>
                Meaning:
              </Typography>
              <Typography variant="body2">
                {w.meaning ? parseMeanings(w.meaning).join(' / ') : 'No definition found'}
              </Typography>
              {w.id !== -1 &&
                (addedWords.find((aw) => aw.id === w.id) ? (
                  <Button disabled>Added!</Button>
                ) : (
                  <Button clicked={() => onPostWord(w as Word)}>Add to list</Button>
                ))}
            </Box>
          </Box>
        );

        // Decomposed segment — render each sub-word as clickable
        if (Array.isArray(word)) {
          return (
            <React.Fragment key={index}>
              {word.map((subWord, subIndex) =>
                renderWordPopup(
                  subWord,
                  `${subWord.id}-${index}-${subIndex}-popup`,
                  `${index}-${subIndex}`,
                ),
              )}
            </React.Fragment>
          );
        }

        return renderWordPopup(word, `${word.id}-${index}-popup`, index);
      });

      sentenceCardContent = (
        <Box lang="zh" sx={{ lineHeight: 1.8, fontSize: '1.5em', letterSpacing: 2 }}>
          {renderedWords}
        </Box>
      );
    }
  }

  // ── Main input / navigation area ──────────────────────────────────────────
  let mainContent: React.ReactNode;

  if (state.submitted) {
    const currentSentence = state.sentence!;
    let translation: React.ReactNode = currentSentence.english.sentence;

    if (currentSentence.english.highlight.length > 0) {
      const t = currentSentence.english.sentence;
      const s = currentSentence.english.highlight[0][0];
      const e = currentSentence.english.highlight[0][1];
      translation = (
        <>
          {t.slice(0, s)}
          <Box component="span" sx={{ color: 'primary.dark', fontWeight: 600 }}>
            {t.slice(s, e)}
          </Box>
          {t.slice(e)}
        </>
      );
    }

    mainContent = (
      <Stack spacing={2} alignItems="center">
        <Stack spacing={1} sx={{ width: '100%' }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            Your translation
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: '12px 16px', borderRadius: 2, bgcolor: '#f9f9f9', textAlign: 'left' }}
          >
            <Typography sx={{ color: 'text.primary', fontSize: '1em' }}>{state.entered}</Typography>
          </Paper>
        </Stack>

        <Stack spacing={1} sx={{ width: '100%' }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            Correct translation
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: '12px 16px', borderRadius: 2, bgcolor: '#f0f7f4', textAlign: 'left' }}
          >
            <Typography sx={{ color: 'text.primary', fontSize: '1em' }}>{translation}</Typography>
          </Paper>
        </Stack>

        {state.scoreLoading ? (
          <SimilarityScore score={0} loading />
        ) : state.score !== null ? (
          <SimilarityScore score={state.score} />
        ) : (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Score unavailable
          </Typography>
        )}

        <Button
          clicked={onYesClicked}
          aria-label={
            state.wordIndex >= words.length - 1
              ? sentenceWriteEnabled
                ? 'Next stage'
                : 'Finish'
              : 'Next word'
          }
        >
          {state.wordIndex >= words.length - 1
            ? sentenceWriteEnabled
              ? 'Next Stage'
              : 'Finish'
            : 'Next Word'}
        </Button>
      </Stack>
    );
  } else {
    const micButton = state.useEnglishSpeechRecognition ? (
      <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
        {state.message && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {state.message}
          </Typography>
        )}
        <PictureButton
          type="secondary"
          src={micPic}
          aria-label="Record speech"
          clicked={onListenPinyin}
        />
      </Stack>
    ) : null;

    mainContent = (
      <Stack spacing={2} alignItems="center">
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: 1, display: 'block', mb: 0.5 }}
          >
            English translation
          </Typography>
          <Input
            id="answerInput"
            aria-label="English translation"
            changed={onInputChanged}
            keyPressed={onKeyPressed}
            autoComplete="off"
            value={state.entered}
            placeholder="Type your translation…"
            style={{ width: '100%' }}
          />
          <Button
            clicked={onSubmit}
            disabled={state.entered === ''}
            aria-label="Submit translation"
          >
            Submit
          </Button>
        </Box>

        {micButton}
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        width: '90%',
        maxWidth: 520,
        mx: 'auto',
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* Header */}
      <Typography
        variant="overline"
        sx={{ textAlign: 'center', color: 'text.secondary', letterSpacing: 2, display: 'block' }}
      >
        Listen &amp; translate
      </Typography>

      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
        Word {state.wordIndex + 1} of {words.length}
      </Typography>

      {/* Sentence card */}
      <Paper
        elevation={2}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: 110,
          p: 3,
          borderRadius: 3,
          bgcolor: '#fff',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 72,
          }}
        >
          {sentenceCardContent}
        </Box>
        {/* Helper text – always occupies space to prevent layout shift */}
        <Typography
          variant="caption"
          data-testid="tap-hint"
          sx={{
            textAlign: 'center',
            color: showTapHint ? 'primary.dark' : 'text.secondary',
            fontWeight: showTapHint ? 600 : 400,
            display: 'block',
            mt: 1,
            visibility:
              (!state.useSound || state.showText) && !!state.sentence && !state.loading
                ? 'visible'
                : 'hidden',
          }}
        >
          {showTapHint ? 'Tap any word for its definition' : 'Tap a word to reveal its meaning'}
        </Typography>
        {state.useSound && (
          <Chip
            label={state.showText ? 'Hide text' : 'Show text'}
            onClick={onToggleText}
            variant="outlined"
            size="small"
            aria-pressed={state.showText}
            sx={{ cursor: 'pointer', borderColor: 'primary.dark', color: 'primary.dark', mt: 2 }}
          />
        )}
      </Paper>

      {/* Input / result area */}
      {mainContent}
    </Box>
  );
};

export default withRouter(connector(SentenceRead));
