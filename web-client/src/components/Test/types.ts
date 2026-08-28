import { RouteComponentProps } from 'react-router-dom';

import {
  Direction,
  DirectionFailure,
  Word,
  QueuePair,
  WordDirectionResults,
  WordScore,
} from '../../types/models';
import { QuizType } from '../../utils/audioSettings';
import { SessionPlan } from './Logic/TestLogic';

export interface TestState {
  testSet: Word[];
  queue: QueuePair[];
  charSet: 'simp' | 'trad';
  currentPair: QueuePair | null;
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
  initialQueueLength: number;
  /**
   * The directions this session asks, taken from the queue when it is built.
   * finishTest reschedules only these, so a direction the session left out —
   * handwriting when it is switched off, or the four that onlyPriority filters
   * away — keeps the bank and due date it already holds.
   */
  askedDirections: Direction[];
  /**
   * The directions the learner did not know, in the order they happened.
   * One entry per failed question, not per word.
   */
  idkList: DirectionFailure[];
  scoreList: WordScore[];
  testFinished: boolean;
  showInputChars: string[];
  drawnCharacters: string[];
  useSound: boolean;
  useSoundEffects: boolean;
  useHandwriting: boolean;
  meaningQuizType: QuizType;
  pinyinQuizType: QuizType;
  useAutoRecord: boolean;
  showErrorMessage: boolean;
  redoChar: boolean;
  sentenceWords: Word[];
  sentenceCheckStatus: 'idle' | 'pending' | 'available' | 'unavailable';
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

export interface ReduxProps {
  userId: string | null;
  speechAvailable: boolean;
  synthAvailable: boolean;
  voice?: SpeechSynthesisVoice;
  lang?: string;
  onFinishTest: (results: WordDirectionResults[]) => void;
}

export interface OwnProps {
  words: Word[];
  /**
   * The plan the session runs, built by TestWords so that the Learn step and
   * the queue agree on which new words the session admits. The engine plans for
   * itself only when this is absent, which is the demo and the unit tests.
   */
  plan?: SessionPlan;
  isDemo?: boolean;
  finalStage?: boolean;
  startSentenceRead?: (words: Word[], scores?: WordScore[]) => void;
  onVocabComplete?: (scores: WordScore[]) => void;
  devTestFinished?: boolean;
  practiceMode?: boolean;
  sentenceStagesForAllWords?: boolean;
}

export type Props = ReduxProps & OwnProps & RouteComponentProps;

export type TestStateUpdate = Partial<TestState> | ((prevState: TestState) => Partial<TestState>);
