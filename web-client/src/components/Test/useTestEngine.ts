import { AudioSettings, QuizType, getQuizType } from '../../utils/audioSettings';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';

import * as testLogic from './Logic/TestLogic';
import { beep, fail, createInitialState } from './constants';
import { Props, TestState, TestStateUpdate } from './types';
import {
  Direction,
  DirectionFailure,
  DirectionResult,
  WordDirectionResults,
  WordScore,
} from '../../types/models';
import { isNewWord } from '../../utils/directions';
import { checkSentenceAvailability, getHintSentence } from '../../services/sentenceService';
import * as ttsService from '../../services/ttsService';
import { reportError } from '../../services/errorReporting';

// Quiz type governing the current answer; character answers are always handwriting
const answerQuizType = (state: TestState): QuizType | null => {
  if (state.answerCategory === 'pinyin') return state.pinyinQuizType;
  if (state.answerCategory === 'meaning') return state.meaningQuizType;
  return null;
};

/**
 * Clear the HanziWriter mount point.
 *
 * The three call sites used to swallow the error here, which hid a broken
 * HanziWriter mount. The DOM work is cheap, so the report is a warning.
 */
const clearCharacterTarget = (): void => {
  try {
    const el = document.getElementById('character-target-div');
    if (el) el.innerHTML = '';
  } catch (error) {
    reportError(error, { feature: 'hanzi-writer', level: 'warning' });
  }
};

export const useTestEngine = (props: Props) => {
  const [state, setState] = useState<TestState>(() => createInitialState(props));
  const stateRef = useRef(state);
  const submitSpeechRef = useRef<(speech: string) => void>(() => {});
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
        setStateMerged({ result: "Couldn't hear anything..." });
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
          if (auto && props.speechAvailable && answerQuizType(latest) === 'input') {
            onListen();
          }
        },
        onError: () => {
          setStateMerged({ result: 'Error playing pinyin', showPinyin: true });
        },
      });
    },
    [getState, onListen, props.lang, props.speechAvailable, props.voice, setStateMerged],
  );

  // --- Failures ---

  /**
   * The (word, direction) pair the current question asks, recorded when the
   * learner does not know it. Returns null when there is no current question,
   * which the two call sites already guard against by other means.
   */
  const currentFailure = (state: TestState): DirectionFailure | null => {
    if (!state.perm) return null;
    const word = state.testSet[parseInt(state.perm.index)];
    if (!word) return null;
    return { wordId: word.id, direction: testLogic.directionOf(state.perm) };
  };

  // --- Score sending ---

  const onSendResults = useCallback(
    (testResults: WordDirectionResults[]): void => {
      if (props.isDemo) return;
      props.onFinishTest(testResults);
    },
    [props.isDemo, props.onFinishTest],
  );

  // --- Test flow ---

  const onFinishTest = useCallback((): void => {
    const current = getState();
    const answerInput = document.getElementById('answer-input');

    if (answerInput !== null) {
      (answerInput as HTMLInputElement).blur();
    }

    // The directions each word failed, by word id. A word that the learner knew
    // in every direction has no entry.
    const failedByWord = new Map<number, Set<Direction>>();
    for (const { wordId, direction } of current.idkList) {
      const failed = failedByWord.get(wordId);
      if (failed) {
        failed.add(direction);
      } else {
        failedByWord.set(wordId, new Set([direction]));
      }
    }

    const wordScores: WordScore[] = [];
    const sendResults: WordDirectionResults[] = [];
    const sentenceWords: import('../../types/models').Word[] = [];

    current.testSet.forEach((word) => {
      const failed = failedByWord.get(word.id);

      // The sentence stages still gate on the word as a whole: they are a
      // reward for a clean run, and issue #339 revisits what should gate them.
      if (!failed && (isNewWord(word) || props.practiceMode || props.sentenceStagesForAllWords)) {
        sentenceWords.push(word);
      }

      const directions: Partial<Record<Direction, DirectionResult>> = {};
      for (const direction of current.askedDirections) {
        const result: DirectionResult = failed?.has(direction) ? 'fail' : 'pass';
        directions[direction] = result;
        // One summary row per direction the session asked.
        wordScores.push({ char: word[current.charSet], direction, result });
      }

      sendResults.push({ word_id: word.id, directions });
    });

    if (!props.isDemo && !props.practiceMode) {
      onSendResults(sendResults);
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
            .catch((error) => {
              reportError(error, {
                feature: 'sentence-availability',
                context: { simp: w.simp },
              });
              return null;
            }),
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
    onSendResults,
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
        idkDisabled: true,
        submitDisabled: true,
        // Flashcard grading: mark the button pressed however it was triggered.
        yesClicked: current.showAnswer,
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
        const newQuestion = testLogic.assignQA(current.testSet, newPermList, current.charSet);
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

  // Shared submission path for typed and spoken answers. On a wrong answer the
  // input is left untouched so the user can edit and resubmit it.
  const submitAnswer = useCallback(
    (input: string, usedSpeech = false): void => {
      const current = getState();
      if (checkAnswer(input)) {
        onCorrectAnswer(usedSpeech);
      } else {
        if (current.useSoundEffects) {
          fail.play();
        }
        let resultString = 'Try again';

        if (current.answerCategory === 'pinyin' && typeof current.answer === 'string') {
          const cleanAnswer = current.answer.replace(/ /g, '').toLowerCase();
          const cleanInput = input.trim().replace(/ /g, '').toLowerCase();

          if (testLogic.toneChecker(cleanInput, cleanAnswer)) {
            resultString = 'Incorrect tones';
          }
        }

        setStateMerged({ result: resultString, showHint: false });
        if (
          current.useAutoRecord &&
          !current.pauseAutoRecord &&
          props.speechAvailable &&
          answerQuizType(current) === 'input'
        ) {
          onListen();
        }
      }

      current.recognition?.abort();
    },
    [checkAnswer, getState, onCorrectAnswer, onListen, props.speechAvailable, setStateMerged],
  );

  const onSubmitAnswer = useCallback((): void => {
    submitAnswer(getState().answerInput);
  }, [getState, submitAnswer]);

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

      // Put the transcript in the input so a wrong answer can be edited there
      setStateMerged({ answerInput: submission });

      // Chinese speech recognition returns hanzi; an exact match on the target
      // word is correct even if its derived pinyin reading differs
      if (speech === current.chosenCharacter) {
        onCorrectAnswer(true);
        return;
      }

      submitAnswer(submission, true);
    },
    [getState, onCorrectAnswer, setStateMerged, submitAnswer],
  );

  useEffect(() => {
    submitSpeechRef.current = submitSpeech;
  }, [submitSpeech]);

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
              clearCharacterTarget();
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

      clearCharacterTarget();

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
          clearCharacterTarget();
          setStateMerged((prevState) => {
            const failure = currentFailure(prevState);
            return {
              idkList: failure ? prevState.idkList.concat(failure) : prevState.idkList,
            };
          });

          const latest = getState();
          // A revealed direction is answered, so it leaves the queue: the queue
          // is read in order now, and leaving it in would ask it forever.
          const newPermList = latest.permList.filter((perm) => perm !== latest.perm);
          setStateMerged({ permList: newPermList });

          if (newPermList.length === 0) {
            onFinishTest();
            setStateMerged({ result: 'Finished!' });
            return;
          }

          const newQuestion = testLogic.assignQA(latest.testSet, newPermList, latest.charSet);

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
            // The question just left the queue, so it cannot be the next one.
            redoChar: false,
            qNum: prevState.qNum + 1,
          }));
        }
      });
    },
    [getState, onFinishTest, setStateMerged],
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
      const failure = currentFailure(prevState);
      // In flashcard mode the answer is already on screen, so the feedback line
      // reports the grade instead of repeating the reveal text unchanged.
      return {
        idkList: failure ? prevState.idkList.concat(failure) : prevState.idkList,
        idkDisabled: true,
        submitDisabled: true,
        result: prevState.showAnswer
          ? `Not known — answer was: '${displayAnswer}'`
          : `Answer was: '${displayAnswer}'`,
        noClicked: prevState.showAnswer,
      };
    });

    // As above: the direction was revealed, so it leaves the queue.
    const newPermList = current.permList.filter((perm) => perm !== current.perm);
    setStateMerged({ permList: newPermList });

    if (newPermList.length === 0) {
      // Let the reveal stand for a moment before the summary replaces it.
      setTimeout(() => {
        onFinishTest();
        setStateMerged({ result: 'Finished!' });
      }, 2000);
      return;
    }

    const newQuestion = testLogic.assignQA(current.testSet, newPermList, current.charSet);

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
        submitDisabled: false,
        showHint: false,
        hintLoading: false,
        showAnswer: false,
      }));
    }, 2000);
  }, [getState, onFinishTest, onIdkChar, setStateMerged]);

  // --- Key press (input submit) ---

  // A wrong answer stays in the input for editing; correct answers are cleared
  // when the next question loads.
  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const current = getState();
      if (e.key !== 'Enter' || current.submitDisabled || current.answerInput === '') {
        return;
      }
      onSubmitAnswer();
    },
    [getState, onSubmitAnswer],
  );

  // --- Hints ---

  const showSentenceHint = useCallback(
    (word: string): void => {
      setStateMerged({ hintLoading: true });
      getHintSentence(word)
        .then((sentence) => {
          const current = getState();
          // The question can move on while the sentence loads. Drop a late
          // answer so a hint never lands on the wrong word.
          if (current.chosenCharacter !== word) {
            setStateMerged({ hintLoading: false });
            return;
          }
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
          if (getState().chosenCharacter !== word) {
            setStateMerged({ hintLoading: false });
            return;
          }
          setStateMerged({ result: 'Could not load hint', hintLoading: false });
        });
    },
    [getState, onSpeak, setStateMerged],
  );

  const onHint = useCallback((): void => {
    const current = getState();
    if (current.hintLoading) {
      return;
    }
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
      // One question per word, except a new word, which fans out. The budget
      // is in questions: five per word keeps a session the length it was
      // before the queue existed, until PR 5 lands `questionsPerSession`.
      const plan = testLogic.planSession(props.words, {
        budget: current.numWords * 5,
        includeHandwriting: useHandwriting,
        priority: current.priority,
        onlyPriority: current.onlyPriority,
        practiceMode: Boolean(props.practiceMode),
      });
      const permList = plan.queue;

      if (permList.length === 0) {
        // Reachable when every candidate's only due direction is one the
        // session does not ask — handwriting switched off, say. Go straight to
        // the summary rather than showing a question that does not exist. This
        // submits nothing, so no schedule moves and no streak is recorded.
        setStateMerged({
          testSet: plan.words,
          permList,
          initNumPerms: 0,
          askedDirections: [],
          scoreList: [],
          testFinished: true,
        });
        return;
      }

      const initialVals = testLogic.assignQA(plan.words, permList, current.charSet);
      setStateMerged((prevState) => ({
        testSet: plan.words,
        permList: permList,
        perm: initialVals.perm,
        answer: initialVals.answer,
        answerCategory: initialVals.answerCategory,
        question: initialVals.question,
        questionCategory: initialVals.questionCategory,
        chosenCharacter: initialVals.chosenCharacter,
        initNumPerms: permList.length,
        askedDirections: testLogic.directionsOf(permList),
        showErrorMessage: false,
        qNum: prevState.qNum + 1,
      }));
    },
    [getState, props.practiceMode, props.words, setStateMerged],
  );

  const initialiseSettings = useCallback((): void => {
    const useSound =
      props.synthAvailable &&
      (!(localStorage.getItem('useSound') === 'false') || Boolean(props.isDemo));
    const useSoundEffects =
      !(localStorage.getItem('useSoundEffects') === 'false') || Boolean(props.isDemo);
    const useHandwriting =
      !(localStorage.getItem('useHandwriting') === 'false') || Boolean(props.isDemo);

    const meaningQuizType: QuizType = props.isDemo ? 'flashcard' : getQuizType('meaning');
    const pinyinQuizType: QuizType = props.isDemo ? 'input' : getQuizType('pinyin');
    const useAutoRecord = localStorage.getItem('useAutoRecord') === 'true' && !props.isDemo;

    setStateMerged({
      useSound,
      useSoundEffects,
      useHandwriting,
      meaningQuizType,
      pinyinQuizType,
      useAutoRecord,
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
      const currentQuizType = answerQuizType(current);
      const micAvailable =
        props.speechAvailable &&
        currentQuizType === 'input' &&
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
          if (currentQuizType === 'flashcard') {
            onShowAnswer();
          } else if (micAvailable && current.answerCategory === 'pinyin') {
            onListen();
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
        if (answerInput !== null) {
          answerInput.focus();
        }
      }

      if (event.key === 'ArrowUp') {
        if (current.showAnswer && !current.idkDisabled) {
          onCorrectAnswer();
        }
      }

      if (event.key === 'ArrowDown') {
        if (current.showAnswer && !current.idkDisabled) {
          if (current.useSoundEffects) {
            fail.play();
          }
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

      // Ctrl+i has its own branch above, so it must not fall through to this
      // one as well: it did, and one keypress then ran onIDontKnow twice.
      if (event.key === 'i' && !event.ctrlKey) {
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
      props.speechAvailable,
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
      props.speechAvailable &&
      answerQuizType(current) === 'input' &&
      !(current.questionCategory === 'pinyin' && current.useSound)
    ) {
      onListen();
    }
    if (current.answerCategory === 'character' && typeof current.answer === 'string') {
      setHanziWriter(current.answer);
    }
  }, [
    state.qNum,
    getState,
    onListen,
    onSpeak,
    props.speechAvailable,
    setHanziWriter,
    setStateMerged,
  ]);

  const refreshSettings = useCallback(
    (updated: AudioSettings): void => {
      setStateMerged({
        useSound: updated.useSound && Boolean(props.synthAvailable),
        useSoundEffects: updated.useSoundEffects,
        useAutoRecord: updated.useAutoRecord,
        meaningQuizType: updated.meaningQuizType,
        pinyinQuizType: updated.pinyinQuizType,
      });
    },
    [props.synthAvailable, setStateMerged],
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
