import React, { Component, ChangeEvent, KeyboardEvent } from 'react';
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

class SentenceRead extends Component<Props, SentenceReadState> {
  state: SentenceReadState = {
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
  };

  componentDidMount = (): void => {
    this.getSentences();
    this.initialiseSettings();
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('click', this.closePopup);
  };

  componentDidUpdate = (_: Props, prevState: SentenceReadState): void => {
    if (prevState.wordIndex !== this.state.wordIndex) {
      this.getSentences();
    } else if (prevState.sentenceIndex !== this.state.sentenceIndex) {
      if (this.state.useSound && this.state.sentences[this.state.sentenceIndex]) {
        this.onSpeakPinyin(this.state.sentences[this.state.sentenceIndex].chinese.sentence);
      }
    }
  };

  componentWillUnmount = (): void => {
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('click', this.closePopup);
  };

  initialiseSettings = (): void => {
    const useSound =
      this.props.synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(this.props.isDemo));
    const useEnglishSpeechRecognition =
      this.props.synthAvailable &&
      (!(localStorage.getItem('useEnglishSpeechRecognition') === 'false') || Boolean(this.props.isDemo));

    this.setState({ useSound, useEnglishSpeechRecognition });
  };

  onSpeakPinyin = (sentence: string): void => {
    this.state.recognition?.abort();
    window.speechSynthesis.cancel();

    const synth = window.speechSynthesis;
    const utterThis = new SpeechSynthesisUtterance(sentence);
    utterThis.lang = this.props.lang || 'zh-CN';
    if (this.props.voice) utterThis.voice = this.props.voice;
    synth.cancel();
    synth.speak(utterThis);
  };

  onListenPinyin = (): void => {
    this.state.recognition?.abort();
    window.speechSynthesis.cancel();

    const recognition = new window.webkitSpeechRecognition();
    this.setState({ recognition, message: '' });

    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      result = event.results[0][0].transcript;
      this.setState({ entered: result, message: '' });
      document.getElementById('answerInput')?.focus();
    });

    recognition.addEventListener('end', () => {
      if (!result) this.setState({ message: "Couldn't hear anything..." });
    });

    recognition.addEventListener('audiostart', () => {
      this.setState({ message: 'Listening...' });
    });

    recognition.start();
  };

  getSentences = (): void => {
    this.setState({ loading: true });
    const word = this.props.words[this.state.wordIndex][this.state.charSet];
    fetch(`/api/get-sentences/${word}`)
      .then((response) =>
        response.json().then((data: { sentences: Sentence[] }) => {
          const shortSentences = data.sentences.filter(
            (sentence) => sentence.chinese.sentence.length <= 18
          );

          if (shortSentences.length) {
            this.setState({ sentences: shortSentences, loading: false });
            if (this.state.useSound) {
              this.onSpeakPinyin(shortSentences[this.state.sentenceIndex].chinese.sentence);
            }
          } else {
            if (this.state.wordIndex >= this.props.words.length - 1) {
              this.onEndStage();
            } else {
              this.setState((prevState) => ({ wordIndex: prevState.wordIndex + 1 }));
            }
          }
        })
      )
      .catch((error) => console.log(error));
  };

  onChangeSentence = (direction: number): void => {
    this.setState((prevState) => ({
      sentenceIndex: prevState.sentenceIndex + direction,
      showText: false,
    }));
  };

  onEndStage = (): void => {
    if (this.props.sentenceWriteEnabled) {
      this.props.startSentenceWrite?.();
    } else {
      this.props.history.push('/');
    }
  };

  onYesClicked = (): void => {
    if (this.state.useSound) beep.play();

    if (this.state.wordIndex >= this.props.words.length - 1) {
      this.onEndStage();
    } else {
      this.setState((prevState) => ({
        wordIndex: prevState.wordIndex + 1,
        sentenceIndex: 0,
        submitted: false,
        entered: '',
        showText: false,
      }));
    }
  };

  onNoClicked = (): void => {
    if (this.state.useSound) fail.play();
    this.setState({ entered: '', submitted: false });
  };

  onInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    this.setState({ entered: event.target.value });
  };

  onKeyPressed = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || this.state.entered === '') return;
    this.setState({ submitted: true });
  };

  onKeyUp = (event: globalThis.KeyboardEvent): void => {
    if ((event.target as HTMLElement).tagName.toLowerCase() === 'input') return;

    if (event.ctrlKey && event.key === 'b') {
      document.getElementById('answerInput')?.focus();
    }

    if (event.key === 'ArrowUp' && this.state.submitted) {
      this.onYesClicked();
    }

    if (event.key === 'ArrowDown' && this.state.submitted) {
      this.onNoClicked();
    }

    if (event.key === 'ArrowLeft' && !this.state.submitted && this.state.sentenceIndex > 0) {
      this.onChangeSentence(-1);
    }

    if (
      event.key === 'ArrowRight' &&
      !this.state.submitted &&
      this.state.sentenceIndex < this.state.sentences.length - 1
    ) {
      this.onChangeSentence(1);
    }
  };

  onToggleText = (): void => {
    this.setState((prevState) => ({ showText: !prevState.showText }));
  };

  onShowPopup = (id: string, word: string): void => {
    const vocabs = document.getElementsByClassName(classes.popuptext);
    const popup = document.getElementById(id);

    if (popup && !popup.classList.contains(classes.show)) {
      for (let i = 0; i < vocabs.length; i++) {
        vocabs[i].classList.remove(classes.show);
      }
      if (this.state.useSound) this.onSpeakPinyin(word);
    }

    popup?.classList.toggle(classes.show);
    this.setState({ openPopup: id });
  };

  closePopup = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (
      this.state.openPopup !== '' &&
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

  render(): React.ReactNode {
    let sentenceWords: React.ReactNode = <Spinner />;

    if (this.state.sentences.length > 0 && !this.state.loading) {
      const currentSentence = this.state.sentences[this.state.sentenceIndex];
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
          if (word[this.state.charSet] === chosenWord) {
            return (
              <span key={index} className={classes.ChosenWord}>
                {word[this.state.charSet]}
              </span>
            );
          }
          return (
            <span
              className={classes.popup}
              onClick={(event) => {
                if ((event.target as HTMLElement).classList.contains(classes.popup)) {
                  this.onShowPopup(word.id + 'popup', word[this.state.charSet]);
                }
              }}
              key={index}
            >
              {word[this.state.charSet]}
              <span className={classes.popuptext} id={word.id + 'popup'}>
                <h5>Pinyin:</h5>
                <p>{word.pinyin}</p>
                <h5>Meaning:</h5>
                <p>{word.meaning.split('/').join(' / ')}</p>
                {this.props.addedWords.filter((addedWord) => addedWord.id === word.id).length > 0 ? (
                  <Button disabled>Added!</Button>
                ) : (
                  <Button
                    clicked={() =>
                      this.props.onPostWord(this.props.token || '', word as Word)
                    }
                  >
                    Add to bank
                  </Button>
                )}
              </span>
            </span>
          );
        }
      });

      if (this.state.useSound && !this.state.showText) {
        sentenceWords = (
          <PictureButton
            colour="grey"
            src={speakerPic}
            clicked={() => this.onSpeakPinyin(currentSentence.chinese.sentence)}
          />
        );
      }
    }

    const showHide = this.state.useSound ? (
      <Button clicked={this.onToggleText}>{this.state.showText ? 'Hide' : 'Show'} Text</Button>
    ) : null;

    const micButton = this.state.useEnglishSpeechRecognition ? (
      <Aux>
        <p>{this.state.message}</p>
        <PictureButton colour="yellow" src={micPic} clicked={this.onListenPinyin} />
      </Aux>
    ) : null;

    let content: React.ReactNode = (
      <Aux>
        <Input
          id="answerInput"
          changed={this.onInputChanged}
          keyPressed={this.onKeyPressed}
          autoComplete="off"
          value={this.state.entered}
          style={{ width: '100%', margin: '16px auto' }}
        />
        {micButton}
        <br />
        <Button clicked={() => this.onChangeSentence(-1)} disabled={this.state.sentenceIndex < 1}>
          Previous Sentence
        </Button>
        <Button
          clicked={() => this.onChangeSentence(1)}
          disabled={this.state.sentenceIndex > this.state.sentences.length - 2}
        >
          Next Sentence
        </Button>
        {showHide}
      </Aux>
    );

    let buttons: React.ReactNode = null;

    if (this.state.submitted) {
      const currentSentence = this.state.sentences[this.state.sentenceIndex];
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
            <p>{this.state.entered}</p>
          </div>
          <h2>Correct Translation:</h2>
          <div className={classes.QuestionCard} style={{ fontSize: '1em', minHeight: '0' }}>
            {translation}
          </div>
        </Aux>
      );

      const buttonStyle = { display: 'inline-block', width: '50px', height: '50px', margin: '10px 20px' };

      buttons = (
        <div>
          <PictureButton style={buttonStyle} clicked={this.onYesClicked} src={likePic} />
          <PictureButton style={buttonStyle} clicked={this.onNoClicked} src={dislikePic} />
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
  }
}

export default withRouter(connector(SentenceRead));
