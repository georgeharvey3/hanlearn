import { AudioSettings, QuizType, getQuizType } from '../../utils/audioSettings';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pinyin } from 'pinyin-pro';

import * as testLogic from './Logic/TestLogic';
import { beep, fail, createInitialState } from './constants';
import { Props, TestState, TestStateUpdate } from './types';
import {
  Direction,
  DirectionGrade,
  DirectionResult,
  WordDirectionResults,
  WordScore,
} from '../../types/models';
import { isNewWord, readyForWriteStage } from '../../utils/directions';
import { checkSentenceAvailability, getHintSentence } from '../../services/sentenceService';
import * as ttsService from '../../services/ttsService';
import { reportError } from '../../services/errorReporting';

/**
 * Misses on one stroke before the handwriting quiz shows the stroke outline.
 *
 * The demo shows the outline sooner, so that a visitor sees the whole quiz in a
 * few strokes. The demo grades nothing, so the two numbers never disagree about
 * a grade the scheduler reads.
 */
const MISSES_BEFORE_HINT = 5;
const DEMO_MISSES_BEFORE_HINT = 1;

// Quiz type governing the current answer; character answers are always handwriting
const answerQuizType = (state: TestState): QuizType | null => {
  if (state.answerCategory === 'pinyin') return state.pinyinQuizType;
  if (state.answerCategory === 'meaning') return state.meaningQuizType;
  return null;
};

/**
 * The characters to offer a component breakdown for once a question is graded.
 *
 * Only a question that puts the character on screen has components worth
 * showing, so `MP` and `PM` — pinyin and meaning alone — get none. A `pass`
 * gets none either: the breakdown is the aid for a direction the learner has
 * just lost, which is what issue #335 asks for.
 */
const componentsToReview = (state: TestState, result: DirectionResult): string[] => {
  if (result === 'pass') return [];
  if (state.answerCategory !== 'character' && state.questionCategory !== 'character') return [];
  return Array.from(state.chosenCharacter ?? '');
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
  const applySpeechRef = useRef<(speech: string) => void>(() => {});
  const initializedRef = useRef(false);
  const missesBeforeHint = props.isDemo ? DEMO_MISSES_BEFORE_HINT : MISSES_BEFORE_HINT;

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

  // The step that moves the session on from a graded question, while the
  // component review holds it. It is a ref rather than state because Continue
  // must run exactly the step the grade decided, not one rebuilt from state.
  const pendingAdvanceRef = useRef<(() => void) | null>(null);

  /**
   * Run the step that ends a question, or hold it for the component review.
   *
   * `chars` empty is the ordinary path: the step runs after `delay`, or at once
   * when the delay is 0. A missed character question hands its characters here
   * instead, and the step then waits for Continue. See issue #335.
   */
  const holdOrAdvance = useCallback(
    (chars: string[], advance: () => void, delay: number): void => {
      if (chars.length === 0) {
        if (delay > 0) {
          setTimeout(advance, delay);
        } else {
          advance();
        }
        return;
      }
      pendingAdvanceRef.current = advance;
      setStateMerged({ componentReviewChars: chars, showComponents: false });
    },
    [setStateMerged],
  );

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
      applySpeechRef.current(result.toLowerCase());
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

  // --- Grades ---

  /**
   * The grade of the current question. Returns null when there is no current
   * question, which every call site already guards against by other means.
   */
  const currentGrade = (state: TestState, result: DirectionResult): DirectionGrade | null => {
    if (!state.currentPair) return null;
    const word = state.testSet[parseInt(state.currentPair.index)];
    if (!word) return null;
    return {
      wordId: word.id,
      direction: testLogic.directionOf(state.currentPair),
      result,
      toneErrors: state.toneErrorCount,
    };
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

  /**
   * Close the session and submit what it graded.
   *
   * `lastGrade` is the grade of the question that emptied the queue. A grade is
   * written with setStateMerged, and `getState` reads a ref that React updates
   * after the render, so the last one is not in state yet when a caller
   * finishes in the same tick. A caller that already waited passes it again,
   * and the identity check below drops the duplicate.
   */
  const onFinishTest = useCallback(
    (lastGrade?: DirectionGrade | null): void => {
      const current = getState();
      const gradeList =
        lastGrade && !current.gradeList.includes(lastGrade)
          ? current.gradeList.concat(lastGrade)
          : current.gradeList;
      const answerInput = document.getElementById('answer-input');

      if (answerInput !== null) {
        (answerInput as HTMLInputElement).blur();
      }

      // The grades of each word, by word id. A word the session did not reach —
      // the queue can only run out at the end, so this is the empty case — has no
      // entry, and nothing is written for it.
      const gradesByWord = new Map<number, DirectionGrade[]>();
      for (const grade of gradeList) {
        const graded = gradesByWord.get(grade.wordId);
        if (graded) graded.push(grade);
        else gradesByWord.set(grade.wordId, [grade]);
      }

      const wordScores: WordScore[] = [];
      const sendResults: WordDirectionResults[] = [];
      // The two sentence stages take separate word lists, because input and
      // output suit opposite ends of learning a word. Read takes the words the
      // learner has just met, and Write takes the ones they already half know.
      // See docs/adr/0011-gate-the-write-stage-on-partial-mastery.md.
      const readWords: import('../../types/models').Word[] = [];
      const writeWords: import('../../types/models').Word[] = [];

      current.testSet.forEach((word) => {
        const graded = gradesByWord.get(word.id) ?? [];

        // Both stages gate on the word as a whole, and a fail blocks either:
        // they are a reward for a clean run.
        const failed = graded.some((grade) => grade.result === 'fail');
        if (!failed) {
          if (isNewWord(word) || props.practiceMode || props.sentenceStagesForAllWords) {
            readWords.push(word);
          }
          // The gate is read from the state the word held when the session
          // started, so a word that reaches the bar on this run writes its
          // first sentence on the next one. The demo is a tour of the stages
          // rather than a study session, so its one word reaches both.
          if (readyForWriteStage(word) || props.isDemo) {
            writeWords.push(word);
          }
        }

        const directions: Partial<Record<Direction, DirectionResult>> = {};
        const toneErrors: Partial<Record<Direction, number>> = {};
        for (const grade of graded) {
          directions[grade.direction] = grade.result;
          if (grade.toneErrors > 0) toneErrors[grade.direction] = grade.toneErrors;
          // One summary row per question, which is one direction of one word.
          wordScores.push({
            char: word[current.charSet],
            direction: grade.direction,
            result: grade.result,
          });
        }

        if (graded.length === 0) return;
        sendResults.push({ word_id: word.id, directions, toneErrors });
      });

      if (!props.isDemo && !props.practiceMode) {
        onSendResults(sendResults);
      }

      // One check per word, however many stages want it. The two lists overlap
      // only when the learner asked for the Read stage on every word.
      const sentenceWords = Array.from(new Set([...readWords, ...writeWords]));

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
            props.startSentenceStages?.({ read: readWords, write: writeWords }, wordScores);
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
          const available = results.filter(
            (w): w is import('../../types/models').Word => w !== null,
          );
          const availableIds = new Set(available.map((w) => w.id));
          const read = readWords.filter((w) => availableIds.has(w.id));
          const write = writeWords.filter((w) => availableIds.has(w.id));

          if (available.length > 0 && !props.finalStage) {
            setStateMerged({
              sentenceWords: available,
              sentenceCheckStatus: 'available',
            });
            props.startSentenceStages?.({ read, write }, wordScores);
          } else {
            setStateMerged({
              sentenceWords: available,
              sentenceCheckStatus: 'unavailable',
            });
            props.onVocabComplete?.(wordScores);
          }
        });
      }
    },
    [
      getState,
      onSendResults,
      props.isDemo,
      props.practiceMode,
      props.finalStage,
      props.onVocabComplete,
      props.startSentenceStages,
      setStateMerged,
    ],
  );

  /**
   * End the current question with a grade and move to the next one.
   *
   * `grade` is what the learner reported in flashcard mode. Every other answer
   * mode reads the cap the question carries, which is `pass` until a wrong
   * attempt, five misses on one stroke, or the stroke outline drops it.
   */
  const onCorrectAnswer = useCallback(
    (grade?: DirectionResult): void => {
      const current = getState();
      const result = grade ?? current.gradeCap;
      const recorded = currentGrade(current, result);

      setStateMerged((prevState) => ({
        // A typed answer that follows a wrong one is still correct, and the
        // feedback line says so. The amber marker beside the question is what
        // reports the lapse. Only the flashcard button reports itself here.
        result: grade === 'lapse' ? 'Nearly' : 'Correct',
        idkDisabled: true,
        submitDisabled: true,
        // Flashcard grading: mark the button pressed however it was triggered.
        gradeClicked: prevState.showAnswer ? result : null,
        gradeList: recorded ? prevState.gradeList.concat(recorded) : prevState.gradeList,
      }));
      if (current.useSoundEffects) {
        beep.play();
      }
      const pairIndex = current.queue.indexOf(current.currentPair!);
      const remainingQueue = current.queue.filter((_, index) => index !== pairIndex);

      if (pairIndex !== -1) {
        setStateMerged({ queue: remainingQueue });
      }
      // A question the learner missed offers its components before the session
      // moves on, so the reveal waits for Continue rather than a timer.
      const review = componentsToReview(current, result);

      if (remainingQueue.length !== 0) {
        const newQuestion = testLogic.assignQA(current.testSet, remainingQueue, current.charSet);
        holdOrAdvance(
          review,
          () => {
            setStateMerged((prevState) => ({
              currentPair: newQuestion.pair,
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
              gradeCap: 'pass',
              toneErrorCount: 0,
            }));
          },
          1000,
        );
      } else {
        holdOrAdvance(
          review,
          () => {
            onFinishTest(recorded);
            setStateMerged({ result: 'Finished!' });
          },
          0,
        );
      }
    },
    [getState, holdOrAdvance, setStateMerged, onFinishTest],
  );

  /** The flashcard grade for a question the learner nearly knew. */
  const onNearlyKnew = useCallback((): void => {
    onCorrectAnswer('lapse');
  }, [onCorrectAnswer]);

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

  // The submission path for every attempt the learner sends. On a wrong answer
  // the input is left untouched so the user can edit and resubmit it, and the
  // question is capped at a lapse however many attempts follow.
  const submitAnswer = useCallback(
    (input: string): void => {
      const current = getState();
      if (checkAnswer(input)) {
        onCorrectAnswer();
      } else {
        if (current.useSoundEffects) {
          fail.play();
        }
        let resultString = 'Try again';
        let toneError = false;

        if (current.answerCategory === 'pinyin' && typeof current.answer === 'string') {
          const cleanAnswer = current.answer.replace(/ /g, '').toLowerCase();
          const cleanInput = input.trim().replace(/ /g, '').toLowerCase();

          if (testLogic.toneChecker(cleanInput, cleanAnswer)) {
            resultString = 'Incorrect tones';
            toneError = true;
          }
        }

        setStateMerged((prevState) => ({
          result: resultString,
          showHint: false,
          gradeCap: 'lapse',
          toneErrorCount: prevState.toneErrorCount + (toneError ? 1 : 0),
        }));
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

  /**
   * Put a transcript in the answer input, and send nothing.
   *
   * The transcript is a measure of the recognizer, so it is not an attempt. The
   * learner reads it and sends it with the Submit button or the Enter key. See
   * docs/adr/0007-grade-the-first-attempt.md.
   */
  const applySpeech = useCallback(
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

      setStateMerged({ answerInput: submission, result: '' });
    },
    [getState, setStateMerged],
  );

  useEffect(() => {
    applySpeechRef.current = applySpeech;
  }, [applySpeech]);

  // --- Hanzi Writer ---

  const quizWriter = useCallback(
    (writer: HanziWriterInstance, char: string, index: number): void => {
      writer.quiz({
        // The outline appears after this many misses on one stroke, so this is
        // the point where the app helps and the question stops being a pass.
        // A word of more than one character keeps the cap across its characters,
        // which gives the word the worst grade of them.
        onMistake: (strokeData) => {
          if (strokeData.mistakesOnStroke >= missesBeforeHint) {
            setStateMerged({ gradeCap: 'lapse' });
          }
        },
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
    [missesBeforeHint, onCorrectAnswer, setStateMerged],
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

      clearCharacterTarget();

      const writer = window.HanziWriter.create('character-target-div', char[index], {
        width: 150,
        height: 150,
        padding: 20,
        showOutline: false,
        showCharacter: flashChar,
        showHintAfterMisses: missesBeforeHint,
        delayBetweenStrokes: 10,
        strokeAnimationSpeed: 1,
        outlineColor: '#555',
      });

      setStateMerged({ writer });
      quizWriter(writer, char, index);
    },
    [missesBeforeHint, quizWriter, setStateMerged],
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
          const latest = getState();
          // The reveal ran, so the question is a fail whatever the cap holds.
          const grade = currentGrade(latest, 'fail');
          setStateMerged((prevState) => ({
            gradeList: grade ? prevState.gradeList.concat(grade) : prevState.gradeList,
          }));

          // A revealed direction is answered, so it leaves the queue: the queue
          // is read in order now, and leaving it in would ask it forever.
          const remainingQueue = latest.queue.filter((pair) => pair !== latest.currentPair);
          setStateMerged({ queue: remainingQueue });

          // The reveal is a fail of a character the learner was writing, so the
          // components are offered before the next question.
          const review = componentsToReview(latest, 'fail');

          if (remainingQueue.length === 0) {
            holdOrAdvance(
              review,
              () => {
                onFinishTest(grade);
                setStateMerged({ result: 'Finished!' });
              },
              0,
            );
            return;
          }

          const newQuestion = testLogic.assignQA(latest.testSet, remainingQueue, latest.charSet);

          holdOrAdvance(
            review,
            () => {
              setStateMerged((prevState) => ({
                currentPair: newQuestion.pair,
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
                gradeCap: 'pass',
                toneErrorCount: 0,
              }));
            },
            0,
          );
        }
      });
    },
    [getState, holdOrAdvance, onFinishTest, setStateMerged],
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

    const grade = currentGrade(current, 'fail');

    setStateMerged((prevState) => ({
      gradeList: grade ? prevState.gradeList.concat(grade) : prevState.gradeList,
      idkDisabled: true,
      submitDisabled: true,
      // In flashcard mode the answer is already on screen, so the feedback line
      // reports the grade instead of repeating the reveal text unchanged.
      result: prevState.showAnswer
        ? `Not known — answer was: '${displayAnswer}'`
        : `Answer was: '${displayAnswer}'`,
      gradeClicked: prevState.showAnswer ? 'fail' : null,
    }));

    // As above: the direction was revealed, so it leaves the queue.
    const remainingQueue = current.queue.filter((pair) => pair !== current.currentPair);
    setStateMerged({ queue: remainingQueue });

    // The question was revealed, so it is a fail: a character question offers
    // its components and waits for Continue instead of the timer below.
    const review = componentsToReview(current, 'fail');

    if (remainingQueue.length === 0) {
      // Let the reveal stand for a moment before the summary replaces it.
      holdOrAdvance(
        review,
        () => {
          onFinishTest(grade);
          setStateMerged({ result: 'Finished!' });
        },
        2000,
      );
      return;
    }

    const newQuestion = testLogic.assignQA(current.testSet, remainingQueue, current.charSet);

    holdOrAdvance(
      review,
      () => {
        setStateMerged((prevState) => ({
          currentPair: newQuestion.pair,
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
          gradeCap: 'pass',
          toneErrorCount: 0,
        }));
      },
      2000,
    );
  }, [getState, holdOrAdvance, onFinishTest, onIdkChar, setStateMerged]);

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
      // The one aid that is the answer, so it caps the question at a lapse. The
      // other aids identify the question the learner is asked, and are free.
      setStateMerged({ gradeCap: 'lapse' });
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

  /** Expand or collapse the component breakdown offered after a miss. */
  const onToggleComponents = useCallback((): void => {
    setStateMerged((prevState) => ({ showComponents: !prevState.showComponents }));
  }, [setStateMerged]);

  /** Leave the component review and run the step the grade held back. */
  const onContinue = useCallback((): void => {
    const advance = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    setStateMerged({ componentReviewChars: [], showComponents: false });
    advance?.();
  }, [setStateMerged]);

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
      // TestWords plans the session, because the Learn step has to teach the
      // new words the queue asks. The fallback covers the demo and the unit
      // tests, which render the engine without a container.
      const plan =
        props.plan ??
        testLogic.planSession(props.words, {
          ...testLogic.readSessionSettings(Boolean(props.isDemo)),
          includeHandwriting: useHandwriting,
          practiceMode: Boolean(props.practiceMode),
        });
      // A resumed session asks what is left of the queue it saved, and the
      // plan above is the plan that queue was built from, so its indexes still
      // point at the right words. See issue #305.
      const queue = props.resume?.queue ?? plan.queue;

      if (queue.length === 0) {
        // Reachable when every candidate's only due direction is one the
        // session does not ask — handwriting switched off, say. Go straight to
        // the summary rather than showing a question that does not exist. This
        // submits nothing, so no schedule moves and no streak is recorded.
        setStateMerged({
          testSet: plan.words,
          queue,
          initialQueueLength: 0,
          scoreList: [],
          testFinished: true,
        });
        return;
      }

      const initialVals = testLogic.assignQA(plan.words, queue, current.charSet);
      setStateMerged((prevState) => ({
        testSet: plan.words,
        queue: queue,
        currentPair: initialVals.pair,
        answer: initialVals.answer,
        answerCategory: initialVals.answerCategory,
        question: initialVals.question,
        questionCategory: initialVals.questionCategory,
        chosenCharacter: initialVals.chosenCharacter,
        // A resumed session keeps the length it started with, so the bar
        // measures the whole session rather than the part that is left.
        initialQueueLength: props.resume?.initialQueueLength ?? queue.length,
        gradeList: props.resume?.gradeList ?? prevState.gradeList,
        showErrorMessage: false,
        qNum: prevState.qNum + 1,
      }));
    },
    [
      getState,
      props.isDemo,
      props.plan,
      props.practiceMode,
      props.resume,
      props.words,
      setStateMerged,
    ],
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

      // The component review holds a question that is already graded, so the
      // shortcuts of a live question do nothing: Enter or space continues.
      if (current.componentReviewChars.length > 0) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onContinue();
        }
        return;
      }

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
          onCorrectAnswer('pass');
        }
      }

      if (event.key === 'ArrowRight') {
        if (current.showAnswer && !current.idkDisabled) {
          onNearlyKnew();
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
      onContinue,
      onCorrectAnswer,
      onHint,
      onHomeClicked,
      onIDontKnow,
      onListen,
      onNearlyKnew,
      onShowAnswer,
      onSpeak,
      onToggleShowPinyin,
      props.finalStage,
      props.isDemo,
      props.speechAvailable,
      props.startSentenceStages,
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

  /**
   * Start a question: read it out, and open the mic when auto-record is on.
   *
   * It runs once per question, and `qNum` is the question. The other
   * dependencies below are callbacks that change identity whenever the
   * container re-renders, and grading a question re-renders it — the engine
   * reports its progress, and the container saves it. Without this guard the
   * effect ran again on a question that was already graded, so the word was
   * spoken a second time after a thumbs up or thumbs down and the mic reopened
   * on an answered question.
   */
  const startedQuestionRef = useRef<number | null>(null);
  useEffect(() => {
    const current = getState();

    if (current.testFinished) return;
    if (startedQuestionRef.current === state.qNum) return;
    startedQuestionRef.current = state.qNum;

    ttsService.stopAll();
    setStateMerged({
      gradeClicked: null,
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

  /**
   * Report the session's progress whenever the queue moves.
   *
   * Nothing outside the engine knows which questions are left, and the grades
   * reach Firestore only when the session finishes, so this is what the
   * container saves to make an abandoned session resumable. It fires on the
   * first question as well as each later one, because a session closed after
   * one answer is the case that loses the most. See issue #305.
   */
  const reportProgress = props.isDemo ? undefined : props.onProgress;
  useEffect(() => {
    if (!reportProgress) return;
    if (state.initialQueueLength === 0) return;
    reportProgress({
      queue: state.queue,
      gradeList: state.gradeList,
      initialQueueLength: state.initialQueueLength,
    });
  }, [state.queue, state.gradeList, state.initialQueueLength, reportProgress]);

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
    onNearlyKnew,
    onSubmitAnswer,
    onIDontKnow,
    onHint,
    onShowAnswer,
    onToggleShowPinyin,
    onToggleComponents,
    onContinue,
    showCharacter,
    refreshSettings,
  };
};
