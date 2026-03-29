import { Howl } from 'howler';

import successSound from '../../assets/sounds/success1.wav';
import failSound from '../../assets/sounds/failure1.wav';

import { WordScore } from '../../types/models';
import { Props, TestState } from './types';

export const beep = new Howl({
  src: [successSound],
  volume: 0.5,
});

export const fail = new Howl({
  src: [failSound],
  volume: 0.7,
});

export const buttonStyle = {
  display: 'inline-block',
  width: '50px',
  height: '50px',
  margin: '10px 20px',
};
export const activeButtonStyle = {
  ...buttonStyle,
  boxShadow: '0px 0px',
  transform: 'translateY(3px)',
};

export const createInitialState = (props: Props): TestState => {
  const numWords = parseInt(localStorage.getItem('numWords') || '5');
  const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad';
  const priority = props.isDemo ? 'none' : localStorage.getItem('priority') || 'none';
  const onlyPriority = props.isDemo ? false : localStorage.getItem('onlyPriority') === 'true';

  const devScoreList: WordScore[] = props.devTestFinished
    ? props.words.map((word) => ({
        char: word[charSet],
        score: ['Very Strong', 'Strong', 'Average', 'Weak', 'Very Weak'][
          Math.floor(Math.random() * 5)
        ] as WordScore['score'],
      }))
    : [];

  return {
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
    scoreList: devScoreList,
    testFinished: props.devTestFinished ?? false,
    showInput: false,
    showInputChars: [],
    drawnCharacters: [],
    numSpeakTries: 0,
    useSound: true,
    useSoundEffects: true,
    useHandwriting: true,
    useChineseSpeechRecognition: true,
    useEnglishSpeechRecognition: true,
    useAutoRecord: false,
    useFlashcards: false,
    showErrorMessage: false,
    redoChar: false,
    sentenceWords: [],
    sentenceCheckStatus: 'idle',
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
    useTypingInput: false,
  };
};
