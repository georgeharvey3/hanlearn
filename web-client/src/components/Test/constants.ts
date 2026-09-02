import { Howl } from 'howler';

import successSound from '../../assets/sounds/success1.wav';
import failSound from '../../assets/sounds/failure1.wav';

import { DIRECTIONS, DirectionResult, WordScore } from '../../types/models';
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
  const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad';
  const priority = props.isDemo ? 'none' : localStorage.getItem('priority') || 'none';
  const onlyPriority = props.isDemo ? false : localStorage.getItem('onlyPriority') === 'true';

  // The dev summary stage fills the summary with one row per direction of each
  // word, so that every grade and a long list are both visible at once.
  const devScoreList: WordScore[] = props.devTestFinished
    ? props.words.flatMap((word) =>
        DIRECTIONS.map((direction) => {
          const roll = Math.random();
          return {
            char: word[charSet],
            direction,
            result: (roll < 0.6 ? 'pass' : roll < 0.85 ? 'lapse' : 'fail') as DirectionResult,
          };
        }),
      )
    : [];

  return {
    testSet: [],
    queue: [],
    charSet: charSet,
    currentPair: null,
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
    initialQueueLength: 0,
    gradeList: [],
    gradeCap: 'pass',
    toneErrorCount: 0,
    scoreList: devScoreList,
    testFinished: props.devTestFinished ?? false,
    showInputChars: [],
    drawnCharacters: [],
    useSound: true,
    useSoundEffects: true,
    useHandwriting: true,
    meaningQuizType: 'input',
    pinyinQuizType: 'input',
    useAutoRecord: false,
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
    componentReviewChars: [],
    showComponents: false,
    gradeClicked: null,
    pauseAutoRecord: false,
    synthLoading: false,
    speechLoading: false,
    interaction: false,
    speechResult: false,
  };
};
