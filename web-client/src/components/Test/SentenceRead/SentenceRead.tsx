import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Howl } from 'howler';

import { Box, Paper, Stack, Typography, Chip } from '@mui/material';

import { colors } from '../../../theme';
import Button from '../../UI/Buttons/Button/Button';
import Input from '../../UI/Input/Input';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Spinner from '../../UI/Spinner/Spinner';

import likePic from '../../../assets/images/like.png';
import dislikePic from '../../../assets/images/dislike.png';
import speakerPic from '../../../assets/images/speaker.png';
import micPic from '../../../assets/images/microphone.png';

import successSound from '../../../assets/sounds/success1.wav';
import failSound from '../../../assets/sounds/failure1.wav';

import * as wordActions from '../../../store/actions/index';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { AppDispatch } from '../../../types/actions';
import { searchWord } from '../../../services/dictionaryService';
import { getSegmentedSentence } from '../../../services/sentenceService';
import { parseMeanings } from '../../../utils/meaningUtils';

const beep = new Howl({ src: [successSound], volume: 0.5 });
const fail = new Howl({ src: [failSound], volume: 0.7 });

interface SentenceWord {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

// What the cloud function returns (segmented strings, no lookups)
interface CloudSentence {
  chinese: {
    sentence: string;
    highlight: number[][];
    segments: string[];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

// Resolved sentence with full word data (used for rendering)
interface ResolvedSentence {
  chinese: {
    sentence: string;
    words: (string | SentenceWord)[];
    highlight: number[][];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}


/**
 * Resolve segmented word strings to full word objects using the static dictionary.
 */
async function resolveSentence(
  cloudSentence: CloudSentence
): Promise<ResolvedSentence> {
  // Collect unique non-target segments
  const uniqueSegments = new Set<string>();
  cloudSentence.chinese.segments.forEach((seg, i) => {
    if (i !== cloudSentence.chinese.targetIndex) {
      uniqueSegments.add(seg);
    }
  });

  // Resolve all unique segments in parallel via static dictionary
  const segmentArray = Array.from(uniqueSegments);
  const lookupResults = await Promise.all(
    segmentArray.map(async (seg) => {
      const results = await searchWord(seg, 'simp');
      return { seg, word: results.length > 0 ? results[0] : null };
    })
  );

  const wordMap = new Map<string, SentenceWord>();
  for (const { seg, word } of lookupResults) {
    if (word) {
      wordMap.set(seg, {
        id: word.id,
        simp: word.simp,
        trad: word.trad,
        pinyin: word.pinyin,
        meaning: word.meaning,
      });
    }
  }

  const words: (SentenceWord | string)[] = cloudSentence.chinese.segments.map((seg, i) => {
    if (i === cloudSentence.chinese.targetIndex) {
      return seg; // Target word stays as string marker
    }
    return wordMap.get(seg) || seg; // Resolved word or plain string fallback
  });

  return {
    chinese: {
      sentence: cloudSentence.chinese.sentence,
      highlight: cloudSentence.chinese.highlight,
      targetIndex: cloudSentence.chinese.targetIndex,
      words,
    },
    english: cloudSentence.english,
  };
}

interface SentenceReadState {
  sentences: ResolvedSentence[];
  totalCount: number;
  charSet: 'simp' | 'trad';
  sentenceIndex: number;
  wordIndex: number;
  submitted: boolean;
  entered: string;
  loading: boolean;
  sentenceLoading: boolean;
  useSound: boolean;
  useEnglishSpeechRecognition: boolean;
  showText: boolean;
  openPopup: string;
  message: string;
  recognition: SpeechRecognition | null;
}

const mapStateToProps = (state: RootState) => ({
  synthAvailable: state.settings.synthAvailable,
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
  startSentenceWrite?: (seenOffsets: Record<string, { offset: number; text: string; english: string }>) => void;
  isDemo?: boolean;
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

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
  fontFamily: 'inherit',
  fontSize: '1.1em',
  width: 'auto',
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
  const [state, setState] = useState<SentenceReadState>({
    sentences: [],
    totalCount: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    sentenceIndex: 0,
    wordIndex: 0,
    submitted: false,
    entered: '',
    loading: false,
    sentenceLoading: false,
    useSound: true,
    useEnglishSpeechRecognition: false,
    showText: false,
    openPopup: '',
    message: '',
    recognition: null,
  });

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
      synthAvailable && (localStorage.getItem('useEnglishSpeechRecognition') !== 'false' || Boolean(isDemo));

    updateState({ useSound, useEnglishSpeechRecognition });
  }, [isDemo, synthAvailable, updateState]);

  const onSpeakPinyin = useCallback(
    (sentence: string): void => {
      stateRef.current.recognition?.abort();
      window.speechSynthesis.cancel();

      const synth = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(sentence);
      utterThis.lang = lang || 'zh-CN';
      if (voice) utterThis.voice = voice;
      synth.cancel();
      synth.speak(utterThis);
    },
    [lang, voice]
  );

  const onListenPinyin = useCallback((): void => {
    stateRef.current.recognition?.abort();
    window.speechSynthesis.cancel();

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

  const fetchSentence = useCallback(async (offset: number, isNewWord: boolean): Promise<void> => {
    if (isNewWord) {
      updateState({ loading: true });
    } else {
      updateState({ sentenceLoading: true });
    }

    const currentWord = words[stateRef.current.wordIndex].simp;

    try {
      const { sentence: cloudSentence, totalCount } = await getSegmentedSentence(currentWord, stateRef.current.charSet, offset);

      if (!cloudSentence) {
        if (isNewWord) {
          // No sentences found for this word, try next word
          console.warn(`No sentences found for word: ${currentWord}`);
          if (stateRef.current.wordIndex >= words.length - 1) {
            onEndStage();
          } else {
            setState((prevState) => ({ ...prevState, wordIndex: prevState.wordIndex + 1 }));
          }
        }
        return;
      }

      const resolved = await resolveSentence(cloudSentence);

      setState((prevState) => {
        const newSentences = isNewWord ? [resolved] : [...prevState.sentences, resolved];
        return {
          ...prevState,
          sentences: newSentences,
          totalCount,
          sentenceIndex: offset,
          loading: false,
          sentenceLoading: false,
          showText: false,
        };
      });

      if (stateRef.current.useSound) {
        onSpeakPinyin(resolved.chinese.sentence);
      }
    } catch (error) {
      console.error('Error fetching sentence:', error);
      if (isNewWord) {
        // On error, try next word instead of getting stuck
        if (stateRef.current.wordIndex >= words.length - 1) {
          onEndStage();
        } else {
          setState((prevState) => ({ ...prevState, wordIndex: prevState.wordIndex + 1 }));
        }
      } else {
        updateState({ sentenceLoading: false });
      }
    }
  }, [onEndStage, onSpeakPinyin, updateState, words]);

  const onChangeSentence = useCallback((direction: number): void => {
    const newIndex = stateRef.current.sentenceIndex + direction;

    if (newIndex < 0 || newIndex >= stateRef.current.totalCount) return;

    // If we already have this sentence cached, just navigate
    if (stateRef.current.sentences[newIndex]) {
      setState((prevState) => ({
        ...prevState,
        sentenceIndex: newIndex,
        showText: false,
      }));
    } else {
      // Fetch the next sentence from the cloud
      fetchSentence(newIndex, false);
    }
  }, [fetchSentence]);

  const onYesClicked = (): void => {
    if (stateRef.current.useSound) beep.play();

    const currentWord = words[stateRef.current.wordIndex];
    const seenSentence = stateRef.current.sentences[stateRef.current.sentenceIndex];
    seenOffsets.current[currentWord.simp] = {
      offset: stateRef.current.sentenceIndex,
      text: seenSentence?.chinese.sentence ?? '',
      english: seenSentence?.english.sentence ?? '',
    };

    if (stateRef.current.wordIndex >= words.length - 1) {
      onEndStage();
    } else {
      setState((prevState) => ({
        ...prevState,
        wordIndex: prevState.wordIndex + 1,
        sentenceIndex: 0,
        sentences: [],
        totalCount: 0,
        submitted: false,
        entered: '',
        showText: false,
      }));
    }
  };

  const onNoClicked = (): void => {
    if (stateRef.current.useSound) fail.play();
    updateState({ entered: '', submitted: false });
  };

  const onInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ entered: event.target.value });
  };

  const onKeyPressed = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || stateRef.current.entered === '') return;
    updateState({ submitted: true });
  };

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      if ((event.target as HTMLElement).tagName.toLowerCase() === 'input') return;

      if (event.ctrlKey && event.key === 'b') {
        document.getElementById('answerInput')?.focus();
      }

      if (event.key === 'ArrowUp' && stateRef.current.submitted) {
        onYesClicked();
      }

      if (event.key === 'ArrowDown' && stateRef.current.submitted) {
        onNoClicked();
      }

      if (event.key === 'ArrowLeft' && !stateRef.current.submitted && stateRef.current.sentenceIndex > 0) {
        onChangeSentence(-1);
      }

      if (
        event.key === 'ArrowRight' &&
        !stateRef.current.submitted &&
        stateRef.current.sentenceIndex < stateRef.current.totalCount - 1
      ) {
        onChangeSentence(1);
      }
    },
    [onChangeSentence, onNoClicked, onYesClicked]
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
      fetchSentence(0, true);
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
      fetchSentence(0, true);
    }
    prevWordIndex.current = state.wordIndex;
  }, [fetchSentence, state.wordIndex]);

  // Speak sentence when navigating to a cached sentence
  const prevSentenceIndex = useRef(state.sentenceIndex);
  useEffect(() => {
    if (prevSentenceIndex.current !== state.sentenceIndex) {
      if (state.useSound && state.sentences[state.sentenceIndex]) {
        onSpeakPinyin(state.sentences[state.sentenceIndex].chinese.sentence);
      }
    }
    prevSentenceIndex.current = state.sentenceIndex;
  }, [onSpeakPinyin, state.sentenceIndex, state.sentences, state.useSound]);

  // ── Sentence display content ──────────────────────────────────────────────
  let sentenceCardContent: React.ReactNode = <Spinner />;

  if (state.sentences[state.sentenceIndex] && !state.loading) {
    const currentSentence = state.sentences[state.sentenceIndex];
    const targetIndex = currentSentence.chinese.targetIndex;
    const currentTargetWord = words[state.wordIndex]?.[state.charSet] || '';

    if (state.useSound && !state.showText) {
      // Audio mode: centred speaker button with hint
      sentenceCardContent = (
        <Stack alignItems="center" spacing={1}>
          <PictureButton
            type="secondary"
            src={speakerPic}
            aria-label="Play sentence"
            clicked={() => onSpeakPinyin(currentSentence.chinese.sentence)}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.3 }}>
            Tap to replay
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

        return (
          <Box
            component="span"
            data-popup
            onClick={(event: React.MouseEvent) => {
              if ((event.target as HTMLElement).hasAttribute('data-popup')) {
                onShowPopup(word.id + 'popup', word[state.charSet]);
              }
            }}
            key={index}
            sx={popupBaseSx}
          >
            {word[state.charSet]}
            <Box component="span" data-popup-text id={word.id + 'popup'} style={popupTextStyle}>
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>Pinyin:</Typography>
              <Typography variant="body2">{word.pinyin}</Typography>
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>Meaning:</Typography>
              <Typography variant="body2">{parseMeanings(word.meaning).join(' / ')}</Typography>
              {addedWords.find((aw) => aw.id === word.id) ? (
                <Button disabled>Added!</Button>
              ) : (
                <Button clicked={() => onPostWord(word as Word)}>Add to bank</Button>
              )}
            </Box>
          </Box>
        );
      });

      sentenceCardContent = (
        <Box sx={{ lineHeight: 1.8, fontSize: '1.5em', letterSpacing: 2 }}>
          {renderedWords}
        </Box>
      );
    }
  }

  // ── Main input / navigation area ──────────────────────────────────────────
  let mainContent: React.ReactNode;

  if (state.submitted) {
    const currentSentence = state.sentences[state.sentenceIndex];
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

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          How did you do?
        </Typography>
        <Stack direction="row" spacing={3} justifyContent="center">
          <PictureButton
            style={{ width: 56, height: 56 }}
            clicked={onYesClicked}
            src={likePic}
            aria-label="I got it right"
          />
          <PictureButton
            style={{ width: 56, height: 56 }}
            clicked={onNoClicked}
            src={dislikePic}
            aria-label="I got it wrong"
          />
        </Stack>
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
        <PictureButton type="secondary" src={micPic} aria-label="Record speech" clicked={onListenPinyin} />
      </Stack>
    ) : null;

    mainContent = (
      <Stack spacing={2} alignItems="center">
        <Box sx={{ width: '100%' }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1, display: 'block', mb: 0.5 }}>
            English translation
          </Typography>
          <Input
            id="answerInput"
            changed={onInputChanged}
            keyPressed={onKeyPressed}
            autoComplete="off"
            value={state.entered}
            placeholder="Type here and press Enter…"
            style={{ width: '100%' }}
          />
        </Box>

        {micButton}

        {/* Navigation row */}
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap">
          <Button
            clicked={() => onChangeSentence(-1)}
            disabled={state.sentenceIndex < 1}
            type="ghost"
          >
            ← Prev
          </Button>
          <Button
            clicked={() => onChangeSentence(1)}
            disabled={state.sentenceLoading || state.sentenceIndex >= state.totalCount - 1}
            type="ghost"
          >
            {state.sentenceLoading ? 'Loading…' : 'Next →'}
          </Button>
        </Stack>
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
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 72 }}>
          {sentenceCardContent}
        </Box>
        {/* Helper text – always occupies space to prevent layout shift */}
        <Typography
          variant="caption"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            display: 'block',
            mt: 1,
            visibility:
              (!state.useSound || state.showText) && !!state.sentences[state.sentenceIndex] && !state.loading
                ? 'visible'
                : 'hidden',
          }}
        >
          Tap a word to reveal its meaning
        </Typography>
        {state.useSound && (
          <Chip
            label={state.showText ? 'Hide text' : 'Show text'}
            onClick={onToggleText}
            variant="outlined"
            size="small"
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
