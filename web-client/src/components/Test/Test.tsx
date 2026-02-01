import React, { Component } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { connect, ConnectedProps } from 'react-redux';
import { Howl } from 'howler';

import classes from './Test.module.css';

import * as testLogic from './Logic/TestLogic';
import Aux from '../../hoc/Aux';
import Modal from '../UI/Modal/Modal';
import Backdrop from '../UI/Backdrop/Backdrop';
import ProgressBar from './ProgressBar/ProgressBar';
import Input from '../UI/Input/Input';
import TestSummary from './TestSummary/TestSummary';
import PictureButton from '../UI/Buttons/PictureButton/PictureButton';
import Button from '../UI/Buttons/Button/Button';
import Toggle from '../UI/Toggle/Toggle';
import Spinner from '../UI/Spinner/Spinner';

import micPic from '../../assets/images/microphone.png';
import speakerPic from '../../assets/images/speaker.png';
import likePic from '../../assets/images/like.png';
import dislikePic from '../../assets/images/dislike.png';

import successSound from '../../assets/sounds/success1.wav';
import failSound from '../../assets/sounds/failure1.wav';

import { RootState } from '../../types/store';
import { Word, TestPerm, WordScore } from '../../types/models';

import pinyin from 'pinyin';

const beep = new Howl({
  src: [successSound],
  volume: 0.5,
});

const fail = new Howl({
  src: [failSound],
  volume: 0.7,
});

interface TestState {
  testSet: Word[];
  permList: TestPerm[];
  numWords: number;
  charSet: 'simp' | 'trad';
  perm: TestPerm | null;
  answer: string | string[] | null;
  answerCategory: string | null;
  question: string | string[] | null;
  questionCategory: string | null;
  chosenCharacter: string | null;
  result: string;
  answerInput: string;
  idkDisabled: boolean;
  submitDisabled: boolean;
  progressBar: number;
  initNumPerms: number;
  idkList: string[];
  scoreList: WordScore[];
  testFinished: boolean;
  showInput: boolean;
  showInputChars: string[];
  drawnCharacters: string[];
  numSpeakTries: number;
  useSound: boolean;
  useHandwriting: boolean;
  useChineseSpeechRecognition: boolean;
  useEnglishSpeechRecognition: boolean;
  useAutoRecord: boolean;
  useFlashcards: boolean;
  showErrorMessage: boolean;
  redoChar: boolean;
  sentenceWords: Word[];
  writer: HanziWriterInstance | null;
  qNum: number;
  recognition: SpeechRecognition | null;
  showPinyin: boolean;
  showHint: boolean;
  listening: boolean;
  priority: string;
  onlyPriority: boolean;
  showQuestionPinyin: boolean;
  hintLoading: boolean;
  showAnswer: boolean;
  yesClicked: boolean;
  noClicked: boolean;
  pauseAutoRecord: boolean;
  synthLoading: boolean;
  speechLoading: boolean;
  interaction: boolean;
  speechResult: boolean;
}

const mapStateToProps = (state: RootState) => {
  return {
    token: state.auth.token,
    speechAvailable: state.settings.speechAvailable,
    synthAvailable: state.settings.synthAvailable,
    voice: state.settings.voice,
    lang: state.settings.lang,
  };
};

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  words: Word[];
  isDemo?: boolean;
  finalStage?: boolean;
  startSentenceRead?: (words: Word[]) => void;
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

class Test extends Component<Props, TestState> {
  constructor(props: Props) {
    super(props);
    const numWords = parseInt(localStorage.getItem('numWords') || '5');
    const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
    const priority = localStorage.getItem('priority') || 'none';
    const onlyPriority = localStorage.getItem('onlyPriority') === 'true';

    this.state = {
      testSet: [],
      permList: [],
      numWords: numWords,
      charSet: charSet,
      perm: null,
      answer: null,
      answerCategory: null,
      question: null,
      questionCategory: null,
      chosenCharacter: null,
      result: '',
      answerInput: '',
      idkDisabled: false,
      submitDisabled: false,
      progressBar: 0,
      initNumPerms: 0,
      idkList: [],
      scoreList: [],
      testFinished: false,
      showInput: false,
      showInputChars: [],
      drawnCharacters: [],
      numSpeakTries: 0,
      useSound: true,
      useHandwriting: true,
      useChineseSpeechRecognition: true,
      useEnglishSpeechRecognition: true,
      useAutoRecord: false,
      useFlashcards: false,
      showErrorMessage: false,
      redoChar: false,
      sentenceWords: [],
      writer: null,
      qNum: 0,
      recognition: null,
      showPinyin: false,
      showHint: false,
      listening: false,
      priority: priority,
      onlyPriority: onlyPriority,
      showQuestionPinyin: false,
      hintLoading: false,
      showAnswer: false,
      yesClicked: false,
      noClicked: false,
      pauseAutoRecord: false,
      synthLoading: false,
      speechLoading: false,
      interaction: false,
      speechResult: false,
    };
  }

  componentDidMount(): void {
    this.initialiseSettings();
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mouseover', this.setInteraction);
    document.addEventListener('scroll', this.setInteraction);
    document.addEventListener('keydown', this.setInteraction);
  }

  componentWillUnmount = (): void => {
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mouseover', this.setInteraction);
    document.removeEventListener('scroll', this.setInteraction);
    document.removeEventListener('keydown', this.setInteraction);
    window.speechSynthesis.cancel();
  };

  componentDidUpdate = (_: Props, prevState: TestState): void => {
    if (prevState.qNum !== this.state.qNum) {
      window.speechSynthesis.cancel();
      this.setState({
        yesClicked: false,
        noClicked: false,
        showQuestionPinyin: false,
        pauseAutoRecord: false,
      });

      if (this.state.questionCategory === 'pinyin' && this.state.useSound && this.state.chosenCharacter) {
        this.onSpeak(this.state.chosenCharacter, this.state.useAutoRecord);
      }

      if (
        this.state.useAutoRecord &&
        !(this.state.questionCategory === 'pinyin' && this.state.useSound)
      ) {
        if (this.state.answerCategory === 'pinyin') {
          this.onListen();
        }
        if (this.state.answerCategory === 'meaning') {
          if (!this.state.useFlashcards) {
            this.onListen();
          }
        }
      }
      if (this.state.answerCategory === 'character' && typeof this.state.answer === 'string') {
        this.setHanziWriter(this.state.answer);
      }
    }
  };

  setInteraction = (): void => {
    this.setState({ interaction: true });
  };

  initialiseSettings(): void {
    const useSound =
      this.props.synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(this.props.isDemo));
    const useHandwriting =
      !(localStorage.getItem('useHandwriting') === 'false') || Boolean(this.props.isDemo);
    const useChineseSpeechRecognition =
      this.props.speechAvailable &&
      (!(localStorage.getItem('useChineseSpeechRecognition') === 'false') ||
        Boolean(this.props.isDemo));
    const useEnglishSpeechRecognition =
      this.props.speechAvailable &&
      (!(localStorage.getItem('useEnglishSpeechRecognition') === 'false') ||
        Boolean(this.props.isDemo));
    const useFlashcards =
      (this.props.speechAvailable &&
        !(localStorage.getItem('useFlashcards') === 'false')) ||
      Boolean(this.props.isDemo);

    this.setState({
      useSound,
      useHandwriting,
      useChineseSpeechRecognition,
      useEnglishSpeechRecognition,
      useFlashcards,
    });

    this.onInitialiseTestSet(useHandwriting);
  }

  onKeyUp = (event: KeyboardEvent): void => {
    const sourceElement = (event.target as HTMLElement).tagName.toLowerCase();
    const micAvailable =
      ((this.state.useChineseSpeechRecognition && this.state.answerCategory === 'pinyin') ||
        (this.state.useEnglishSpeechRecognition && this.state.answerCategory === 'meaning')) &&
      !this.state.listening &&
      !this.state.testFinished;

    const speakerAvailable =
      this.state.useSound &&
      this.state.questionCategory === 'pinyin' &&
      !this.state.testFinished &&
      !this.state.listening;

    if (event.ctrlKey && event.key === 'i') {
      if (!this.state.idkDisabled) {
        this.onIDontKnow();
      }
    }

    if (event.key === ' ') {
      if (this.state.testFinished) {
        event.preventDefault();
        if (!this.props.finalStage && (this.state.sentenceWords.length > 0 || this.props.isDemo)) {
          this.props.startSentenceRead?.(this.state.sentenceWords);
        } else {
          this.onHomeClicked();
        }
      } else if (sourceElement !== 'input') {
        event.preventDefault();
        (event.target as HTMLElement).blur();
        if (micAvailable && this.state.answerCategory === 'pinyin') {
          this.onListen();
        } else if (this.state.useFlashcards && this.state.answerCategory === 'meaning') {
          this.onShowAnswer();
        } else if (speakerAvailable && this.state.chosenCharacter) {
          this.onSpeak(this.state.chosenCharacter);
        }
      }
    }

    if (event.ctrlKey && event.key === 'm') {
      if (micAvailable) {
        this.onListen();
      }
    }

    if (event.ctrlKey && event.key === 'q') {
      if (speakerAvailable && this.state.chosenCharacter) {
        this.onSpeak(this.state.chosenCharacter);
      }
    }

    if (event.ctrlKey && event.key === 'b') {
      const answerInput = document.getElementById('answer-input');
      const secondaryInput = document.getElementById('secondary-input');
      if (answerInput !== null) {
        answerInput.focus();
      } else if (secondaryInput) {
        secondaryInput.focus();
      }
    }

    if (event.key === 'ArrowUp') {
      if (this.state.showAnswer && !this.state.idkDisabled) {
        this.setState({ yesClicked: true });
        this.onCorrectAnswer();
      }
    }

    if (event.key === 'ArrowDown') {
      if (this.state.showAnswer && !this.state.idkDisabled) {
        if (this.state.useSound) {
          fail.play();
        }
        this.setState({ noClicked: true });
        this.onIDontKnow();
      }
    }

    if (event.key === 'p') {
      if (sourceElement !== 'input') {
        if (this.state.questionCategory === 'pinyin') {
          this.onToggleShowPinyin();
        }
      }
    }

    if (event.key === 'a') {
      if (sourceElement !== 'input') {
        if (this.state.useAutoRecord) {
          this.state.recognition?.abort();
        } else {
          this.onListen();
        }
        this.setState((prevState) => ({
          useAutoRecord: !prevState.useAutoRecord,
        }));
      }
    }

    if (event.key === 'h') {
      if (sourceElement !== 'input') {
        this.onHint();
      }
    }

    if (event.key === 's') {
      if (sourceElement !== 'input') {
        if (speakerAvailable && this.state.chosenCharacter) {
          this.onSpeak(this.state.chosenCharacter);
        }
      }
    }

    if (event.key === 'i') {
      if (sourceElement !== 'input') {
        if (!this.state.idkDisabled) {
          this.onIDontKnow();
        }
      }
    }
  };

  onInitialiseTestSet = (useHandwriting: boolean): void => {
    const permList = testLogic.setPermList(
      this.props.words,
      useHandwriting,
      this.state.priority,
      this.state.onlyPriority
    );
    const initialVals = testLogic.assignQA(
      this.props.words,
      permList,
      this.state.charSet,
      this.state.priority
    );
    this.setState((prevState) => {
      return {
        testSet: this.props.words,
        permList: permList,
        perm: initialVals.perm,
        answer: initialVals.answer,
        answerCategory: initialVals.answerCategory,
        question: initialVals.question,
        questionCategory: initialVals.questionCategory,
        chosenCharacter: initialVals.chosenCharacter,
        initNumPerms: permList.length,
        showErrorMessage: false,
        qNum: prevState.qNum + 1,
      };
    });
  };

  setHanziWriter = (char: string): void => {
    let index = 0;
    const flashChar = false;
    let numBeforeHint = 5;

    if (this.props.isDemo) {
      numBeforeHint = 1;
    }

    try {
      const el = document.getElementById('character-target-div');
      if (el) el.innerHTML = '';
    } catch (e) {}

    const writer = window.HanziWriter.create('character-target-div', char[index], {
      width: 150,
      height: 150,
      padding: 20,
      showOutline: false,
      showCharacter: flashChar,
      showHintAfterMisses: numBeforeHint,
      delayBetweenStrokes: 10,
      strokeAnimationSpeed: 1,
    });

    this.setState({ writer });
    this.quizWriter(writer, char, index);
  };

  updateHanziWriterQuiz = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.setCharacter(char[index]);
    this.quizWriter(writer, char, index);
  };

  quizWriter = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.quiz({
      onComplete: () => {
        index++;
        if (index < char.length) {
          setTimeout(() => {
            this.updateHanziWriterQuiz(writer, char, index);
          }, 1000);
        } else {
          this.setState((prevState) => ({
            drawnCharacters: prevState.drawnCharacters.concat(char),
          }));
          setTimeout(() => {
            try {
              const el = document.getElementById('character-target-div');
              if (el) el.innerHTML = '';
            } catch (e) {}
            this.onCorrectAnswer();
          }, 1000);
        }
      },
    });
  };

  onIdkChar = (writer: HanziWriterInstance, char: string): void => {
    this.setState({ idkDisabled: true });
    writer.cancelQuiz();
    let index = 0;
    writer.setCharacter(char[index]);
    this.animateWriter(writer, char, index);
  };

  updateHanziWriterAnimate = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.setCharacter(char[index]);
    this.animateWriter(writer, char, index);
  };

  animateWriter = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.animateCharacter().then(() => {
      index++;
      if (index < char.length) {
        this.updateHanziWriterAnimate(writer, char, index);
      } else {
        try {
          const el = document.getElementById('character-target-div');
          if (el) el.innerHTML = '';
        } catch (e) {}
        this.setState((prevState) => {
          const idkChar = prevState.perm
            ? prevState.testSet[parseInt(prevState.perm.index)][this.state.charSet]
            : '';
          return {
            idkList: prevState.idkList.concat(idkChar),
          };
        });

        const newQuestion = testLogic.assignQA(
          this.state.testSet,
          this.state.permList,
          this.state.charSet,
          this.state.priority
        );

        const redoChar = newQuestion.perm === this.state.perm;

        this.setState((prevState) => ({
          perm: newQuestion.perm,
          answer: newQuestion.answer,
          answerCategory: newQuestion.answerCategory,
          question: newQuestion.question,
          questionCategory: newQuestion.questionCategory,
          chosenCharacter: newQuestion.chosenCharacter,
          idkDisabled: false,
          result: '',
          answerInput: '',
          redoChar: redoChar,
          qNum: prevState.qNum + 1,
        }));
      }
    });
  };

  onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter' || this.state.submitDisabled || this.state.answerInput === '') {
      return;
    }
    this.onSubmitAnswer();
    this.setState({ answerInput: '' });
  };

  onInputChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.state.recognition?.abort();
    this.setState({ answerInput: e.target.value, pauseAutoRecord: true });
  };

  onCorrectAnswer = (usedSpeech?: boolean): void => {
    let resultString = 'Correct';

    if (this.state.answerCategory === 'pinyin' && usedSpeech) {
      resultString = `"${this.state.answer}" is correct!`;
    }

    this.setState({
      result: resultString,
      showInput: false,
      idkDisabled: true,
      submitDisabled: true,
    });
    if (this.state.useSound) {
      beep.play();
    }
    const permIndex = this.state.permList.indexOf(this.state.perm!);
    const newPermList = this.state.permList.filter((_, index) => index !== permIndex);

    if (permIndex !== -1) {
      this.setState({ permList: newPermList });
    }
    if (newPermList.length !== 0) {
      const newQuestion = testLogic.assignQA(
        this.state.testSet,
        newPermList,
        this.state.charSet,
        this.state.priority
      );
      setTimeout(() => {
        this.setState((prevState) => ({
          perm: newQuestion.perm,
          answer: newQuestion.answer,
          answerCategory: newQuestion.answerCategory,
          question: newQuestion.question,
          questionCategory: newQuestion.questionCategory,
          chosenCharacter: newQuestion.chosenCharacter,
          result: '',
          answerInput: '',
          showInput: false,
          numSpeakTries: 0,
          qNum: prevState.qNum + 1,
          idkDisabled: false,
          submitDisabled: false,
          showAnswer: false,
        }));
      }, 1000);
    } else {
      this.onFinishTest();
      this.setState({ result: 'Finished!' });
    }
  };

  checkAnswer = (cleanInput: string): boolean => {
    cleanInput = testLogic.removePunctuation(cleanInput.trim());

    if (this.state.answerCategory === 'pinyin' && typeof this.state.answer === 'string') {
      let cleanAnswer = testLogic.removePunctuation(this.state.answer);
      cleanInput = cleanInput.replace(/ /g, '').replace(/5/g, '');
      cleanAnswer = cleanAnswer.replace(/ /g, '').replace(/5/g, '');
      return cleanInput === cleanAnswer;
    } else if (Array.isArray(this.state.answer)) {
      let match = false;
      this.state.answer.forEach((meaning) => {
        const cleanAnswer = testLogic.removePunctuation(meaning);
        match = match || cleanInput === cleanAnswer;
      });
      return match;
    }
    return false;
  };

  onSubmitAnswer = (): void => {
    if (this.checkAnswer(this.state.answerInput)) {
      this.onCorrectAnswer();
    } else {
      if (this.state.useSound) {
        fail.play();
      }
      let resultString = 'Try again';

      if (this.state.answerCategory === 'pinyin' && typeof this.state.answer === 'string') {
        const cleanAnswer = this.state.answer.replace(/ /g, '').toLowerCase();
        const cleanInput = this.state.answerInput.trim().replace(/ /g, '').toLowerCase();

        if (testLogic.toneChecker(cleanInput, cleanAnswer)) {
          resultString = 'Incorrect tones';
        }
      }

      this.setState({ result: resultString, showHint: false });
      if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
        this.onListen();
      }
    }

    this.state.recognition?.abort();
  };

  submitSpeech = (speech: string): void => {
    const numToPinMap = [
      'ling3', 'yi1', 'er4', 'san1', 'si4', 'wu3', 'liu4', 'qi1', 'ba1', 'jiu3', 'shi2',
    ];

    let submission: string;

    if (this.state.answerCategory === 'pinyin') {
      const asPinyin = pinyin(speech, { style: pinyin.STYLE_TONE2 });
      const mapped = asPinyin.map((charArr) => {
        const char = charArr[0];
        if (!isNaN(Number(char))) {
          return numToPinMap[Number(char)];
        }
        return char;
      });
      submission = mapped.join(' ');
    } else {
      submission = speech;
    }

    if (
      speech === this.state.chosenCharacter ||
      (this.state.answerCategory === 'meaning' &&
        Array.isArray(this.state.answer) &&
        this.state.answer.includes(speech))
    ) {
      this.onCorrectAnswer(true);
    } else if (submission === this.state.answer) {
      this.onCorrectAnswer(true);
    } else if (
      this.state.answerCategory === 'pinyin' &&
      typeof this.state.answer === 'string' &&
      submission.replace(/[0-9]/g, '') === this.state.answer.replace(/[0-9]/g, '')
    ) {
      if (this.state.useSound) {
        fail.play();
      }
      let sentence = 'Try different tones...';
      if (this.state.chosenCharacter?.length === 1) {
        sentence = 'Try a different tone...';
      }

      if (this.state.numSpeakTries > -1) {
        this.setState({
          result: `We heard: '${submission}', which is wrong. ${sentence}`,
          showInput: true,
        });
      } else {
        this.setState((prevState) => ({
          result: `We heard: '${submission}', which is wrong. ${sentence}`,
          numSpeakTries: prevState.numSpeakTries + 1,
        }));
      }
      if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
        setTimeout(this.onListen, 1500);
      }
    } else {
      if (this.state.useSound) {
        fail.play();
      }
      if (this.state.numSpeakTries > -1) {
        this.setState({
          result: `We heard: '${submission}', which is wrong. Try again...`,
          showInput: true,
        });
      } else {
        this.setState((prevState) => ({
          result: `We heard: '${submission}', which is wrong. Try again...`,
          numSpeakTries: prevState.numSpeakTries + 1,
        }));
      }
      if (this.state.useAutoRecord && !this.state.pauseAutoRecord) {
        setTimeout(this.onListen, 1500);
      }
    }
  };

  onSpeak = (word: string, auto = false): void => {
    this.state.recognition?.abort();

    if (this.state.interaction) {
      this.setState({ synthLoading: true });
    }

    const synth = window.speechSynthesis;
    const utterThis = new SpeechSynthesisUtterance(word);
    utterThis.lang = this.props.lang || 'zh-CN';
    if (this.props.voice) {
      utterThis.voice = this.props.voice;
    }
    utterThis.onerror = (e) => {
      if (e.error === 'synthesis-failed') {
        this.setState({ result: 'Error playing pinyin', showPinyin: true });
      }
    };
    utterThis.onend = () => {
      if (
        auto &&
        !(
          this.state.answerCategory === 'character' ||
          (this.state.answerCategory === 'meaning' && this.state.useFlashcards)
        )
      ) {
        this.onListen();
      }
    };
    utterThis.onstart = () => {
      this.setState({ synthLoading: false });
    };
    synth.cancel();
    synth.speak(utterThis);
  };

  onListen = (): void => {
    window.speechSynthesis.cancel();
    this.state.recognition?.abort();

    const recognition = new window.webkitSpeechRecognition();

    if (this.state.answerCategory === 'pinyin') {
      recognition.lang = 'zh-CN';
    } else {
      recognition.lang = 'en';
    }
    this.setState({ recognition });
    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      this.setState({ speechResult: true });
      result = event.results[0][0].transcript;
      this.submitSpeech(result.toLowerCase());
    });

    recognition.addEventListener('end', () => {
      this.setState({ listening: false, speechLoading: false, speechResult: false });
      if (!result && !this.state.idkDisabled) {
        this.setState({ result: "Couldn't hear anything...", showInput: true });
      }
    });

    recognition.addEventListener('audioend', () => {
      if (!this.state.speechResult) {
        this.setState({ result: '', speechLoading: true });
      } else {
        this.setState({ speechLoading: true });
      }
    });

    recognition.addEventListener('audiostart', () => {
      this.setState({ result: 'Listening...', listening: true });
    });

    recognition.start();
  };

  onIDontKnow = (): void => {
    this.state.recognition?.abort();
    window.speechSynthesis.cancel();

    const charDivExists = this.state.answerCategory === 'character' && this.state.useHandwriting;
    if (charDivExists && this.state.writer && typeof this.state.answer === 'string') {
      this.onIdkChar(this.state.writer, this.state.answer);
      return;
    }

    let displayAnswer = this.state.answer;
    if (this.state.answerCategory === 'meaning' && Array.isArray(displayAnswer)) {
      displayAnswer = displayAnswer.join(' / ');
    }

    this.setState((prevState) => {
      const idkChar = prevState.perm
        ? prevState.testSet[parseInt(prevState.perm.index)][this.state.charSet]
        : '';
      return {
        idkList: prevState.idkList.concat(idkChar),
        idkDisabled: true,
        submitDisabled: true,
        result: `Answer was: '${displayAnswer}'`,
      };
    });

    const newQuestion = testLogic.assignQA(
      this.state.testSet,
      this.state.permList,
      this.state.charSet,
      this.state.priority
    );

    setTimeout(() => {
      this.setState((prevState) => ({
        perm: newQuestion.perm,
        answer: newQuestion.answer,
        answerCategory: newQuestion.answerCategory,
        question: newQuestion.question,
        questionCategory: newQuestion.questionCategory,
        chosenCharacter: newQuestion.chosenCharacter,
        idkDisabled: false,
        result: '',
        answerInput: '',
        qNum: prevState.qNum + 1,
        showInput: false,
        submitDisabled: false,
        showHint: false,
        showAnswer: false,
      }));
    }, 2000);
  };

  onFinishTest = (): void => {
    const answerInput = document.getElementById('answer-input');
    const secondaryInput = document.getElementById('secondary-input');

    if (answerInput !== null) {
      (answerInput as HTMLInputElement).blur();
    }

    if (secondaryInput !== null) {
      (secondaryInput as HTMLInputElement).blur();
    }

    const idkCounts = testLogic.Counter(this.state.idkList);
    const wordScores: WordScore[] = [];
    const sendScores: { word_id: number; score: number }[] = [];
    const sentenceWords: Word[] = [];

    const scoreDict: Record<number, WordScore['score']> = {
      0: 'Very Strong',
      1: 'Strong',
      2: 'Average',
      3: 'Weak',
      4: 'Very Weak',
    };

    this.state.testSet.forEach((word) => {
      let count = idkCounts[word[this.state.charSet]] || 0;
      if (count > 4) {
        count = 4;
      }

      if (count === 0 && word.bank === 1) {
        sentenceWords.push(word);
      }

      wordScores.push({
        char: word[this.state.charSet],
        score: scoreDict[count],
      });

      sendScores.push({
        word_id: word.id,
        score: 4 - count,
      });
    });

    if (!this.props.isDemo) {
      this.onSendScores(sendScores);
    }

    this.setState({
      testFinished: true,
      scoreList: wordScores,
      sentenceWords: sentenceWords,
    });
  };

  onSendScores = (testResults: { word_id: number; score: number }[]): void => {
    fetch('/api/finish-test', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ scores: testResults }),
      cache: 'no-cache',
      headers: new Headers({
        'content-type': 'application/json',
        'x-access-token': this.props.token || '',
      }),
    }).catch((error) => {
      console.log('Fetch error: ' + error);
    });
  };

  onClickAddWords = (): void => {
    this.props.history.push('/add-words');
  };

  onFocusEntry = (e: React.FocusEvent<HTMLInputElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('q-phrase-box');
    if (el) {
      window.scrollTo(0, el.offsetTop - 5);
    }
  };

  onHomeClicked = (): void => {
    this.props.history.push('/');
  };

  showSentenceHint = (word: string): void => {
    this.setState({ synthLoading: true });
    fetch(`/api/get-one-sentence/${word}`).then((res) =>
      res.json().then((data: { sentence: string[][] }) => {
        if (this.state.useSound) {
          this.onSpeak(data.sentence[0][0]);
        } else {
          const pinyinResult = pinyin(data.sentence[0][0], {
            style: pinyin.STYLE_TONE2,
            segment: true,
          });
          this.setState({
            result: pinyinResult.map((p) => p.join('')).join(' '),
            showHint: true,
            synthLoading: false,
          });
        }
      })
    );
  };

  onHint = (): void => {
    if (this.state.showHint) {
      this.setState({ result: '', showHint: false });
      return;
    }

    if (this.state.answerCategory === 'pinyin' && typeof this.state.answer === 'string') {
      const hinted = this.state.answer.split(' ').map((word) => word[0] + '__');
      const hint = 'Hint: ' + hinted.join(' ');
      this.setState({ result: hint, showHint: true });
    } else if (this.state.answerCategory === 'meaning' && this.state.chosenCharacter) {
      this.showSentenceHint(this.state.chosenCharacter);
    } else if (this.state.answerCategory === 'character' && this.state.writer) {
      this.state.writer.showOutline();
      setTimeout(() => {
        this.state.writer?.hideOutline();
      }, 500);
    }
  };

  onToggleShowPinyin = (): void => {
    if (this.state.questionCategory === 'pinyin') {
      this.setState((prevState) => ({
        showQuestionPinyin: !prevState.showQuestionPinyin,
      }));
    }
  };

  onShowAnswer = (): void => {
    const answer = Array.isArray(this.state.answer)
      ? this.state.answer.join(' / ')
      : this.state.answer;
    this.setState({ result: `Answer was: '${answer}'`, showAnswer: true });
  };

  showCharacter = (): void => {
    this.setState((prevState) => ({
      result: prevState.result === this.state.chosenCharacter ? '' : this.state.chosenCharacter || '',
    }));
  };

  render(): React.ReactNode {
    const progressNum = Math.floor((this.state.permList.length / this.state.initNumPerms) * 100) || 0;

    const textInput = (
      <Input
        id="answer-input"
        keyPressed={this.onKeyPress}
        value={this.state.answerInput}
        changed={this.onInputChanged}
        focussed={this.onFocusEntry}
        autoFocus={true}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    );

    const buttonStyle = { display: 'inline-block', width: '50px', height: '50px', margin: '10px 20px' };
    const activeButtonStyle = { ...buttonStyle, boxShadow: '0px 0px', transform: 'translateY(3px)' };

    const showAnswerContent = this.state.showAnswer ? (
      <div>
        <PictureButton
          style={this.state.yesClicked ? activeButtonStyle : buttonStyle}
          clicked={this.onCorrectAnswer}
          src={likePic}
        />
        <PictureButton
          style={this.state.noClicked ? activeButtonStyle : buttonStyle}
          clicked={() => {
            if (this.state.useSound) fail.play();
            this.onIDontKnow();
          }}
          src={dislikePic}
        />
      </div>
    ) : (
      <Button style={{ width: '230px', margin: '0 auto' }} clicked={this.onShowAnswer}>
        Show Answer
      </Button>
    );

    const characterInput = (
      <div
        id="character-target-div"
        style={{
          backgroundColor: 'lightgray',
          width: '150px',
          margin: '0 auto',
          borderRadius: '3px',
        }}
      ></div>
    );

    const micInput = (
      <div>
        <PictureButton colour="yellow" src={micPic} clicked={() => this.onListen()} />
        <Toggle
          checked={this.state.useAutoRecord}
          changed={(event) => {
            this.state.recognition?.abort();
            this.setState({ useAutoRecord: event.target.checked });
            if (event.target.checked) this.onListen();
          }}
        />
        {this.state.showInput ? (
          <Input
            id="secondary-input"
            keyPressed={this.onKeyPress}
            value={this.state.answerInput}
            changed={this.onInputChanged}
            placeholder="Type answer..."
            autoFocus={true}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        ) : null}
      </div>
    );

    let inputFormat: React.ReactNode;
    let verb: string;

    switch (this.state.answerCategory) {
      case 'pinyin':
        if (this.state.useChineseSpeechRecognition) {
          inputFormat = micInput;
          verb = 'Speak the ';
        } else {
          inputFormat = textInput;
          verb = 'Enter the ';
        }
        break;
      case 'character':
        inputFormat = characterInput;
        verb = 'Draw the ';
        break;
      case 'meaning':
        if (this.state.useFlashcards) {
          inputFormat = showAnswerContent;
          verb = 'What is the ';
        } else if (this.state.useEnglishSpeechRecognition) {
          inputFormat = micInput;
          verb = 'Speak the ';
        } else {
          inputFormat = textInput;
          verb = 'Enter the ';
        }
        break;
      default:
        inputFormat = textInput;
        verb = 'Enter the ';
    }

    const questionText =
      this.state.questionCategory === 'meaning' && Array.isArray(this.state.question)
        ? this.state.question.join(' / ')
        : this.state.question;

    let questionFormat: React.ReactNode = <h2>{questionText}</h2>;

    if (this.state.questionCategory === 'pinyin' && this.state.useSound && !this.state.showPinyin) {
      questionFormat = (
        <Aux>
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: '100px' }}>
            {this.state.synthLoading ? (
              <Spinner style={{ overflow: 'hidden', margin: '0 auto' }} />
            ) : (
              <PictureButton
                colour="grey"
                src={speakerPic}
                clicked={() => this.state.chosenCharacter && this.onSpeak(this.state.chosenCharacter)}
              />
            )}
          </div>
          {this.state.showQuestionPinyin ? <p style={{ color: 'black' }}>{this.state.question}</p> : null}
          <button onClick={this.onToggleShowPinyin} className={classes.PinyinToggle}>
            {this.state.showQuestionPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
          </button>
        </Aux>
      );
    }

    const pinyinQuestionWithSound = this.state.questionCategory === 'pinyin' && this.state.useSound;
    const pinyinAnswerMeaningQuestion =
      this.state.answerCategory === 'pinyin' && this.state.questionCategory === 'meaning';
    const meaningAnswer = this.state.answerCategory === 'meaning';

    if (this.state.testSet.length !== 0 || this.props.isDemo) {
      return (
        <Aux>
          <Backdrop show={this.state.testFinished} />
          <Modal
            show={this.state.testFinished}
          >
            <TestSummary
              continueAvailable={
                (this.state.sentenceWords.length > 0 && !this.props.finalStage) || this.props.isDemo
              }
              continueClicked={() => this.props.startSentenceRead?.(this.state.sentenceWords)}
              scores={this.state.scoreList}
            />
          </Modal>
          <div className={classes.Test}>
            <ProgressBar progress={progressNum} />
            <h3 id="q-phrase-box">
              {verb}
              <span>{this.state.answerCategory}</span> for...
            </h3>
            <div className={classes.QuestionCard}>{questionFormat}</div>
            <p className={classes.Result}>{this.state.result}</p>
            <div className={classes.InputDiv}>{inputFormat}</div>
            <div style={{ paddingTop: '30px', display: 'flex', justifyContent: 'center' }}>
              <Button
                disabled={this.state.idkDisabled || this.state.showAnswer}
                clicked={this.onIDontKnow}
                id="idk"
              >
                I Don't Know
              </Button>
              <Button
                disabled={
                  (!pinyinQuestionWithSound &&
                    !pinyinAnswerMeaningQuestion &&
                    !meaningAnswer &&
                    this.state.answerCategory !== 'character') ||
                  this.state.showAnswer
                }
                clicked={this.onHint}
              >
                {this.state.questionCategory === 'pinyin' && this.state.useSound
                  ? 'Hint'
                  : this.state.showHint
                    ? 'Hide Hint'
                    : 'Show Hint'}
              </Button>
              {this.state.questionCategory === 'pinyin' &&
              this.state.useSound &&
              this.state.chosenCharacter?.length === 1 ? (
                <Button clicked={this.showCharacter}>
                  {this.state.result === this.state.chosenCharacter ? 'Hide Character' : 'Show Character'}
                </Button>
              ) : null}
            </div>
          </div>
        </Aux>
      );
    } else {
      return (
        <Modal show={this.state.showErrorMessage}>
          <p>You have no words due for testing!</p>
          <Button clicked={this.onClickAddWords}>Add Words</Button>
        </Modal>
      );
    }
  }
}

export default withRouter(connector(Test));
