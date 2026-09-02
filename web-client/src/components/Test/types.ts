import { RouteComponentProps } from 'react-router-dom';

import {
  DirectionGrade,
  DirectionResult,
  Word,
  QueuePair,
  WordDirectionResults,
  WordScore,
} from '../../types/models';
import { QuizType } from '../../utils/audioSettings';
import { SessionPlan } from './Logic/TestLogic';

/**
 * The words each sentence stage runs for.
 *
 * The Read stage takes the words the learner has just met, and the Write stage
 * takes the ones they already half know, so the two lists are built from
 * separate gates rather than sliced from one. See
 * docs/adr/0011-gate-the-write-stage-on-partial-mastery.md.
 */
export interface SentenceStageWords {
  read: Word[];
  write: Word[];
}

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
   * The grade of every question the session has finished, in the order the
   * questions were asked. finishTest reschedules exactly these, so a direction
   * the session did not ask keeps the bank and due date it already holds.
   */
  gradeList: DirectionGrade[];
  /**
   * The best grade the current question can still get. It starts at `pass` and
   * a wrong first attempt, five misses on one stroke, or the stroke outline
   * drops it to `lapse`. "I don't know" and the reveal grade `fail` outright,
   * so they do not read this.
   */
  gradeCap: Exclude<DirectionResult, 'fail'>;
  /** Tone errors collected on the current question. */
  toneErrorCount: number;
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
  /**
   * Every word either sentence stage may use, deduplicated. The engine hands
   * the two stage lists to `startSentenceStages`; this one exists so that the
   * availability check has a single set to run over.
   */
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
  /**
   * The characters whose components the session is offering after a missed
   * question, or [] when it is not offering any. A non-empty list holds the
   * session on the reveal: the next question waits for Continue.
   */
  componentReviewChars: string[];
  /** Whether the component breakdown of those characters is expanded. */
  showComponents: boolean;
  /**
   * The grade button the learner pressed on the current flashcard question, or
   * null while the question is ungraded. It styles the three buttons, so it is
   * set however the grade was given, by mouse or by keyboard.
   */
  gradeClicked: DirectionResult | null;
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
  startSentenceStages?: (words: SentenceStageWords, scores?: WordScore[]) => void;
  onVocabComplete?: (scores: WordScore[]) => void;
  devTestFinished?: boolean;
  practiceMode?: boolean;
  sentenceStagesForAllWords?: boolean;
}

export type Props = ReduxProps & OwnProps & RouteComponentProps;

export type TestStateUpdate = Partial<TestState> | ((prevState: TestState) => Partial<TestState>);
