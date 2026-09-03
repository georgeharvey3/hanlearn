import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';

import * as wordActions from '../../store/actions/index';

import Button from '../../components/UI/Buttons/Button/Button';
import Spinner from '../../components/UI/Spinner/Spinner';
import Test from '../../components/Test/Test';
import SentenceWrite from '../../components/Test/SentenceWrite/SentenceWrite';
import SentenceRead from '../../components/Test/SentenceRead/SentenceRead';
import NewWords from '../../components/Test/NewWords/NewWords';
import TestSummary from '../../components/Test/TestSummary/TestSummary';

import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import * as testLogic from '../../components/Test/Logic/TestLogic';
import { RootState } from '../../types/store';
import { Word, WordScore } from '../../types/models';
import { SentenceStageWords } from '../../components/Test/types';
import { getDevTestConfig, DevTestConfig } from '../../utils/devTestMode';
import { makeDirections } from '../../utils/directions';
import { dayKey } from '../../utils/retention';
import {
  SAVED_SESSION_VERSION,
  clearSavedSession,
  describeSavedSession,
  loadResumableSession,
  restoreSession,
  saveSession,
  RestoredSession,
  VocabProgress,
} from '../../utils/savedSession';

import { Box, Chip, Stepper, Step, StepLabel, Typography } from '@mui/material';

// Dev test mode config - loaded once on mount
const devConfig: DevTestConfig | null = getDevTestConfig();

type Stage = 'new' | 'vocab' | 'read' | 'write' | 'summary';

interface TestWordsState {
  /** The words the Read stage runs for: the ones the learner has just met. */
  sentenceReadWords: Word[];
  /** The words the Write stage runs for: the ones the learner already half knows. */
  sentenceWriteWords: Word[];
  stage: Stage;
  newWords: Word[];
  selectedWords: Word[];
  /**
   * The plan the session runs. It is built here, not in the engine, because the
   * Learn step has to teach the new words the queue actually asks. Two separate
   * counts of "the new words for this session" once taught five and asked none.
   */
  plan: testLogic.SessionPlan | null;
  newWordsEnabled: boolean;
  sentenceReadEnabled: boolean;
  sentenceWriteEnabled: boolean;
  sentenceStagesForAllWords: boolean;
  devTestFinished: boolean; // For testing TestSummary directly
  practiceMode: boolean; // Practice mode ignores due dates and doesn't update them
  wordsInitialized: boolean; // True once word selection has run (prevents flash of "No words due")
  seenOffsets: Record<string, { offset: number; text: string; english: string }>;
  wordScores: WordScore[];
  /**
   * The unfinished session found in storage, waiting for the learner to say
   * whether to resume it. While it is set no session is running, so the offer
   * is what the page shows. See issue #305.
   */
  pendingResume: RestoredSession | null;
  /** How far through that session the learner is, for the offer to say. */
  pendingResumeLabel: string;
  /** The progress handed to the engine when a session is resumed. */
  resume: VocabProgress | null;
  /** The engine's latest progress, which is what gets saved. */
  vocabProgress: VocabProgress | null;
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  wordsLoading: state.addWords.loading,
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
  listStats: state.addWords.listStats,
});

const mapDispatchToProps = {
  onInitWords: wordActions.initWords,
  onSwitchList: wordActions.switchActiveList,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const TestWords: React.FC<Props> = ({
  words,
  wordsLoading,
  userId,
  authInitialized,
  isDemo,
  lists,
  activeListId,
  listStats,
  onInitWords,
  onSwitchList,
  history,
}) => {
  const getInitialStage = (): Stage => {
    if (devConfig) {
      // Map 'summary' to 'vocab' since summary is shown within Test component
      return devConfig.stage === 'summary' ? 'vocab' : (devConfig.stage as Stage);
    }
    return 'new';
  };

  const [state, setState] = useState<TestWordsState>({
    sentenceReadWords: [],
    sentenceWriteWords: [],
    stage: getInitialStage(),
    newWords: [],
    plan: null,
    selectedWords: [],
    newWordsEnabled: isDemo ? true : localStorage.getItem('newWords') !== 'false',
    sentenceReadEnabled: isDemo ? true : localStorage.getItem('sentenceRead') !== 'false',
    sentenceWriteEnabled: isDemo ? true : localStorage.getItem('sentenceWrite') !== 'false',
    sentenceStagesForAllWords: isDemo
      ? false
      : localStorage.getItem('sentenceStagesForAllWords') === 'true',
    devTestFinished: devConfig?.testFinished ?? false,
    practiceMode: false,
    wordsInitialized: false,
    seenOffsets: {},
    wordScores: [],
    pendingResume: null,
    pendingResumeLabel: '',
    resume: null,
    vocabProgress: null,
  });

  const prevWordsLength = useRef(words.length);

  /**
   * The words the session may draw on. planSession picks the pairs and applies
   * the budget, so this no longer truncates: handing it a fixed few words would
   * cap the queue below the budget however many words were actually due.
   */
  const selectTestWords = useCallback(
    (ignoreDueDates = false): Word[] => {
      const allWords = words.slice();
      if (ignoreDueDates) return allWords;
      return allWords.filter((word) => testLogic.isDue(word));
    },
    [words],
  );

  /**
   * Plan the session for a set of words.
   *
   * The Learn step teaches `plan.newWords`, and the engine asks `plan.queue`.
   * Both come from this one call, so the two can never disagree.
   */
  const planFor = useCallback(
    (selectedWords: Word[], practiceMode = false): testLogic.SessionPlan =>
      testLogic.planSession(selectedWords, {
        ...testLogic.readSessionSettings(isDemo),
        practiceMode,
      }),
    [isDemo],
  );

  const setSelectedWords = useCallback((): void => {
    if (isDemo) {
      const demoDueDate = new Date().toISOString();
      const demoWords: Word[] = [
        {
          id: 0,
          simp: '你好',
          trad: '你好',
          pinyin: 'ni3 hao3',
          meaning: 'hello/hi',
          due_date: demoDueDate,
          level: 1,
          directions: makeDirections(1, demoDueDate),
        },
      ];
      setState((prev) => ({
        ...prev,
        newWords: demoWords,
        selectedWords: demoWords,
      }));
      return;
    }

    const selectedWords = selectTestWords();
    const plan = planFor(selectedWords);
    const newWords = plan.newWords;

    setState((prev) => ({
      ...prev,
      stage: newWords.length === 0 || !state.newWordsEnabled ? 'vocab' : 'new',
      newWords: newWords,
      plan,
      selectedWords: selectedWords,
      wordsInitialized: true,
    }));
  }, [isDemo, planFor, selectTestWords, state.newWordsEnabled]);

  // Track whether we've already initialized to prevent re-running setSelectedWords
  const hasInitialized = useRef(false);
  const prevActiveListId = useRef(activeListId);
  // Track whether wordsLoading has been true at least once (prevents the "no words"
  // fallback from firing before the fetch even starts, since both effects run in the
  // same render cycle with stale captured props).
  const hasSeenLoading = useRef(false);

  // Reset initialization when active list changes (e.g. "Test All Lists" clicked)
  // so that test words get re-selected from the new word set.
  useEffect(() => {
    if (prevActiveListId.current !== activeListId) {
      prevActiveListId.current = activeListId;
      hasInitialized.current = false;
      hasSeenLoading.current = false;
      setState((prev) => ({
        ...prev,
        selectedWords: [],
        newWords: [],
        wordsInitialized: false,
        pendingResume: null,
        pendingResumeLabel: '',
        resume: null,
        vocabProgress: null,
      }));
    }
  }, [activeListId]);

  useEffect(() => {
    if (!isDemo && userId !== null) {
      onInitWords();
    }

    window.speechSynthesis.getVoices();
  }, [isDemo, onInitWords, userId]);

  // Separate effect for initial word selection - only runs once when words are first available
  useEffect(() => {
    if (wordsLoading) {
      hasSeenLoading.current = true;
    }

    if (!hasInitialized.current && (words.length > 0 || isDemo)) {
      hasInitialized.current = true;

      if (devConfig) {
        // For dev stages, use actual words from user's list (ignore due dates)
        const selectedWords = selectTestWords(true);
        const plan = planFor(selectedWords);
        setState((prev) => ({
          ...prev,
          selectedWords,
          newWords: plan.newWords,
          plan,
          sentenceReadWords: selectedWords,
          sentenceWriteWords: selectedWords,
          wordsInitialized: true,
        }));
      } else {
        // An unfinished session from earlier today is offered rather than
        // replaced: planning a new one here would throw away every answer it
        // collected. See issue #305.
        const saved = userId === null ? null : loadResumableSession(userId, activeListId);
        const restored = saved ? restoreSession(saved, words) : null;

        if (saved && restored) {
          setState((prev) => ({
            ...prev,
            pendingResume: restored,
            pendingResumeLabel: describeSavedSession(saved),
            wordsInitialized: true,
          }));
        } else {
          // A session whose words no longer resolve cannot be asked at all.
          if (saved) clearSavedSession();
          setSelectedWords();
        }
      }
    }
    // Loading finished with no words — mark as initialized so spinner stops.
    // Only trigger after loading has been true at least once (hasSeenLoading)
    // to avoid a race where this fires before the fetch even starts.
    if (
      !hasInitialized.current &&
      !wordsLoading &&
      hasSeenLoading.current &&
      !isDemo &&
      words.length === 0 &&
      userId !== null
    ) {
      hasInitialized.current = true;
      setState((prev) => ({ ...prev, wordsInitialized: true }));
    }
  }, [
    activeListId,
    isDemo,
    selectTestWords,
    setSelectedWords,
    words,
    words.length,
    wordsLoading,
    userId,
  ]);

  // This effect is now handled by the initialization effect above
  useEffect(() => {
    prevWordsLength.current = words.length;
  }, [words.length]);

  const onClickAddWords = (): void => {
    history.push('/add-words');
  };

  const onStartPractice = (): void => {
    const selectedWords = selectTestWords(true); // Ignore due dates
    const plan = planFor(selectedWords, true);
    const newWords = plan.newWords;

    setState((prev) => ({
      ...prev,
      stage: newWords.length === 0 || !state.newWordsEnabled ? 'vocab' : 'new',
      newWords: newWords,
      plan,
      selectedWords: selectedWords,
      practiceMode: true,
    }));
  };

  const onStartVocab = (): void => {
    setState((prev) => ({ ...prev, stage: 'vocab' }));
  };

  /** Pick up the unfinished session where it was left. */
  const onResumeSession = (): void => {
    setState((prev) => {
      const restored = prev.pendingResume;
      if (!restored) return prev;
      return {
        ...prev,
        pendingResume: null,
        pendingResumeLabel: '',
        stage: restored.stage,
        selectedWords: restored.words,
        newWords: restored.newWords,
        // The saved queue indexes into the saved word order, so the plan has to
        // be that same order for the two to agree.
        plan: {
          words: restored.words,
          queue: restored.progress.queue,
          newWords: restored.newWords,
        },
        resume: restored.progress,
        vocabProgress: restored.progress,
        sentenceReadWords: restored.sentenceReadWords,
        sentenceWriteWords: restored.sentenceWriteWords,
        seenOffsets: restored.seenOffsets,
        wordScores: restored.scoreList,
        practiceMode: restored.practiceMode,
        wordsInitialized: true,
      };
    });
  };

  /** Discard the unfinished session and plan a new one. */
  const onDiscardSession = (): void => {
    clearSavedSession();
    setState((prev) => ({
      ...prev,
      pendingResume: null,
      pendingResumeLabel: '',
      resume: null,
      vocabProgress: null,
    }));
    setSelectedWords();
  };

  /**
   * Take the engine's progress, which is what the saved session is made of.
   *
   * The engine reports on every graded question, and the identity check keeps a
   * report that changed nothing from costing a render.
   */
  const onVocabProgress = useCallback((progress: VocabProgress): void => {
    setState((prev) =>
      prev.vocabProgress?.queue === progress.queue &&
      prev.vocabProgress?.gradeList === progress.gradeList
        ? prev
        : { ...prev, vocabProgress: progress },
    );
  }, []);

  /**
   * Route the session into whichever sentence stage has words for it.
   *
   * The engine gates the two lists, and the two stage settings are applied
   * here: a stage the learner turned off takes no words, and a stage with no
   * words is skipped. A session can therefore run Read alone, Write alone,
   * both, or neither.
   */
  const onStartSentenceStages = (words: SentenceStageWords, scores?: WordScore[]): void => {
    const readWords = state.sentenceReadEnabled ? words.read : [];
    const writeWords = state.sentenceWriteEnabled ? words.write : [];

    setState((prev) => ({
      ...prev,
      sentenceReadWords: readWords,
      sentenceWriteWords: writeWords,
      wordScores: scores ?? prev.wordScores,
      stage: readWords.length > 0 ? 'read' : writeWords.length > 0 ? 'write' : 'summary',
    }));
  };

  const onStartSentenceWrite = (
    seenOffsets: Record<string, { offset: number; text: string; english: string }>,
  ): void => {
    setState((prev) => ({
      ...prev,
      seenOffsets,
      stage: prev.sentenceWriteWords.length > 0 ? 'write' : 'summary',
    }));
  };

  const onVocabComplete = (scores: WordScore[]): void => {
    setState((prev) => ({ ...prev, wordScores: scores, stage: 'summary' }));
  };

  const onSentenceWriteComplete = (): void => {
    setState((prev) => ({ ...prev, stage: 'summary' }));
  };

  /**
   * Keep the running session in storage, and drop it once it is done.
   *
   * A session writes nothing until it finishes, so the record is the only thing
   * standing between closing the page and losing every answer. It is rewritten
   * on each stage and each graded question, which is every moment the session
   * moves. The demo and the dev stages save nothing: neither is a session the
   * learner would come back to. See issue #305.
   */
  useEffect(() => {
    if (isDemo || devConfig || userId === null) return;
    // The offer is showing, so nothing is running yet and the record it offers
    // must survive until the learner answers it.
    if (state.pendingResume) return;

    if (state.stage === 'summary') {
      clearSavedSession();
      return;
    }
    if (!state.plan || state.selectedWords.length === 0) return;

    // Before the engine has reported, the plan's own queue is what is left.
    const progress: VocabProgress = state.vocabProgress ?? {
      queue: state.plan.queue,
      gradeList: [],
      initialQueueLength: state.plan.queue.length,
    };

    const now = new Date();
    saveSession({
      version: SAVED_SESSION_VERSION,
      userId,
      listId: activeListId,
      date: dayKey(now),
      savedAt: now.toISOString(),
      stage: state.stage,
      practiceMode: state.practiceMode,
      wordIds: state.plan.words.map((word) => word.id),
      newWordIds: state.newWords.map((word) => word.id),
      sentenceReadWordIds: state.sentenceReadWords.map((word) => word.id),
      sentenceWriteWordIds: state.sentenceWriteWords.map((word) => word.id),
      seenOffsets: state.seenOffsets,
      scoreList: state.wordScores,
      ...progress,
    });
  }, [activeListId, isDemo, state, userId]);

  // All dev stages require auth since they use real words from user's list
  // Wait for auth to initialize before redirecting
  if (devConfig && !authInitialized) {
    return <Spinner />;
  }
  if (userId === null && !isDemo) {
    return <Redirect to="/" />;
  }

  let content: React.ReactNode = null;

  if (state.pendingResume) {
    content = (
      <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 8, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Unfinished session
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          {state.pendingResumeLabel}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          <Button clicked={onResumeSession}>Resume</Button>
          <Button type="ghost" clicked={onDiscardSession}>
            Start fresh
          </Button>
        </Box>
      </Box>
    );
  } else if (state.selectedWords.length > 0) {
    switch (state.stage) {
      case 'new':
        content = (
          <ErrorBoundary>
            <NewWords
              words={state.newWords}
              startTest={onStartVocab}
              isDemo={isDemo || !!devConfig}
            />
          </ErrorBoundary>
        );
        break;
      case 'vocab':
        content = (
          <ErrorBoundary>
            <Test
              isDemo={isDemo || !!devConfig}
              words={state.selectedWords}
              plan={state.plan ?? undefined}
              resume={state.resume ?? undefined}
              onProgress={onVocabProgress}
              startSentenceStages={onStartSentenceStages}
              onVocabComplete={onVocabComplete}
              finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
              devTestFinished={state.devTestFinished}
              practiceMode={state.practiceMode}
              sentenceStagesForAllWords={state.sentenceStagesForAllWords}
            />
          </ErrorBoundary>
        );

        break;
      case 'read':
        content = (
          <ErrorBoundary>
            <SentenceRead
              words={state.sentenceReadWords}
              startSentenceWrite={onStartSentenceWrite}
              sentenceWriteEnabled={state.sentenceWriteWords.length > 0}
              isDemo={isDemo}
            />
          </ErrorBoundary>
        );
        break;
      case 'write':
        content = (
          <ErrorBoundary>
            <SentenceWrite
              words={state.sentenceWriteWords}
              seenOffsets={state.seenOffsets}
              onComplete={onSentenceWriteComplete}
              isDemo={isDemo}
            />
          </ErrorBoundary>
        );
        break;
      case 'summary':
        content = (
          <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 4 }}>
            <TestSummary scores={state.wordScores} />
          </Box>
        );
        break;
      default:
        content = (
          <Test
            words={state.selectedWords}
            plan={state.plan ?? undefined}
            resume={state.resume ?? undefined}
            onProgress={onVocabProgress}
            startSentenceStages={onStartSentenceStages}
            onVocabComplete={onVocabComplete}
            finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
            practiceMode={state.practiceMode}
            sentenceStagesForAllWords={state.sentenceStagesForAllWords}
          />
        );
    }
  } else if (wordsLoading || !state.wordsInitialized) {
    // Still loading words, or words arrived but haven't been selected yet
    content = <Spinner />;
  } else {
    // Check if user has words in list (even if none due)
    const hasWordsInList = words.length > 0;

    const isAllLists = activeListId === '__all__';
    const activeListName = isAllLists
      ? 'All Lists'
      : (lists || []).find((l) => l.id === activeListId)?.name || 'General';

    // Find other lists that have due words
    const otherListsWithDue = isAllLists
      ? []
      : (lists || [])
          .filter((l) => l.id !== activeListId && (listStats[l.id]?.due ?? 0) > 0)
          .map((l) => ({ ...l, due: listStats[l.id].due }));

    // Total due across all lists (for suggesting "Test All")
    const totalDueAcrossLists = Object.values(listStats).reduce((sum, s) => sum + (s?.due ?? 0), 0);
    const hasMultipleLists = (lists || []).filter((l) => l.id !== 'default').length > 0;

    const handleSwitchAndTest = (listId: string) => {
      onSwitchList(listId);
      // Navigate home so the user sees the updated list and can tap Test
      history.push('/');
    };

    const handleTestAll = () => {
      onSwitchList('__all__');
      // Re-navigate to test-words so the component re-initialises with all words
      history.replace('/test-words');
    };

    content = (
      <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 8, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
          No words due in &ldquo;{activeListName}&rdquo;
        </Typography>

        {!isAllLists && otherListsWithDue.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Other lists with words due:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              {otherListsWithDue.map((l) => (
                <Chip
                  key={l.id}
                  label={`${l.name} (${l.due} due)`}
                  onClick={() => handleSwitchAndTest(l.id)}
                  color="primary"
                  variant="outlined"
                  clickable
                />
              ))}
            </Box>
          </Box>
        )}

        {!isAllLists && hasMultipleLists && totalDueAcrossLists > 0 && (
          <Box sx={{ mb: 3 }}>
            <Chip
              label={`Test All Lists (${totalDueAcrossLists} due)`}
              onClick={handleTestAll}
              color="primary"
              variant="filled"
              clickable
            />
          </Box>
        )}

        {otherListsWithDue.length === 0 && !isAllLists && (
          <Typography variant="body2" sx={{ mb: 3, color: 'text.disabled' }}>
            No words due in any list
          </Typography>
        )}

        {isAllLists && (
          <Typography variant="body2" sx={{ mb: 3, color: 'text.disabled' }}>
            No words due in any list
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          <Button clicked={onClickAddWords}>Add Words</Button>
          {hasWordsInList && (
            <Button type="ghost" clicked={onStartPractice}>
              Practice
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // Build progress stepper (only when a session is active)
  let stepper: React.ReactNode = null;
  if (state.selectedWords.length > 0) {
    const steps: string[] = [];
    if (state.newWords.length > 0 && state.newWordsEnabled) steps.push('Learn');
    steps.push('Test');
    if (state.sentenceReadEnabled || state.sentenceWriteEnabled) steps.push('Sentences');
    steps.push('Done');

    const stageToStep: Partial<Record<Stage, number>> = {
      new: steps.indexOf('Learn'),
      vocab: steps.indexOf('Test'),
      read: steps.indexOf('Sentences'),
      write: steps.indexOf('Sentences'),
      summary: steps.indexOf('Done'),
    };
    const activeStep = stageToStep[state.stage] ?? 0;

    const activeListNameForStepper =
      activeListId === '__all__'
        ? 'All Lists'
        : (lists || []).find((l) => l.id === activeListId)?.name || 'General';

    stepper = (
      <Box>
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center', pt: 1.5, color: 'text.secondary' }}
        >
          Testing: {activeListNameForStepper}
        </Typography>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ pt: 1, pb: 1 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
    );
  }

  return (
    <>
      {stepper}
      {content}
    </>
  );
};

export default withRouter(connector(TestWords));
