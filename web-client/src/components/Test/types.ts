import { RouteComponentProps } from 'react-router-dom';

import { Word, TestPerm, WordScore } from '../../types/models';
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
  idkList: string[];
  scoreList: WordScore[];
  testFinished: boolean;
  showInput: boolean;
  showInputChars: string[];
  drawnCharacters: string[];
  numSpeakTries: number;
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
  useTypingInput: boolean;
}

export interface ReduxProps {
  userId: string | null;
  speechAvailable: boolean;
  synthAvailable: boolean;
  voice?: SpeechSynthesisVoice;
  lang?: string;
  onFinishTest: (scores: { word_id: number; score: number }[]) => void;
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
