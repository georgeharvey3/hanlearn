import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Howl } from 'howler';

import Button from '../../UI/Buttons/Button/Button';
import Input from '../../UI/Input/Input';
import Aux from '../../../hoc/Aux';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Spinner from '../../UI/Spinner/Spinner';

import likePic from '../../../assets/images/like.png';
import dislikePic from '../../../assets/images/dislike.png';
import speakerPic from '../../../assets/images/speaker.png';
import micPic from '../../../assets/images/microphone.png';

import classes from './SentenceRead.module.css';

import successSound from '../../../assets/sounds/success1.wav';
import failSound from '../../../assets/sounds/failure1.wav';

import * as wordActions from '../../../store/actions/index';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { AppDispatch } from '../../../types/actions';

const beep = new Howl({ src: [successSound], volume: 0.5 });
const fail = new Howl({ src: [failSound], volume: 0.7 });

interface SentenceWord {
  id?: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

interface Sentence {
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

interface SentenceReadState {
  sentences: Sentence[];
  charSet: 'simp' | 'trad';
  sentenceIndex: number;
  wordIndex: number;
  submitted: boolean;
  entered: string;
  loading: boolean;
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
  token: state.auth.token,
  addedWords: state.addWords.words,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onPostWord: (token: string, word: Word) => dispatch(wordActions.postWord(token, word)),
});

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  words: Word[];
  isDemo?: boolean;
  sentenceWriteEnabled?: boolean;
  startSentenceWrite?: () => void;
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const SentenceRead: React.FC<Props> = ({
  synthAvailable,
  voice,
  lang,
  token,
  addedWords,
  onPostWord,
  words,
  isDemo,
  sentenceWriteEnabled,
  startSentenceWrite,
  history,
}) => {
  const [state, setState] = useState<SentenceReadState>({
    sentences: [],
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    sentenceIndex: 0,
    wordIndex: 0,
    submitted: false,
    entered: '',
    loading: false,
    useSound: true,
    useEnglishSpeechRecognition: false,
    showText: false,
    openPopup: '',
    message: '',
    recognition: null,
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceReadState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const initialiseSettings = useCallback((): void => {
    const useSound =
      synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(isDemo));
    const useEnglishSpeechRecognition =
      synthAvailable &&
      (!(localStorage.getItem('useEnglishSpeechRecognition') === 'false') ||
        Boolean(isDemo));

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
      startSentenceWrite?.();
    } else {
      history.push('/');
    }
  }, [history, sentenceWriteEnabled, startSentenceWrite]);

  const getSentences = useCallback((): void => {
    updateState({ loading: true });
    const currentWord = words[stateRef.current.wordIndex][stateRef.current.charSet];
    fetch(`/api/get-sentences/${currentWord}`)
      .then((response) =>
        response.json().then((data: { sentences: Sentence[] }) => {
          const shortSentences = data.sentences.filter(
            (sentence) => sentence.chinese.sentence.length <= 18
          );

          if (shortSentences.length) {
            updateState({ sentences: shortSentences, loading: false });
            if (stateRef.current.useSound) {
              onSpeakPinyin(shortSentences[stateRef.current.sentenceIndex].chinese.sentence);
            }
          } else {
            if (stateRef.current.wordIndex >= words.length - 1) {
              onEndStage();
            } else {
              setState((prevState) => ({ ...prevState, wordIndex: prevState.wordIndex + 1 }));
            }
          }
        })
      )
      .catch((error) => console.log(error));
  }, [onEndStage, onSpeakPinyin, updateState, words]);

  const onChangeSentence = (direction: number): void => {
    setState((prevState) => ({
      ...prevState,
      sentenceIndex: prevState.sentenceIndex + direction,
      showText: false,
    }));
  };

  const onYesClicked = (): void => {
    if (stateRef.current.useSound) beep.play();

    if (stateRef.current.wordIndex >= words.length - 1) {
      onEndStage();
    } else {
      setState((prevState) => ({
        ...prevState,
        wordIndex: prevState.wordIndex + 1,
        sentenceIndex: 0,
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
        stateRef.current.sentenceIndex < stateRef.current.sentences.length - 1
      ) {
        onChangeSentence(1);
      }
    },
    [onNoClicked, onYesClicked]
  );

  const onToggleText = (): void => {
    setState((prevState) => ({ ...prevState, showText: !prevState.showText }));
  };

  const onShowPopup = (id: string, word: string): void => {
    const vocabs = document.getElementsByClassName(classes.popuptext);
    const popup = document.getElementById(id);

    if (popup && !popup.classList.contains(classes.show)) {
      for (let i = 0; i < vocabs.length; i++) {
        vocabs[i].classList.remove(classes.show);
      }
      if (stateRef.current.useSound) onSpeakPinyin(word);
    }

    popup?.classList.toggle(classes.show);
    updateState({ openPopup: id });
  };

  const closePopup = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (
      stateRef.current.openPopup !== '' &&
      !target.classList.contains(classes.popup) &&
      !(
        target.parentElement?.classList.contains(classes.popuptext) ||
        target.classList.contains(classes.popuptext)
      )
    ) {
      Array.from(document.getElementsByClassName(classes.show)).forEach((element) => {
        element.classList.remove(classes.show);
      });
    }
  };

  useEffect(() => {
    getSentences();
    initialiseSettings();
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', closePopup);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('click', closePopup);
    };
  }, [getSentences, initialiseSettings, onKeyUp]);

  const prevIndices = useRef({ wordIndex: state.wordIndex, sentenceIndex: state.sentenceIndex });
  useEffect(() => {
    if (prevIndices.current.wordIndex !== state.wordIndex) {
      getSentences();
    } else if (prevIndices.current.sentenceIndex !== state.sentenceIndex) {
      if (state.useSound && state.sentences[state.sentenceIndex]) {
        onSpeakPinyin(state.sentences[state.sentenceIndex].chinese.sentence);
      }
    }
    prevIndices.current = { wordIndex: state.wordIndex, sentenceIndex: state.sentenceIndex };
  }, [getSentences, onSpeakPinyin, state.sentenceIndex, state.sentences, state.useSound, state.wordIndex]);

  let sentenceWords: React.ReactNode = <Spinner />;

  if (state.sentences.length > 0 && !state.loading) {
    const currentSentence = state.sentences[state.sentenceIndex];
    const sentenceText = currentSentence.chinese.sentence;
    const wordStart = currentSentence.chinese.highlight[0]?.[0] || 0;
    const wordEnd = currentSentence.chinese.highlight[0]?.[1] || 0;
    const chosenWord = sentenceText.slice(wordStart, wordEnd);

    sentenceWords = currentSentence.chinese.words.map((word, index) => {
      if (typeof word === 'string') {
        if (word === chosenWord) {
          return (
            <span key={index} className={classes.ChosenWord}>
              {word}
            </span>
          );
        }
        return word;
      } else {
        if (word[state.charSet] === chosenWord) {
          return (
            <span key={index} className={classes.ChosenWord}>
              {word[state.charSet]}
            </span>
          );
        }
        return (
          <span
            className={classes.popup}
            onClick={(event) => {
              if ((event.target as HTMLElement).classList.contains(classes.popup)) {
                onShowPopup(word.id + 'popup', word[state.charSet]);
              }
            }}
            key={index}
          >
            {word[state.charSet]}
            <span className={classes.popuptext} id={word.id + 'popup'}>
              <h5>Pinyin:</h5>
              <p>{word.pinyin}</p>
              <h5>Meaning:</h5>
              <p>{word.meaning.split('/').join(' / ')}</p>
              {addedWords.filter((addedWord) => addedWord.id === word.id).length > 0 ? (
                <Button disabled>Added!</Button>
              ) : (
                <Button clicked={() => onPostWord(token || '', word as Word)}>
                  Add to bank
                </Button>
              )}
            </span>
          </span>
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
    <Aux>
      <p>{state.message}</p>
      <PictureButton colour="yellow" src={micPic} clicked={onListenPinyin} />
    </Aux>
  ) : null;

  let content: React.ReactNode = (
    <Aux>
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
        disabled={state.sentenceIndex > state.sentences.length - 2}
      >
        Next Sentence
      </Button>
      {showHide}
    </Aux>
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
        <p>
          {beforeWord}
          <span>{word}</span>
          {afterWord}
        </p>
      );
    }

    content = (
      <Aux>
        <h2>Your Translation:</h2>
        <div className={classes.QuestionCard} style={{ fontSize: '1em', minHeight: '0' }}>
          <p>{state.entered}</p>
        </div>
        <h2>Correct Translation:</h2>
        <div className={classes.QuestionCard} style={{ fontSize: '1em', minHeight: '0' }}>
          {translation}
        </div>
      </Aux>
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
    <div className={classes.SentenceRead}>
      <h2>Try to translate...</h2>
      <div className={classes.QuestionCard}>{sentenceWords}</div>
      {content}
      {buttons}
    </div>
  );
};

export default withRouter(connector(SentenceRead));
