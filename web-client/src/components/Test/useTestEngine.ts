import { AudioSettings } from '../../utils/audioSettings';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';

import * as testLogic from './Logic/TestLogic';
import { beep, fail, createInitialState } from './constants';
import { Props, TestState, TestStateUpdate } from './types';
import { WordScore } from '../../types/models';
import { checkSentenceAvailability, getHintSentence } from '../../services/sentenceService';
import * as ttsService from '../../services/ttsService';

export const useTestEngine = (props: Props) => {
  const [state, setState] = useState<TestState>(() => createInitialState(props));
  const stateRef = useRef(state);
  const submitSpeechRef = useRef<(speech: string) => void>(() => {});
  const onListenRef = useRef<() => void>(() => {});
  const initializedRef = useRef(false);

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

  // --- Navigation ---

  const onHomeClicked = useCallback((): void => {
    props.history.push('/');
  }, [props.history]);

  const onClickAddWords = useCallback((): void => {
    props.history.push('/add-words');
  }, [props.history]);

  // --- Input handling ---

  const onFocusEntry = useCallback((e: React.FocusEvent<HTMLInputElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById('q-phrase-box');
    if (el) {
      window.scrollTo(0, el.offsetTop - 5);
    }
  }, []);

  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const current = getState();
      current.recognition?.abort();
      setStateMerged({ answerInput: e.target.value, pauseAutoRecord: true });
    },
    [getState, setStateMerged],
  );

  // --- Speech ---

  const onListen = useCallback((): void => {
    const current = getState();
    ttsService.stopAll();
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

      ttsService.speak(word, {
        fallbackVoice: props.voice,
        fallbackLang: props.lang || 'zh-CN',
        onStart: () => {
          setStateMerged({ synthLoading: false });
        },
        onEnd: () => {
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
        },
        onError: () => {
          setStateMerged({ result: 'Error playing pinyin', showPinyin: true });
        },
      });
    },
    [getState, onListen, props.lang, props.voice, setStateMerged],
  );

  // --- Score sending ---

  const onSendScores = useCallback(
    (testResults: { word_id: number; score: number }[]): void => {
      if (props.isDemo) return;
      props.onFinishTest(testResults);
    },
    [props.isDemo, props.onFinishTest],
  );

  // --- Test flow ---

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
    const sentenceWords: import('../../types/models').Word[] = [];

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

      if (count === 0 && (word.bank === 1 || props.practiceMode)) {
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

    if (!props.isDemo && !props.practiceMode) {
      onSendScores(sendScores);
    }

    if (sentenceWords.length === 0 || props.isDemo) {
      setStateMerged({
        testFinished: true,
        scoreList: wordScores,
        sentenceWords,
        sentenceCheckStatus: props.isDemo && sentenceWords.length > 0 ? 'available' : 'idle',
      });
      if (!props.isDemo) {
        props.onVocabComplete?.(wordScores);
      } else if (sentenceWords.length > 0 && !props.finalStage) {
        setTimeout(() => {
          props.startSentenceRead?.(sentenceWords, wordScores);
        }, 1000);
      }
    } else {
      setStateMerged({
        testFinished: true,
        scoreList: wordScores,
        sentenceWords,
        sentenceCheckStatus: 'pending',
      });

      Promise.all(
        sentenceWords.map((w) =>
          checkSentenceAvailability(w.simp, current.charSet)
            .then((available) => (available ? w : null))
            .catch(() => null),
        ),
      ).then((results) => {
        const available = results.filter((w): w is import('../../types/models').Word => w !== null);
        if (available.length > 0 && !props.finalStage) {
          setStateMerged({
            sentenceWords: available,
            sentenceCheckStatus: 'available',
          });
          props.startSentenceRead?.(available, wordScores);
        } else {
          setStateMerged({
            sentenceWords: available,
            sentenceCheckStatus: 'unavailable',
          });
          props.onVocabComplete?.(wordScores);
        }
      });
    }
  }, [
    getState,
    onSendScores,
    props.isDemo,
    props.practiceMode,
    props.finalStage,
    props.onVocabComplete,
    props.startSentenceRead,
    setStateMerged,
  ]);

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
      if (current.useSoundEffects) {
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
          current.priority,
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
    [getState, setStateMerged, onFinishTest],
  );

  const checkAnswer = useCallback(
    (cleanInput: string): boolean => {
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
    },
    [getState],
  );

  const onSubmitAnswer = useCallback((): void => {
    const current = getState();
    if (checkAnswer(current.answerInput)) {
      onCorrectAnswer();
    } else {
      if (current.useSoundEffects) {
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
      if (current.useAutoRecord && !current.pauseAutoRecord && !current.useTypingInput) {
        onListen();
      }
    }

    current.recognition?.abort();
  }, [checkAnswer, getState, onCorrectAnswer, onListen, setStateMerged]);

  const submitSpeech = useCallback(
    (speech: string): void => {
      const current = getState();
      const numToPinMap = [
        'ling3',
        'yi1',
        'er4',
        'san1',
        'si4',
        'wu3',
        'liu4',
        'qi1',
        'ba1',
        'jiu3',
        'shi2',
      ];

      let submission: string;

      if (current.answerCategory === 'pinyin') {
        const asPinyin = pinyin(speech, { toneType: 'num', type: 'array' });
        const mapped = asPinyin.map((char) => {
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
        if (current.useSoundEffects) {
          fail.play();
        }
        let sentence = 'Try different tones...';
        if (current.chosenCharacter?.length === 1) {
          sentence = 'Try a different tone...';
        }

        if (current.numSpeakTries > 0) {
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
        if (current.useAutoRecord && !current.pauseAutoRecord && !current.useTypingInput) {
          setTimeout(() => onListenRef.current(), 1500);
        }
      } else {
        if (current.useSoundEffects) {
          fail.play();
        }
        if (current.numSpeakTries > 0) {
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
        if (current.useAutoRecord && !current.pauseAutoRecord && !current.useTypingInput) {
          setTimeout(() => onListenRef.current(), 1500);
        }
      }
    },
    [getState, onCorrectAnswer, setStateMerged],
  );

  useEffect(() => {
    submitSpeechRef.current = submitSpeech;
  }, [submitSpeech]);

  useEffect(() => {
    onListenRef.current = onListen;
  }, [onListen]);

  // --- Hanzi Writer ---

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
              } catch (e) {
                // ignore
              }
              onCorrectAnswer();
            }, 1000);
          }
        },
      });
    },
    [onCorrectAnswer, setStateMerged],
  );

  const updateHanziWriterQuiz = (
    writer: HanziWriterInstance,
    char: string,
    index: number,
  ): void => {
    writer.setCharacter(char[index]);
    quizWriter(writer, char, index);
  };

  const setHanziWriter = useCallback(
    (char: string): void => {
      const index = 0;
      const flashChar = false;
      let numBeforeHint = 5;

      if (props.isDemo) {
        numBeforeHint = 1;
      }

      try {
        const el = document.getElementById('character-target-div');
        if (el) el.innerHTML = '';
      } catch (e) {
        // ignore
      }

      const writer = window.HanziWriter.create('character-target-div', char[index], {
        width: 150,
        height: 150,
        padding: 20,
        showOutline: false,
        showCharacter: flashChar,
        showHintAfterMisses: numBeforeHint,
        delayBetweenStrokes: 10,
        strokeAnimationSpeed: 1,
        outlineColor: '#555',
      });

      setStateMerged({ writer });
      quizWriter(writer, char, index);
    },
    [props.isDemo, quizWriter, setStateMerged],
  );

  const updateHanziWriterAnimate = (
    writer: HanziWriterInstance,
    char: string,
    index: number,
  ): void => {
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
          } catch (e) {
            // ignore
          }
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
            latest.priority,
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
            numSpeakTries: 0,
            redoChar: redoChar,
            qNum: prevState.qNum + 1,
          }));
        }
      });
    },
    [getState, setStateMerged],
  );

  const onIdkChar = useCallback(
    (writer: HanziWriterInstance, char: string): void => {
      setStateMerged({ idkDisabled: true });
      writer.cancelQuiz();
      const index = 0;
      writer.setCharacter(char[index]);
      animateWriter(writer, char, index);
    },
    [animateWriter, setStateMerged],
  );

  // --- I Don't Know ---

  const onIDontKnow = useCallback((): void => {
    const current = getState();
    current.recognition?.abort();
    ttsService.stopAll();

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
      current.priority,
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
        numSpeakTries: 0,
        qNum: prevState.qNum + 1,
        showInput: false,
        submitDisabled: false,
        showHint: false,
        showAnswer: false,
      }));
    }, 2000);
  }, [getState, onIdkChar, setStateMerged]);

  // --- Key press (input submit) ---

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const current = getState();
      if (e.key !== 'Enter' || current.submitDisabled || current.answerInput === '') {
        return;
      }
      onSubmitAnswer();
      setStateMerged({ answerInput: '' });
    },
    [getState, onSubmitAnswer, setStateMerged],
  );

  // --- Hints ---

  const showSentenceHint = useCallback(
    (word: string): void => {
      setStateMerged({ hintLoading: true });
      getHintSentence(word)
        .then((sentence) => {
          const current = getState();
          if (!sentence) {
            setStateMerged({ result: 'No example sentence found', hintLoading: false });
            return;
          }
          if (current.useSound) {
            onSpeak(sentence.chinese);
            setStateMerged({ hintLoading: false, showHint: true });
          } else {
            const pinyinResult = pinyin(sentence.chinese, { toneType: 'num' });
            setStateMerged({
              result: pinyinResult,
              showHint: true,
              hintLoading: false,
            });
          }
        })
        .catch(() => {
          setStateMerged({ result: 'Could not load hint', hintLoading: false });
        });
    },
    [getState, onSpeak, setStateMerged],
  );

  const onHint = useCallback((): void => {
    const current = getState();
    if (current.showHint) {
      if (current.answerCategory === 'character' && current.writer) {
        current.writer.hideOutline();
      }
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
        current.writer!.hideOutline();
      }, 1000);
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

  // --- Initialization ---

  const onInitialiseTestSet = useCallback(
    (useHandwriting: boolean): void => {
      const current = getState();
      const permList = testLogic.setPermList(
        props.words,
        useHandwriting,
        current.priority,
        current.onlyPriority,
      );
      const initialVals = testLogic.assignQA(
        props.words,
        permList,
        current.charSet,
        current.priority,
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
    [getState, props.words, setStateMerged],
  );

  const initialiseSettings = useCallback((): void => {
    const useSound =
      props.synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(props.isDemo));
    const useSoundEffects =
      !(localStorage.getItem('useSoundEffects') === 'false') || Boolean(props.isDemo);
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
      useSoundEffects,
      useHandwriting,
      useChineseSpeechRecognition,
      useEnglishSpeechRecognition,
      useFlashcards,
    });

    onInitialiseTestSet(useHandwriting);
  }, [
    onInitialiseTestSet,
    props.isDemo,
    props.speechAvailable,
    props.synthAvailable,
    setStateMerged,
  ]);

  // --- Keyboard shortcuts ---

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
          // Transitions are now handled by callbacks; ignore spacebar here
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
          if (current.useSoundEffects) {
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
    [
      getState,
      onCorrectAnswer,
      onHint,
      onHomeClicked,
      onIDontKnow,
      onListen,
      onShowAnswer,
      onSpeak,
      onToggleShowPinyin,
      props.finalStage,
      props.isDemo,
      props.startSentenceRead,
      setStateMerged,
    ],
  );

  // --- Effects ---

  useEffect(() => {
    if (!initializedRef.current) {
      initialiseSettings();
      initializedRef.current = true;
    }
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mouseover', setInteraction);
    document.addEventListener('scroll', setInteraction);
    document.addEventListener('keydown', setInteraction);

    return () => {
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mouseover', setInteraction);
      document.removeEventListener('scroll', setInteraction);
      document.removeEventListener('keydown', setInteraction);
      ttsService.stopAll();
    };
  }, [initialiseSettings, onKeyUp, setInteraction]);

  useEffect(() => {
    const current = getState();

    if (current.testFinished) return;

    ttsService.stopAll();
    setStateMerged({
      yesClicked: false,
      noClicked: false,
      showQuestionPinyin: false,
      pauseAutoRecord: false,
    });

    if (current.questionCategory === 'pinyin' && current.useSound && current.chosenCharacter) {
      onSpeak(current.chosenCharacter, current.useAutoRecord);
    }

    if (
      current.useAutoRecord &&
      !current.useTypingInput &&
      !(current.questionCategory === 'pinyin' && current.useSound)
    ) {
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

  const refreshSettings = useCallback(
    (updated: AudioSettings): void => {
      setStateMerged({
        useSound: updated.useSound && Boolean(props.synthAvailable),
        useSoundEffects: updated.useSoundEffects,
        useChineseSpeechRecognition:
          updated.useChineseSpeechRecognition && Boolean(props.speechAvailable),
        useEnglishSpeechRecognition:
          updated.useEnglishSpeechRecognition && Boolean(props.speechAvailable),
        useAutoRecord: updated.useAutoRecord,
        useFlashcards: updated.useFlashcards,
      });
    },
    [props.speechAvailable, props.synthAvailable, setStateMerged],
  );

  return {
    state,
    setStateMerged,
    onHomeClicked,
    onClickAddWords,
    onFocusEntry,
    onInputChanged,
    onKeyPress,
    onListen,
    onSpeak,
    onCorrectAnswer,
    onSubmitAnswer,
    onIDontKnow,
    onHint,
    onShowAnswer,
    onToggleShowPinyin,
    showCharacter,
    refreshSettings,
  };
};
