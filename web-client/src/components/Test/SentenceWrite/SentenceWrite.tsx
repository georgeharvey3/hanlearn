import React, { Component, ChangeEvent, KeyboardEvent } from 'react';
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

import pinyin from 'pinyin';

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

class SentenceWrite extends Component<Props, SentenceWriteState> {
  state: SentenceWriteState = {
    currentWord: null,
    wordIndex: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    useChineseSpeechRecognition:
      localStorage.getItem('useChineseSpeechRecognition') === 'false' || !this.props.speechAvailable
        ? false
        : true,
    useSound:
      localStorage.getItem('useSound') === 'false' || !this.props.synthAvailable ? false : true,
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
  };

  componentDidMount = (): void => {
    document.addEventListener('keyup', this.onKeyUp);
  };

  componentWillUnmount = (): void => {
    document.removeEventListener('keyup', this.onKeyUp);
  };

  onKeyUp = (event: globalThis.KeyboardEvent): void => {
    const sourceElement = (event.target as HTMLElement).tagName.toLowerCase();
    const finished = this.state.usedWords.length === this.props.words.length;

    if (event.key === ' ') {
      if (finished) {
        event.preventDefault();
        this.onHomeClicked();
      } else if (sourceElement !== 'input') {
        this.onListenPinyin();
      }
    }

    if (event.ctrlKey && event.key === 'm') {
      if (!finished) this.onListenPinyin();
    }

    if (event.ctrlKey && event.key === 'b') {
      document.getElementById('answerInput')?.focus();
    }

    if (event.key === 'ArrowUp' && this.state.sentence !== null) {
      this.onYesClicked();
    }

    if (event.key === 'ArrowDown' && this.state.sentence !== null) {
      this.onNoClicked();
    }
  };

  onInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    const sentence = (event.target as HTMLInputElement).value;

    let containsWord = false;
    this.props.words.forEach((word) => {
      if (sentence.includes(word[this.state.charSet])) containsWord = true;
    });

    if (containsWord) {
      this.setState({ error: false, errorMessage: '', message: 'Translating...' });
      document.getElementById('answerInput')?.blur();
      this.translateSentence(sentence);
    } else {
      this.setState({ error: true, errorMessage: 'Sentence does not contain word!' });
    }
  };

  translateSentence = (sentence: string): void => {
    const apiKey = '95b7061f-d806-ef5b-3fd1-c3ea287ce9fb:fx';
    fetch(
      `https://api-free.deepl.com/v2/translate?auth_key=${apiKey}&text=${sentence}&target_lang=EN`
    )
      .then((res) =>
        res.json().then((data: { translations: { text: string }[] }) => {
          this.setState({
            sentence: data.translations[0].text,
            chineseSentence: sentence,
            message: 'Translation:',
          });
        })
      )
      .catch((e) => console.error(e));
  };

  translateEnglishWord = (sentence: string): void => {
    const apiKey = '95b7061f-d806-ef5b-3fd1-c3ea287ce9fb:fx';
    fetch(
      `https://api-free.deepl.com/v2/translate?auth_key=${apiKey}&text=${sentence}&target_lang=ZH`
    )
      .then((res) =>
        res.json().then((data: { translations: { text: string }[] }) => {
          this.setState({
            translatedEnglish: data.translations[0].text,
            englishTranslationLoading: false,
          });
        })
      )
      .catch((e) => console.error(e));
  };

  onNoClicked = (): void => {
    if (this.state.useSound) fail.play();
    this.setState({ sentence: null, chineseSentence: null, entered: '', message: 'Try again' });
  };

  onYesClicked = (): void => {
    if (this.state.useSound) beep.play();

    const foundWords = this.props.words.filter((word) =>
      this.state.chineseSentence?.includes(word[this.state.charSet])
    );

    this.setState((prevState) => ({
      sentence: null,
      chineseSentence: null,
      entered: '',
      enteredEnglish: '',
      translatedEnglish: '',
      message: '',
      sentences: prevState.sentences.concat(prevState.chineseSentence || ''),
      usedWords: prevState.usedWords.concat(foundWords),
    }));
  };

  onInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    this.setState({ entered: event.target.value, error: false, errorMessage: '' });
  };

  onEnglishInputChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    this.setState({ enteredEnglish: event.target.value });
  };

  onEnglishInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    this.setState({ englishTranslationLoading: true });
    this.translateEnglishWord(this.state.enteredEnglish);
  };

  onListenPinyin = (): void => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';

    this.setState({ error: false, errorMessage: '' });

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

  onHomeClicked = (): void => {
    this.props.history.push('/');
  };

  findHighlights = (
    string: string,
    words: string[]
  ): { type: 'high' | 'low'; light: [number, number] }[] => {
    const filteredWords = words.filter((word) => string.includes(word));
    const orderedWords = [...filteredWords].sort(
      (a, b) => string.indexOf(a) - string.indexOf(b)
    );

    const highlights = orderedWords.reduce(
      (acc: { type: 'high' | 'low'; light: [number, number] }[], word, index, arr) => {
        const previousWord = index > 0 ? arr[index - 1] : null;
        const previousStart = previousWord ? string.indexOf(previousWord) : null;
        const previousHighlight: [number, number] | null = previousStart !== null && previousWord
          ? [previousStart, previousStart + previousWord.length]
          : null;
        const start = previousHighlight ? previousHighlight[1] : 0;

        const thisStart = string.indexOf(word);
        const thisHighlight: [number, number] = [thisStart, thisStart + word.length];

        let addition: { type: 'high' | 'low'; light: [number, number] }[] = [
          { type: 'low', light: [start, thisStart] },
          { type: 'high', light: thisHighlight },
        ];

        if (index === arr.length - 1) {
          addition = [...addition, { type: 'low', light: [thisHighlight[1], string.length] }];
        }

        return [...acc, ...addition];
      },
      []
    );

    return highlights.filter((h) => h.light[1] - h.light[0] > 0);
  };

  createElement = (string: string, words: string[], index: number): React.ReactNode => {
    const highlights = this.findHighlights(string, words);
    const elements = highlights.map((highlight, i) => {
      const text = string.slice(highlight.light[0], highlight.light[1]);
      const className = highlight.type === 'high' ? classes.Highlighted : classes.Lowlighted;
      return highlight.type === 'high' ? (
        <span key={i} className={className}>
          {text}
        </span>
      ) : (
        text
      );
    });

    return <p key={index}>{elements}</p>;
  };

  render(): React.ReactNode {
    let sentence: React.ReactNode = null;
    const sentenceText = this.state.sentence === null ? null : <h3>"{this.state.sentence}"</h3>;

    if (this.state.usedWords.length < this.props.words.length) {
      const micButton = this.props.speechAvailable ? (
        <PictureButton colour="yellow" src={micPic} clicked={this.onListenPinyin} />
      ) : null;

      const unusedWords = this.props.words.filter((word) => !this.state.usedWords.includes(word));
      const words = unusedWords.map((word) => (
        <li key={word[this.state.charSet]}>{word[this.state.charSet]}</li>
      ));

      sentence = (
        <div>
          <h2>Create a sentence using...</h2>
          <ul className={classes.WordList}>{words}</ul>
          <input
            autoComplete="off"
            onKeyPress={this.onInputKeyPress}
            value={this.state.entered}
            onChange={this.onInputChanged}
            id="answerInput"
          />
          {micButton}
          <p>{this.state.message}</p>
          {sentenceText}
        </div>
      );
    }

    let buttons: React.ReactNode = null;
    let errorMessage: React.ReactNode = null;

    if (this.state.error) {
      errorMessage = <p>{this.state.errorMessage}</p>;
    }

    if (this.state.sentence !== null) {
      const buttonStyle = { display: 'inline-block', width: '50px', height: '50px', margin: '10px 20px' };
      buttons = (
        <div>
          <PictureButton style={buttonStyle} clicked={this.onYesClicked} src={likePic} />
          <PictureButton style={buttonStyle} clicked={this.onNoClicked} src={dislikePic} />
        </div>
      );
    }

    let englishTranslatedMessage: React.ReactNode = null;

    if (this.state.englishTranslationLoading) {
      englishTranslatedMessage = <h4>Translating...</h4>;
    } else if (this.state.translatedEnglish) {
      const asPinyin = pinyin(this.state.translatedEnglish, { style: pinyin.STYLE_TONE2 });
      englishTranslatedMessage = (
        <Aux>
          <h4>Translation:</h4>
          <p>{this.state.translatedEnglish}</p>
          <p>{asPinyin.map((p) => p.join('')).join(' ')}</p>
        </Aux>
      );
    }

    return (
      <Aux>
        <div className={classes.SentenceWrite}>
          {sentence}
          {errorMessage}
          {buttons}
          <h3>English Translator:</h3>
          <input
            value={this.state.enteredEnglish}
            onChange={this.onEnglishInputChanged}
            onKeyPress={this.onEnglishInputKeyPress}
          />
          {englishTranslatedMessage}
        </div>
        <Modal show={this.state.usedWords.length === this.props.words.length}>
          <h3>Finished!</h3>
          <Table headings={['Your sentences:']}>
            {this.state.sentences.map((sent, index) => {
              const words = this.props.words.map((word) => word[this.state.charSet]);
              const elem = this.createElement(sent, words, index);
              return <TableRow key={index}>{[elem]}</TableRow>;
            })}
          </Table>
          <Button clicked={this.onHomeClicked}>Home</Button>
        </Modal>
      </Aux>
    );
  }
}

export default withRouter(connector(SentenceWrite));
