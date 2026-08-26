import { RouteComponentProps } from 'react-router-dom';

import { Direction, Word, TestPerm, WordDirectionResults, WordScore } from '../../types/models';
import { QuizType } from '../../utils/audioSettings';

export interface TestState {
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
  /**
   * The directions this session asks, taken from the perm list when it is built.
   * finishTest reschedules only these, so a direction the session left out —
   * handwriting when it is switched off, or the four that onlyPriority filters
   * away — keeps the bank and due date it already holds.
   */
  askedDirections: Direction[];
  idkList: string[];
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
