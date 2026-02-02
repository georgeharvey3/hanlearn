import React, { useCallback, useEffect, useRef, useState } from 'react';
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

type TestStateUpdate = Partial<TestState> | ((prevState: TestState) => Partial<TestState>);

const createInitialState = (props: Props): TestState => {
  const numWords = parseInt(localStorage.getItem('numWords') || '5');
  const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
  const priority = localStorage.getItem('priority') || 'none';
  const onlyPriority = localStorage.getItem('onlyPriority') === 'true';

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
};

const Test: React.FC<Props> = (props) => {
  const [state, setState] = useState<TestState>(() => createInitialState(props));
  const stateRef = useRef(state);
  const submitSpeechRef = useRef<(speech: string) => void>(() => {});
  const onListenRef = useRef<() => void>(() => {});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setStateMerged = useCallback((update: TestStateUpdate) => {
    setState((prev) => ({
      ...prev,
      ...(typeof update === 'function' ? update(prev) : update),
    }));
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  const setInteraction = useCallback((): void => {
    setStateMerged({ interaction: true });
  }, [setStateMerged]);

  const onSendScores = useCallback(
    (testResults: { word_id: number; score: number }[]): void => {
      fetch('/api/finish-test', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ scores: testResults }),
        cache: 'no-cache',
        headers: new Headers({
          'content-type': 'application/json',
          'x-access-token': props.token || '',
        }),
      }).catch((error) => {
        console.log('Fetch error: ' + error);
      });
    },
    [props.token]
  );

  const onHomeClicked = useCallback((): void => {
    props.history.push('/');
  }, [props.history]);

  const onClickAddWords = useCallback((): void => {
    props.history.push('/add-words');
  }, [props.history]);

  const onFocusEntry = useCallback((e: React.FocusEvent<HTMLInputElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('q-phrase-box');
    if (el) {
      window.scrollTo(0, el.offsetTop - 5);
    }
  }, []);

  const onListen = useCallback((): void => {
    const current = getState();
    window.speechSynthesis.cancel();
    current.recognition?.abort();

    const recognition = new window.webkitSpeechRecognition();

    if (current.answerCategory === 'pinyin') {
      recognition.lang = 'zh-CN';
    } else {
      recognition.lang = 'en';
    }
    setStateMerged({ recognition });
    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      setStateMerged({ speechResult: true });
      result = event.results[0][0].transcript;
      submitSpeechRef.current(result.toLowerCase());
    });

    recognition.addEventListener('end', () => {
      const latest = getState();
      setStateMerged({ listening: false, speechLoading: false, speechResult: false });
      if (!result && !latest.idkDisabled) {
        setStateMerged({ result: "Couldn't hear anything...", showInput: true });
      }
    });

    recognition.addEventListener('audioend', () => {
      const latest = getState();
      if (!latest.speechResult) {
        setStateMerged({ result: '', speechLoading: true });
      } else {
        setStateMerged({ speechLoading: true });
      }
    });

    recognition.addEventListener('audiostart', () => {
      setStateMerged({ result: 'Listening...', listening: true });
    });

    recognition.start();
  }, [getState, setStateMerged]);

  const onSpeak = useCallback(
    (word: string, auto = false): void => {
      const current = getState();
      current.recognition?.abort();

      if (current.interaction) {
        setStateMerged({ synthLoading: true });
      }

      const synth = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(word);
      utterThis.lang = props.lang || 'zh-CN';
      if (props.voice) {
        utterThis.voice = props.voice;
      }
      utterThis.onerror = (e) => {
        if (e.error === 'synthesis-failed') {
          setStateMerged({ result: 'Error playing pinyin', showPinyin: true });
        }
      };
      utterThis.onend = () => {
        const latest = getState();
        if (
          auto &&
          !(
            latest.answerCategory === 'character' ||
            (latest.answerCategory === 'meaning' && latest.useFlashcards)
          )
        ) {
          onListen();
        }
      };
      utterThis.onstart = () => {
        setStateMerged({ synthLoading: false });
      };
      synth.cancel();
      synth.speak(utterThis);
    },
    [getState, onListen, props.lang, props.voice, setStateMerged]
  );

  const onFinishTest = useCallback((): void => {
    const current = getState();
    const answerInput = document.getElementById('answer-input');
    const secondaryInput = document.getElementById('secondary-input');

    if (answerInput !== null) {
      (answerInput as HTMLInputElement).blur();
    }

    if (secondaryInput !== null) {
      (secondaryInput as HTMLInputElement).blur();
    }

    const idkCounts = testLogic.Counter(current.idkList);
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

    current.testSet.forEach((word) => {
      let count = idkCounts[word[current.charSet]] || 0;
      if (count > 4) {
        count = 4;
      }

      if (count === 0 && word.bank === 1) {
        sentenceWords.push(word);
      }

      wordScores.push({
        char: word[current.charSet],
        score: scoreDict[count],
      });

      sendScores.push({
        word_id: word.id,
        score: 4 - count,
      });
    });

    if (!props.isDemo) {
      onSendScores(sendScores);
    }

    setStateMerged({
      testFinished: true,
      scoreList: wordScores,
      sentenceWords: sentenceWords,
    });
  }, [getState, onSendScores, props.isDemo, setStateMerged]);

  const onCorrectAnswer = useCallback(
    (usedSpeech?: boolean): void => {
      const current = getState();
      let resultString = 'Correct';

      if (current.answerCategory === 'pinyin' && usedSpeech) {
        resultString = `"${current.answer}" is correct!`;
      }

      setStateMerged({
        result: resultString,
        showInput: false,
        idkDisabled: true,
        submitDisabled: true,
      });
      if (current.useSound) {
        beep.play();
      }
      const permIndex = current.permList.indexOf(current.perm!);
      const newPermList = current.permList.filter((_, index) => index !== permIndex);

      if (permIndex !== -1) {
        setStateMerged({ permList: newPermList });
      }
      if (newPermList.length !== 0) {
        const newQuestion = testLogic.assignQA(
          current.testSet,
          newPermList,
          current.charSet,
          current.priority
        );
        setTimeout(() => {
          setStateMerged((prevState) => ({
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
        onFinishTest();
        setStateMerged({ result: 'Finished!' });
      }
    },
    [getState, setStateMerged, onFinishTest]
  );

  const checkAnswer = useCallback((cleanInput: string): boolean => {
    const current = getState();
    cleanInput = testLogic.removePunctuation(cleanInput.trim());

    if (current.answerCategory === 'pinyin' && typeof current.answer === 'string') {
      let cleanAnswer = testLogic.removePunctuation(current.answer);
      cleanInput = cleanInput.replace(/ /g, '').replace(/5/g, '');
      cleanAnswer = cleanAnswer.replace(/ /g, '').replace(/5/g, '');
      return cleanInput === cleanAnswer;
    } else if (Array.isArray(current.answer)) {
      let match = false;
      current.answer.forEach((meaning) => {
        const cleanAnswer = testLogic.removePunctuation(meaning);
        match = match || cleanInput === cleanAnswer;
      });
      return match;
    }
    return false;
  }, [getState]);

  const onSubmitAnswer = useCallback((): void => {
    const current = getState();
    if (checkAnswer(current.answerInput)) {
      onCorrectAnswer();
    } else {
      if (current.useSound) {
        fail.play();
      }
      let resultString = 'Try again';

      if (current.answerCategory === 'pinyin' && typeof current.answer === 'string') {
        const cleanAnswer = current.answer.replace(/ /g, '').toLowerCase();
        const cleanInput = current.answerInput.trim().replace(/ /g, '').toLowerCase();

        if (testLogic.toneChecker(cleanInput, cleanAnswer)) {
          resultString = 'Incorrect tones';
        }
      }

      setStateMerged({ result: resultString, showHint: false });
      if (current.useAutoRecord && !current.pauseAutoRecord) {
        onListen();
      }
    }

    current.recognition?.abort();
  }, [checkAnswer, getState, onCorrectAnswer, onListen, setStateMerged]);

  const submitSpeech = useCallback(
    (speech: string): void => {
      const current = getState();
      const numToPinMap = [
        'ling3', 'yi1', 'er4', 'san1', 'si4', 'wu3', 'liu4', 'qi1', 'ba1', 'jiu3', 'shi2',
      ];

      let submission: string;

      if (current.answerCategory === 'pinyin') {
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
        speech === current.chosenCharacter ||
        (current.answerCategory === 'meaning' &&
          Array.isArray(current.answer) &&
          current.answer.includes(speech))
      ) {
        onCorrectAnswer(true);
      } else if (submission === current.answer) {
        onCorrectAnswer(true);
      } else if (
        current.answerCategory === 'pinyin' &&
        typeof current.answer === 'string' &&
        submission.replace(/[0-9]/g, '') === current.answer.replace(/[0-9]/g, '')
      ) {
        if (current.useSound) {
          fail.play();
        }
        let sentence = 'Try different tones...';
        if (current.chosenCharacter?.length === 1) {
          sentence = 'Try a different tone...';
        }

        if (current.numSpeakTries > -1) {
          setStateMerged({
            result: `We heard: '${submission}', which is wrong. ${sentence}`,
            showInput: true,
          });
        } else {
          setStateMerged((prevState) => ({
            result: `We heard: '${submission}', which is wrong. ${sentence}`,
            numSpeakTries: prevState.numSpeakTries + 1,
          }));
        }
        if (current.useAutoRecord && !current.pauseAutoRecord) {
          setTimeout(() => onListenRef.current(), 1500);
        }
      } else {
        if (current.useSound) {
          fail.play();
        }
        if (current.numSpeakTries > -1) {
          setStateMerged({
            result: `We heard: '${submission}', which is wrong. Try again...`,
            showInput: true,
          });
        } else {
          setStateMerged((prevState) => ({
            result: `We heard: '${submission}', which is wrong. Try again...`,
            numSpeakTries: prevState.numSpeakTries + 1,
          }));
        }
        if (current.useAutoRecord && !current.pauseAutoRecord) {
          setTimeout(() => onListenRef.current(), 1500);
        }
      }
    },
    [getState, onCorrectAnswer, setStateMerged]
  );

  useEffect(() => {
    submitSpeechRef.current = submitSpeech;
  }, [submitSpeech]);

  useEffect(() => {
    onListenRef.current = onListen;
  }, [onListen]);

  const quizWriter = useCallback(
    (writer: HanziWriterInstance, char: string, index: number): void => {
      writer.quiz({
        onComplete: () => {
          index++;
          if (index < char.length) {
            setTimeout(() => {
              updateHanziWriterQuiz(writer, char, index);
            }, 1000);
          } else {
            setStateMerged((prevState) => ({
              drawnCharacters: prevState.drawnCharacters.concat(char),
            }));
            setTimeout(() => {
              try {
                const el = document.getElementById('character-target-div');
                if (el) el.innerHTML = '';
              } catch (e) {}
              onCorrectAnswer();
            }, 1000);
          }
        },
      });
    },
    [onCorrectAnswer, setStateMerged]
  );

  const updateHanziWriterQuiz = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.setCharacter(char[index]);
    quizWriter(writer, char, index);
  };

  const setHanziWriter = useCallback(
    (char: string): void => {
      let index = 0;
      const flashChar = false;
      let numBeforeHint = 5;

      if (props.isDemo) {
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

      setStateMerged({ writer });
      quizWriter(writer, char, index);
    },
    [props.isDemo, quizWriter, setStateMerged]
  );

  const updateHanziWriterAnimate = (writer: HanziWriterInstance, char: string, index: number): void => {
    writer.setCharacter(char[index]);
    animateWriter(writer, char, index);
  };

  const animateWriter = useCallback(
    (writer: HanziWriterInstance, char: string, index: number): void => {
      writer.animateCharacter().then(() => {
        index++;
        if (index < char.length) {
          updateHanziWriterAnimate(writer, char, index);
        } else {
          try {
            const el = document.getElementById('character-target-div');
            if (el) el.innerHTML = '';
          } catch (e) {}
          setStateMerged((prevState) => {
            const idkChar = prevState.perm
              ? prevState.testSet[parseInt(prevState.perm.index)][prevState.charSet]
              : '';
            return {
              idkList: prevState.idkList.concat(idkChar),
            };
          });

          const latest = getState();
          const newQuestion = testLogic.assignQA(
            latest.testSet,
            latest.permList,
            latest.charSet,
            latest.priority
          );

          const redoChar = newQuestion.perm === latest.perm;

          setStateMerged((prevState) => ({
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
    },
    [getState, setStateMerged]
  );

  const onIdkChar = useCallback(
    (writer: HanziWriterInstance, char: string): void => {
      setStateMerged({ idkDisabled: true });
      writer.cancelQuiz();
      let index = 0;
      writer.setCharacter(char[index]);
      animateWriter(writer, char, index);
    },
    [animateWriter, setStateMerged]
  );

  const onIDontKnow = useCallback((): void => {
    const current = getState();
    current.recognition?.abort();
    window.speechSynthesis.cancel();

    const charDivExists = current.answerCategory === 'character' && current.useHandwriting;
    if (charDivExists && current.writer && typeof current.answer === 'string') {
      onIdkChar(current.writer, current.answer);
      return;
    }

    let displayAnswer = current.answer;
    if (current.answerCategory === 'meaning' && Array.isArray(displayAnswer)) {
      displayAnswer = displayAnswer.join(' / ');
    }

    setStateMerged((prevState) => {
      const idkChar = prevState.perm
        ? prevState.testSet[parseInt(prevState.perm.index)][prevState.charSet]
        : '';
      return {
        idkList: prevState.idkList.concat(idkChar),
        idkDisabled: true,
        submitDisabled: true,
        result: `Answer was: '${displayAnswer}'`,
      };
    });

    const newQuestion = testLogic.assignQA(
      current.testSet,
      current.permList,
      current.charSet,
      current.priority
    );

    setTimeout(() => {
      setStateMerged((prevState) => ({
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
  }, [getState, onIdkChar, setStateMerged]);


  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const current = getState();
      current.recognition?.abort();
      setStateMerged({ answerInput: e.target.value, pauseAutoRecord: true });
    },
    [getState, setStateMerged]
  );

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const current = getState();
      if (e.key !== 'Enter' || current.submitDisabled || current.answerInput === '') {
        return;
      }
      onSubmitAnswer();
      setStateMerged({ answerInput: '' });
    },
    [getState, onSubmitAnswer, setStateMerged]
  );

  const showSentenceHint = useCallback(
    (word: string): void => {
      setStateMerged({ synthLoading: true });
      fetch(`/api/get-one-sentence/${word}`).then((res) =>
        res.json().then((data: { sentence: string[][] }) => {
          const current = getState();
          if (current.useSound) {
            onSpeak(data.sentence[0][0]);
          } else {
            const pinyinResult = pinyin(data.sentence[0][0], {
              style: pinyin.STYLE_TONE2,
              segment: true,
            });
            setStateMerged({
              result: pinyinResult.map((p) => p.join('')).join(' '),
              showHint: true,
              synthLoading: false,
            });
          }
        })
      );
    },
    [getState, onSpeak, setStateMerged]
  );

  const onHint = useCallback((): void => {
    const current = getState();
    if (current.showHint) {
      setStateMerged({ result: '', showHint: false });
      return;
    }

    if (current.answerCategory === 'pinyin' && typeof current.answer === 'string') {
      const hinted = current.answer.split(' ').map((word) => word[0] + '__');
      const hint = 'Hint: ' + hinted.join(' ');
      setStateMerged({ result: hint, showHint: true });
    } else if (current.answerCategory === 'meaning' && current.chosenCharacter) {
      showSentenceHint(current.chosenCharacter);
    } else if (current.answerCategory === 'character' && current.writer) {
      current.writer.showOutline();
      setTimeout(() => {
        current.writer?.hideOutline();
      }, 500);
    }
  }, [getState, setStateMerged, showSentenceHint]);

  const onShowAnswer = useCallback((): void => {
    const current = getState();
    const answer = Array.isArray(current.answer) ? current.answer.join(' / ') : current.answer;
    setStateMerged({ result: `Answer was: '${answer}'`, showAnswer: true });
  }, [getState, setStateMerged]);

  const onToggleShowPinyin = useCallback((): void => {
    const current = getState();
    if (current.questionCategory === 'pinyin') {
      setStateMerged((prevState) => ({
        showQuestionPinyin: !prevState.showQuestionPinyin,
      }));
    }
  }, [getState, setStateMerged]);

  const showCharacter = useCallback((): void => {
    const current = getState();
    setStateMerged((prevState) => ({
      result: prevState.result === current.chosenCharacter ? '' : current.chosenCharacter || '',
    }));
  }, [getState, setStateMerged]);

  const onInitialiseTestSet = useCallback(
    (useHandwriting: boolean): void => {
      const current = getState();
      const permList = testLogic.setPermList(
        props.words,
        useHandwriting,
        current.priority,
        current.onlyPriority
      );
      const initialVals = testLogic.assignQA(
        props.words,
        permList,
        current.charSet,
        current.priority
      );
      setStateMerged((prevState) => ({
        testSet: props.words,
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
      }));
    },
    [getState, props.words, setStateMerged]
  );

  const initialiseSettings = useCallback((): void => {
    const useSound =
      props.synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(props.isDemo));
    const useHandwriting =
      !(localStorage.getItem('useHandwriting') === 'false') || Boolean(props.isDemo);
    const useChineseSpeechRecognition =
      props.speechAvailable &&
      (!(localStorage.getItem('useChineseSpeechRecognition') === 'false') || Boolean(props.isDemo));
    const useEnglishSpeechRecognition =
      props.speechAvailable &&
      (!(localStorage.getItem('useEnglishSpeechRecognition') === 'false') || Boolean(props.isDemo));
    const useFlashcards =
      (props.speechAvailable && !(localStorage.getItem('useFlashcards') === 'false')) ||
      Boolean(props.isDemo);

    setStateMerged({
      useSound,
      useHandwriting,
      useChineseSpeechRecognition,
      useEnglishSpeechRecognition,
      useFlashcards,
    });

    onInitialiseTestSet(useHandwriting);
  }, [onInitialiseTestSet, props.isDemo, props.speechAvailable, props.synthAvailable, setStateMerged]);

  const onKeyUp = useCallback(
    (event: KeyboardEvent): void => {
      const current = getState();
      const sourceElement = (event.target as HTMLElement).tagName.toLowerCase();
      const micAvailable =
        ((current.useChineseSpeechRecognition && current.answerCategory === 'pinyin') ||
          (current.useEnglishSpeechRecognition && current.answerCategory === 'meaning')) &&
        !current.listening &&
        !current.testFinished;

      const speakerAvailable =
        current.useSound &&
        current.questionCategory === 'pinyin' &&
        !current.testFinished &&
        !current.listening;

      if (event.ctrlKey && event.key === 'i') {
        if (!current.idkDisabled) {
          onIDontKnow();
        }
      }

      if (event.key === ' ') {
        if (current.testFinished) {
          event.preventDefault();
          if (!props.finalStage && (current.sentenceWords.length > 0 || props.isDemo)) {
            props.startSentenceRead?.(current.sentenceWords);
          } else {
            onHomeClicked();
          }
        } else if (sourceElement !== 'input') {
          event.preventDefault();
          (event.target as HTMLElement).blur();
          if (micAvailable && current.answerCategory === 'pinyin') {
            onListen();
          } else if (current.useFlashcards && current.answerCategory === 'meaning') {
            onShowAnswer();
          } else if (speakerAvailable && current.chosenCharacter) {
            onSpeak(current.chosenCharacter);
          }
        }
      }

      if (event.ctrlKey && event.key === 'm') {
        if (micAvailable) {
          onListen();
        }
      }

      if (event.ctrlKey && event.key === 'q') {
        if (speakerAvailable && current.chosenCharacter) {
          onSpeak(current.chosenCharacter);
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
        if (current.showAnswer && !current.idkDisabled) {
          setStateMerged({ yesClicked: true });
          onCorrectAnswer();
        }
      }

      if (event.key === 'ArrowDown') {
        if (current.showAnswer && !current.idkDisabled) {
          if (current.useSound) {
            fail.play();
          }
          setStateMerged({ noClicked: true });
          onIDontKnow();
        }
      }

      if (event.key === 'p') {
        if (sourceElement !== 'input') {
          if (current.questionCategory === 'pinyin') {
            onToggleShowPinyin();
          }
        }
      }

      if (event.key === 'a') {
        if (sourceElement !== 'input') {
          if (current.useAutoRecord) {
            current.recognition?.abort();
          } else {
            onListen();
          }
          setStateMerged((prevState) => ({
            useAutoRecord: !prevState.useAutoRecord,
          }));
        }
      }

      if (event.key === 'h') {
        if (sourceElement !== 'input') {
          onHint();
        }
      }

      if (event.key === 's') {
        if (sourceElement !== 'input') {
          if (speakerAvailable && current.chosenCharacter) {
            onSpeak(current.chosenCharacter);
          }
        }
      }

      if (event.key === 'i') {
        if (sourceElement !== 'input') {
          if (!current.idkDisabled) {
            onIDontKnow();
          }
        }
      }
    },
    [getState, onCorrectAnswer, onHint, onHomeClicked, onIDontKnow, onListen, onShowAnswer, onSpeak, onToggleShowPinyin, props.finalStage, props.isDemo, props.startSentenceRead, setStateMerged]
  );

  useEffect(() => {
    initialiseSettings();
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mouseover', setInteraction);
    document.addEventListener('scroll', setInteraction);
    document.addEventListener('keydown', setInteraction);

    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mouseover', setInteraction);
      document.removeEventListener('scroll', setInteraction);
      document.removeEventListener('keydown', setInteraction);
      window.speechSynthesis.cancel();
    };
  }, [initialiseSettings, onKeyUp, setInteraction]);

  useEffect(() => {
    const current = getState();
    window.speechSynthesis.cancel();
    setStateMerged({
      yesClicked: false,
      noClicked: false,
      showQuestionPinyin: false,
      pauseAutoRecord: false,
    });

    if (current.questionCategory === 'pinyin' && current.useSound && current.chosenCharacter) {
      onSpeak(current.chosenCharacter, current.useAutoRecord);
    }

    if (current.useAutoRecord && !(current.questionCategory === 'pinyin' && current.useSound)) {
      if (current.answerCategory === 'pinyin') {
        onListen();
      }
      if (current.answerCategory === 'meaning') {
        if (!current.useFlashcards) {
          onListen();
        }
      }
    }
    if (current.answerCategory === 'character' && typeof current.answer === 'string') {
      setHanziWriter(current.answer);
    }
  }, [state.qNum, getState, onListen, onSpeak, setHanziWriter, setStateMerged]);

  const progressNum = Math.floor((state.permList.length / state.initNumPerms) * 100) || 0;

  const textInput = (
    <Input
      id="answer-input"
      keyPressed={onKeyPress}
      value={state.answerInput}
      changed={onInputChanged}
      focussed={onFocusEntry}
      autoFocus={true}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );

  const buttonStyle = { display: 'inline-block', width: '50px', height: '50px', margin: '10px 20px' };
  const activeButtonStyle = { ...buttonStyle, boxShadow: '0px 0px', transform: 'translateY(3px)' };

  const showAnswerContent = state.showAnswer ? (
    <div>
      <PictureButton
        style={state.yesClicked ? activeButtonStyle : buttonStyle}
        clicked={onCorrectAnswer}
        src={likePic}
      />
      <PictureButton
        style={state.noClicked ? activeButtonStyle : buttonStyle}
        clicked={() => {
          if (state.useSound) fail.play();
          onIDontKnow();
        }}
        src={dislikePic}
      />
    </div>
  ) : (
    <Button style={{ width: '230px', margin: '0 auto' }} clicked={onShowAnswer}>
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
      <PictureButton colour="yellow" src={micPic} clicked={() => onListen()} />
      <Toggle
        checked={state.useAutoRecord}
        changed={(event) => {
          state.recognition?.abort();
          setStateMerged({ useAutoRecord: event.target.checked });
          if (event.target.checked) onListen();
        }}
      />
      {state.showInput ? (
        <Input
          id="secondary-input"
          keyPressed={onKeyPress}
          value={state.answerInput}
          changed={onInputChanged}
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

  switch (state.answerCategory) {
    case 'pinyin':
      if (state.useChineseSpeechRecognition) {
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
      if (state.useFlashcards) {
        inputFormat = showAnswerContent;
        verb = 'What is the ';
      } else if (state.useEnglishSpeechRecognition) {
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
    state.questionCategory === 'meaning' && Array.isArray(state.question)
      ? state.question.join(' / ')
      : state.question;

  let questionFormat: React.ReactNode = <h2>{questionText}</h2>;

  if (state.questionCategory === 'pinyin' && state.useSound && !state.showPinyin) {
    questionFormat = (
      <Aux>
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: '100px' }}>
          {state.synthLoading ? (
            <Spinner style={{ overflow: 'hidden', margin: '0 auto' }} />
          ) : (
            <PictureButton
              colour="grey"
              src={speakerPic}
              clicked={() => state.chosenCharacter && onSpeak(state.chosenCharacter)}
            />
          )}
        </div>
        {state.showQuestionPinyin ? <p style={{ color: 'black' }}>{state.question}</p> : null}
        <button onClick={onToggleShowPinyin} className={classes.PinyinToggle}>
          {state.showQuestionPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
        </button>
      </Aux>
    );
  }

  const pinyinQuestionWithSound = state.questionCategory === 'pinyin' && state.useSound;
  const pinyinAnswerMeaningQuestion =
    state.answerCategory === 'pinyin' && state.questionCategory === 'meaning';
  const meaningAnswer = state.answerCategory === 'meaning';

  if (state.testSet.length !== 0 || props.isDemo) {
    return (
      <Aux>
        <Backdrop show={state.testFinished} />
        <Modal
          show={state.testFinished}
        >
          <TestSummary
            continueAvailable={(state.sentenceWords.length > 0 && !props.finalStage) || props.isDemo}
            continueClicked={() => props.startSentenceRead?.(state.sentenceWords)}
            scores={state.scoreList}
          />
        </Modal>
        <div className={classes.Test}>
          <ProgressBar progress={progressNum} />
          <h3 id="q-phrase-box">
            {verb}
            <span>{state.answerCategory}</span> for...
          </h3>
          <div className={classes.QuestionCard}>{questionFormat}</div>
          <p className={classes.Result}>{state.result}</p>
          <div className={classes.InputDiv}>{inputFormat}</div>
          <div style={{ paddingTop: '30px', display: 'flex', justifyContent: 'center' }}>
            <Button disabled={state.idkDisabled || state.showAnswer} clicked={onIDontKnow} id="idk">
              I Don't Know
            </Button>
            <Button
              disabled={
                (!pinyinQuestionWithSound &&
                  !pinyinAnswerMeaningQuestion &&
                  !meaningAnswer &&
                  state.answerCategory !== 'character') ||
                state.showAnswer
              }
              clicked={onHint}
            >
              {state.questionCategory === 'pinyin' && state.useSound
                ? 'Hint'
                : state.showHint
                  ? 'Hide Hint'
                  : 'Show Hint'}
            </Button>
            {state.questionCategory === 'pinyin' &&
            state.useSound &&
            state.chosenCharacter?.length === 1 ? (
              <Button clicked={showCharacter}>
                {state.result === state.chosenCharacter ? 'Hide Character' : 'Show Character'}
              </Button>
            ) : null}
          </div>
        </div>
      </Aux>
    );
  }

  return (
    <Modal show={state.showErrorMessage}>
      <p>You have no words due for testing!</p>
      <Button clicked={onClickAddWords}>Add Words</Button>
    </Modal>
  );
};

export default withRouter(connector(Test));
