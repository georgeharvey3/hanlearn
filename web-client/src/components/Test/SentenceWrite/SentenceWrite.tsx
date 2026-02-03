import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Howl } from 'howler';

import Button from '../../UI/Buttons/Button/Button';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Aux from '../../../hoc/Aux';
import Modal from '../../UI/Modal/Modal';
import Table from '../../UI/Table/Table';
import TableRow from '../../UI/Table/TableRow/TableRow';

import micPic from '../../../assets/images/microphone.png';
import likePic from '../../../assets/images/like.png';
import dislikePic from '../../../assets/images/dislike.png';

import classes from './SentenceWrite.module.css';

import successSound from '../../../assets/sounds/success1.wav';
import failSound from '../../../assets/sounds/failure1.wav';

import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';

import pinyin from 'pinyin';

// Cloud Function for translation (API key stored server-side)
const translateWithDeepL = httpsCallable<
  { text: string; targetLang: string },
  { translations: { text: string }[] }
>(functions, 'translateWithDeepL');

const beep = new Howl({ src: [successSound], volume: 0.5 });
const fail = new Howl({ src: [failSound], volume: 0.7 });

interface SentenceWriteState {
  currentWord: Word | null;
  wordIndex: number;
  charSet: 'simp' | 'trad';
  useChineseSpeechRecognition: boolean;
  useSound: boolean;
  finished: boolean;
  sentence: string | null;
  chineseSentence: string | null;
  entered: string;
  enteredEnglish: string;
  error: boolean;
  errorMessage: string;
  message: string;
  sentences: string[];
  usedWords: Word[];
  translatedEnglish: string;
  lastEnteredEnglish: string;
  englishTranslationLoading: boolean;
}

const mapStateToProps = (state: RootState) => ({
  speechAvailable: state.settings.speechAvailable,
  synthAvailable: state.settings.synthAvailable,
});

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  words: Word[];
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const SentenceWrite: React.FC<Props> = ({
  speechAvailable,
  synthAvailable,
  words,
  history,
}) => {
  const [state, setState] = useState<SentenceWriteState>(() => ({
    currentWord: null,
    wordIndex: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    useChineseSpeechRecognition:
      localStorage.getItem('useChineseSpeechRecognition') === 'false' || !speechAvailable
        ? false
        : true,
    useSound: localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true,
    finished: false,
    sentence: null,
    chineseSentence: null,
    entered: '',
    enteredEnglish: '',
    error: false,
    errorMessage: '',
    message: '',
    sentences: [],
    usedWords: [],
    translatedEnglish: '',
    lastEnteredEnglish: '',
    englishTranslationLoading: false,
  }));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceWriteState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const onHomeClicked = useCallback((): void => {
    history.push('/');
  }, [history]);

  const onListenPinyin = useCallback((): void => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';

    updateState({ error: false, errorMessage: '' });

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

  const translateSentence = useCallback(
    async (sentence: string): Promise<void> => {
      try {
        const result = await translateWithDeepL({ text: sentence, targetLang: 'EN' });
        updateState({
          sentence: result.data.translations[0].text,
          chineseSentence: sentence,
          message: 'Translation:',
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    },
    [updateState]
  );

  const translateEnglishWord = useCallback(
    async (sentence: string): Promise<void> => {
      try {
        const result = await translateWithDeepL({ text: sentence, targetLang: 'ZH' });
        updateState({
          translatedEnglish: result.data.translations[0].text,
          englishTranslationLoading: false,
        });
      } catch (error) {
        console.error('Translation error:', error);
        updateState({ englishTranslationLoading: false });
      }
    },
    [updateState]
  );

  const onNoClicked = useCallback((): void => {
    if (stateRef.current.useSound) fail.play();
    updateState({ sentence: null, chineseSentence: null, entered: '', message: 'Try again' });
  }, [updateState]);

  const onYesClicked = useCallback((): void => {
    if (stateRef.current.useSound) beep.play();

    const foundWords = words.filter((word) =>
      stateRef.current.chineseSentence?.includes(word[stateRef.current.charSet])
    );

    setState((prevState) => ({
      ...prevState,
      sentence: null,
      chineseSentence: null,
      entered: '',
      enteredEnglish: '',
      translatedEnglish: '',
      message: '',
      sentences: prevState.sentences.concat(prevState.chineseSentence || ''),
      usedWords: prevState.usedWords.concat(foundWords),
    }));
  }, [words]);

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      const sourceElement = (event.target as HTMLElement).tagName.toLowerCase();
      const finished = stateRef.current.usedWords.length === words.length;

      if (event.key === ' ') {
        if (finished) {
          event.preventDefault();
          onHomeClicked();
        } else if (sourceElement !== 'input') {
          onListenPinyin();
        }
      }

      if (event.ctrlKey && event.key === 'm') {
        if (!finished) onListenPinyin();
      }

      if (event.ctrlKey && event.key === 'b') {
        document.getElementById('answerInput')?.focus();
      }

      if (event.key === 'ArrowUp' && stateRef.current.sentence !== null) {
        onYesClicked();
      }

      if (event.key === 'ArrowDown' && stateRef.current.sentence !== null) {
        onNoClicked();
      }
    },
    [onHomeClicked, onListenPinyin, onNoClicked, onYesClicked, words.length]
  );

  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyUp]);

  const onInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    const sentence = (event.target as HTMLInputElement).value;

    let containsWord = false;
    words.forEach((word) => {
      if (sentence.includes(word[stateRef.current.charSet])) containsWord = true;
    });

    if (containsWord) {
      updateState({ error: false, errorMessage: '', message: 'Translating...' });
      document.getElementById('answerInput')?.blur();
      translateSentence(sentence);
    } else {
      updateState({ error: true, errorMessage: 'Sentence does not contain word!' });
    }
  };

  const onInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ entered: event.target.value, error: false, errorMessage: '' });
  };

  const onEnglishInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ enteredEnglish: event.target.value });
  };

  const onEnglishInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    updateState({ englishTranslationLoading: true });
    translateEnglishWord(stateRef.current.enteredEnglish);
  };

  const findHighlights = (
    string: string,
    wordsToHighlight: string[]
  ): { type: 'high' | 'low'; light: [number, number] }[] => {
    const filteredWords = wordsToHighlight.filter((word) => string.includes(word));
    const orderedWords = [...filteredWords].sort(
      (a, b) => string.indexOf(a) - string.indexOf(b)
    );

    const highlights = orderedWords.reduce(
      (acc: { type: 'high' | 'low'; light: [number, number] }[], word, index, arr) => {
        const previousWord = index > 0 ? arr[index - 1] : null;
        const previousStart = previousWord ? string.indexOf(previousWord) : null;
        const previousHighlight: [number, number] | null =
          previousStart !== null && previousWord
            ? [previousStart, previousStart + previousWord.length]
            : null;

        const wordStart = string.indexOf(word);
        const wordHighlight: [number, number] = [wordStart, wordStart + word.length];

        if (previousHighlight === null) {
          const low = [0, wordStart] as [number, number];
          acc.push({ type: 'low', light: low });
          acc.push({ type: 'high', light: wordHighlight });
          return acc;
        }

        const low = [previousHighlight[1], wordStart] as [number, number];
        acc.push({ type: 'low', light: low });
        acc.push({ type: 'high', light: wordHighlight });
        return acc;
      }, []
    );

    if (highlights.length > 0) {
      const last = highlights[highlights.length - 1].light;
      highlights.push({ type: 'low', light: [last[1], string.length] });
    }

    return highlights;
  };

  const getWordToTest = (): Word | null => {
    if (state.usedWords.length === words.length) return null;
    for (let i = 0; i < words.length; i++) {
      if (!state.usedWords.includes(words[i])) {
        return words[i];
      }
    }
    return null;
  };

  const getChineseSentence = (word: Word): string => {
    return word[state.charSet];
  };

  const currentWord = getWordToTest();

  let content: React.ReactNode = (
    <Aux>
      <h2>Write a sentence using:</h2>
      <h1>{currentWord ? getChineseSentence(currentWord) : ''}</h1>
      <input
        id="answerInput"
        className={classes.SentenceInput}
        autoComplete="off"
        onChange={onInputChanged}
        onKeyPress={onInputKeyPress}
        value={state.entered}
      />
      <br />
      {state.useChineseSpeechRecognition ? (
        <Aux>
          <p>{state.message}</p>
          <PictureButton colour="yellow" src={micPic} clicked={onListenPinyin} />
        </Aux>
      ) : null}
      <p>{state.errorMessage}</p>
      <h4>Translation</h4>
      <input
        className={classes.SentenceInput}
        autoComplete="off"
        onChange={onEnglishInputChanged}
        onKeyPress={onEnglishInputKeyPress}
        value={state.enteredEnglish}
      />
      {state.englishTranslationLoading ? <p>Translating...</p> : null}
      {state.translatedEnglish !== '' ? <p>{state.translatedEnglish}</p> : null}
    </Aux>
  );

  let buttons: React.ReactNode = null;

  if (state.sentence) {
    const buttonStyle = {
      display: 'inline-block',
      width: '50px',
      height: '50px',
      margin: '10px 20px',
    };

    content = (
      <Aux>
        <h2>{state.message}</h2>
        <p>{state.sentence}</p>
      </Aux>
    );

    buttons = (
      <div>
        <PictureButton style={buttonStyle} clicked={onYesClicked} src={likePic} />
        <PictureButton style={buttonStyle} clicked={onNoClicked} src={dislikePic} />
      </div>
    );
  }

  if (state.usedWords.length === words.length) {
    const headings = ['Sentence', 'Pinyin', 'Translation'];
    const highlights = findHighlights(state.sentences.join(' '), words.map((w) => w[state.charSet]));

    const rows = state.sentences.map((sentence, index) => {
      return (
        <TableRow key={index}>
          {[sentence, pinyin(sentence).join(' '), state.translatedEnglish]}
        </TableRow>
      );
    });

    return (
      <Modal show>
        <h2>Finished!</h2>
        <Table headings={headings}>{rows}</Table>
        <div className={classes.Highlights}>
          {highlights.map((light, index) => (
            <span
              key={index}
              className={light.type === 'high' ? classes.HighHighlight : classes.LowHighlight}
            >
              {state.sentences.join(' ').slice(light.light[0], light.light[1])}
            </span>
          ))}
        </div>
        <Button clicked={onHomeClicked}>Home</Button>
      </Modal>
    );
  }

  return (
    <div className={classes.SentenceWrite}>
      {content}
      {buttons}
    </div>
  );
};

export default withRouter(connector(SentenceWrite));
