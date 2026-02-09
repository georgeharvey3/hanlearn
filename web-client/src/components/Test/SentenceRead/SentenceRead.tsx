import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Howl } from 'howler';
import { httpsCallable } from 'firebase/functions';

import { Box, Paper, Typography } from '@mui/material';

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
import { functions } from '../../../firebase/config';
import { searchWord } from '../../../services/dictionaryService';

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
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

// Cloud Function for fetching a single sentence at an offset
const getSentenceFromCloud = httpsCallable<
  { word: string; offset: number },
  { sentence: CloudSentence | null; totalCount: number }
>(functions, 'getSentences');

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
  startSentenceWrite?: () => void;
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
    bgcolor: '#c75940',
    color: '#e6e0ae',
    cursor: 'pointer',
  },
} as const;

const popupTextStyle: React.CSSProperties = {
  visibility: 'hidden',
  backgroundColor: 'rgb(238, 238, 238)',
  width: 200,
  color: 'rgb(49, 49, 49)',
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
  boxShadow: '0 3px 6px rgb(73, 34, 34)',
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceReadState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const initialiseSettings = useCallback((): void => {
    const useSound =
      synthAvailable && localStorage.getItem('useSound') !== 'false';
    const useEnglishSpeechRecognition =
      synthAvailable && localStorage.getItem('useEnglishSpeechRecognition') !== 'false';

    updateState({ useSound, useEnglishSpeechRecognition });
  }, [synthAvailable, updateState]);

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
      startSentenceWrite?.();
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
      const result = await getSentenceFromCloud({ word: currentWord, offset });
      const { sentence: cloudSentence, totalCount } = result.data;

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

  let sentenceWords: React.ReactNode = <Spinner />;

  if (state.sentences[state.sentenceIndex] && !state.loading) {
    const currentSentence = state.sentences[state.sentenceIndex];
    const sentenceText = currentSentence.chinese.sentence;
    const wordStart = currentSentence.chinese.highlight[0]?.[0] || 0;
    const wordEnd = currentSentence.chinese.highlight[0]?.[1] || 0;
    // chosenWord is in simplified (matches the sentence text from cloud function)
    const chosenWord = sentenceText.slice(wordStart, wordEnd);
    // The display form of the target word in the selected character set
    const currentTargetWord = words[state.wordIndex]?.[state.charSet] || chosenWord;

    sentenceWords = currentSentence.chinese.words.map((word, index) => {
      if (typeof word === 'string') {
        // String entries are the target word marker (in simplified from cloud function)
        if (word === chosenWord) {
          return (
            <Box
              component="span"
              key={index}
              sx={{ color: 'primary.main', fontSize: '1.1em' }}
            >
              {currentTargetWord}
            </Box>
          );
        }
        return word;
      } else {
        // Compare using simplified (matches the sentence text), display in selected charSet
        if (word.simp === chosenWord) {
          return (
            <Box
              component="span"
              key={index}
              sx={{ color: 'primary.main', fontSize: '1.1em' }}
            >
              {word[state.charSet]}
            </Box>
          );
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
            <Box
              component="span"
              data-popup-text
              id={word.id + 'popup'}
              style={popupTextStyle}
            >
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>Pinyin:</Typography>
              <Typography variant="body2">{word.pinyin}</Typography>
              <Typography variant="subtitle2" sx={{ m: 0, fontWeight: 'bold' }}>Meaning:</Typography>
              <Typography variant="body2">{word.meaning.split('/').join(' / ')}</Typography>
              {addedWords.filter((addedWord) => addedWord.id === word.id).length > 0 ? (
                <Button disabled>Added!</Button>
              ) : (
                <Button clicked={() => onPostWord(word as Word)}>
                  Add to bank
                </Button>
              )}
            </Box>
          </Box>
        );
      }
    });

    if (state.useSound && !state.showText) {
      sentenceWords = (
        <PictureButton
          colour="grey"
          src={speakerPic}
          clicked={() => onSpeakPinyin(currentSentence.chinese.sentence)}
        />
      );
    }
  }

  const showHide = state.useSound ? (
    <Button clicked={onToggleText}>{state.showText ? 'Hide' : 'Show'} Text</Button>
  ) : null;

  const micButton = state.useEnglishSpeechRecognition ? (
    <>
      <Typography>{state.message}</Typography>
      <PictureButton colour="yellow" src={micPic} clicked={onListenPinyin} />
    </>
  ) : null;

  let content: React.ReactNode = (
    <>
      <Input
        id="answerInput"
        changed={onInputChanged}
        keyPressed={onKeyPressed}
        autoComplete="off"
        value={state.entered}
        style={{ width: '100%', margin: '16px auto' }}
      />
      {micButton}
      <br />
      <Button clicked={() => onChangeSentence(-1)} disabled={state.sentenceIndex < 1}>
        Previous Sentence
      </Button>
      <Button
        clicked={() => onChangeSentence(1)}
        disabled={state.sentenceLoading || state.sentenceIndex >= state.totalCount - 1}
      >
        {state.sentenceLoading ? 'Loading...' : 'Next Sentence'}
      </Button>
      {showHide}
    </>
  );

  let buttons: React.ReactNode = null;

  if (state.submitted) {
    const currentSentence = state.sentences[state.sentenceIndex];
    let translation: React.ReactNode = currentSentence.english.sentence;

    if (currentSentence.english.highlight.length > 0) {
      const translationText = currentSentence.english.sentence;
      const wordStart = currentSentence.english.highlight[0][0];
      const wordEnd = currentSentence.english.highlight[0][1];
      const beforeWord = translationText.slice(0, wordStart);
      const word = translationText.slice(wordStart, wordEnd);
      const afterWord = translationText.slice(wordEnd, translationText.length);
      translation = (
        <Typography>
          {beforeWord}
          <span>{word}</span>
          {afterWord}
        </Typography>
      );
    }

    content = (
      <>
        <Typography variant="h5" component="h2">Your Translation:</Typography>
        <Paper
          sx={{
            width: '70%',
            bgcolor: 'secondary.main',
            boxShadow: '0 1px 4px black',
            color: 'rgb(46, 66, 66)',
            borderRadius: 1,
            mx: 'auto',
            mb: '10px',
            p: '10px 5px',
            fontSize: '1em',
            minHeight: 0,
          }}
        >
          <Typography>{state.entered}</Typography>
        </Paper>
        <Typography variant="h5" component="h2">Correct Translation:</Typography>
        <Paper
          sx={{
            width: '70%',
            bgcolor: 'secondary.main',
            boxShadow: '0 1px 4px black',
            color: 'rgb(46, 66, 66)',
            borderRadius: 1,
            mx: 'auto',
            mb: '10px',
            p: '10px 5px',
            fontSize: '1em',
            minHeight: 0,
          }}
        >
          {translation}
        </Paper>
      </>
    );

    const buttonStyle = {
      display: 'inline-block',
      width: '50px',
      height: '50px',
      margin: '10px 20px',
    };

    buttons = (
      <div>
        <PictureButton style={buttonStyle} clicked={onYesClicked} src={likePic} />
        <PictureButton style={buttonStyle} clicked={onNoClicked} src={dislikePic} />
      </div>
    );
  }

  return (
    <Box
      sx={{
        width: '90%',
        maxWidth: 400,
        textAlign: 'center',
        mx: 'auto',
        py: '30px',
        color: 'secondary.main',
        '& p': { fontSize: '1.1em' },
        '& h2': { fontWeight: 300, fontSize: '1.5em', m: '10px' },
        '& h3': { fontWeight: 300, fontSize: '1.5em', m: '2px auto' },
      }}
    >
      <Typography variant="h5" component="h2">Try to translate...</Typography>
      <Paper
        sx={{
          width: '70%',
          bgcolor: 'secondary.main',
          boxShadow: '0 1px 4px black',
          color: 'rgb(46, 66, 66)',
          borderRadius: 1,
          minHeight: 100,
          mx: 'auto',
          mb: '10px',
          p: '10px 5px',
          fontSize: '1.6em',
        }}
      >
        {sentenceWords}
      </Paper>
      {content}
      {buttons}
    </Box>
  );
};

export default withRouter(connector(SentenceRead));
