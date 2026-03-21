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
import { getDevTestConfig, DevTestConfig } from '../../utils/devTestMode';

import { Box, Chip, Stepper, Step, StepLabel, Typography } from '@mui/material';

// Dev test mode config - loaded once on mount
const devConfig: DevTestConfig | null = getDevTestConfig();

type Stage = 'new' | 'vocab' | 'read' | 'write' | 'summary';

interface TestWordsState {
  sentenceWords: Word[];
  stage: Stage;
  numWords: number;
  newWords: Word[];
  selectedWords: Word[];
  newWordsEnabled: boolean;
  sentenceReadEnabled: boolean;
  sentenceWriteEnabled: boolean;
  devTestFinished: boolean; // For testing TestSummary directly
  practiceMode: boolean; // Practice mode ignores due dates and doesn't update them
  seenOffsets: Record<string, { offset: number; text: string; english: string }>;
  wordScores: WordScore[];
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
    sentenceWords: [],
    stage: getInitialStage(),
    numWords: isDemo ? 5 : parseInt(localStorage.getItem('numWords') || '5', 10),
    newWords: [],
    selectedWords: [],
    newWordsEnabled: isDemo ? true : localStorage.getItem('newWords') !== 'false',
    sentenceReadEnabled: isDemo ? true : localStorage.getItem('sentenceRead') !== 'false',
    sentenceWriteEnabled: isDemo ? true : localStorage.getItem('sentenceWrite') !== 'false',
    devTestFinished: devConfig?.testFinished ?? false,
    practiceMode: false,
    seenOffsets: {},
    wordScores: [],
  });

  const prevWordsLength = useRef(words.length);

  const selectTestWords = useCallback(
    (ignoreDueDates = false): Word[] => {
      const allWords = words.slice();
      const actualNumWords =
        allWords.length >= state.numWords ? state.numWords : allWords.length;
      if (ignoreDueDates) {
        return testLogic.chooseRandomTestSet(allWords, actualNumWords);
      }
      return testLogic.chooseTestSet(allWords, actualNumWords);
    },
    [state.numWords, words],
  );

  const setSelectedWords = useCallback((): void => {
    if (isDemo) {
      const demoWords: Word[] = [
        {
          id: 0,
          simp: '你好',
          trad: '你好',
          pinyin: 'ni3 hao3',
          meaning: 'hello/hi',
          due_date: new Date().toISOString(),
          bank: 1,
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
    const newWords = selectedWords.filter((word) => word.bank === 1);

    if (newWords.length === 0 || !state.newWordsEnabled) {
      setState((prev) => ({
        ...prev,
        stage: 'vocab',
        newWords: newWords,
        selectedWords: selectedWords,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        stage: 'new',
        newWords: newWords,
        selectedWords: selectedWords,
      }));
    }
  }, [isDemo, selectTestWords, state.newWordsEnabled]);

  // Track whether we've already initialized to prevent re-running setSelectedWords
  const hasInitialized = useRef(false);
  const prevActiveListId = useRef(activeListId);

  // Reset initialization when active list changes (e.g. "Test All Lists" clicked)
  // so that test words get re-selected from the new word set.
  useEffect(() => {
    if (prevActiveListId.current !== activeListId) {
      prevActiveListId.current = activeListId;
      hasInitialized.current = false;
      setState((prev) => ({ ...prev, selectedWords: [], newWords: [] }));
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
    if (!hasInitialized.current && (words.length > 0 || isDemo)) {
      hasInitialized.current = true;

      if (devConfig) {
        // For dev stages, use actual words from user's bank (ignore due dates)
        const selectedWords = selectTestWords(true);
        const newWords = selectedWords.filter((word) => word.bank === 1);
        setState((prev) => ({
          ...prev,
          selectedWords,
          newWords,
          sentenceWords: selectedWords,
        }));
      } else {
        setSelectedWords();
      }
    }
  }, [isDemo, selectTestWords, setSelectedWords, words.length]);

  // This effect is now handled by the initialization effect above
  useEffect(() => {
    prevWordsLength.current = words.length;
  }, [words.length]);

  const onClickAddWords = (): void => {
    history.push('/add-words');
  };

  const onStartPractice = (): void => {
    const selectedWords = selectTestWords(true); // Ignore due dates
    const newWords = selectedWords.filter((word) => word.bank === 1);

    if (newWords.length === 0 || !state.newWordsEnabled) {
      setState((prev) => ({
        ...prev,
        stage: 'vocab',
        newWords: newWords,
        selectedWords: selectedWords,
        practiceMode: true,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        stage: 'new',
        newWords: newWords,
        selectedWords: selectedWords,
        practiceMode: true,
      }));
    }
  };

  const onStartVocab = (): void => {
    setState((prev) => ({ ...prev, stage: 'vocab' }));
  };

  const onStartSentenceRead = (sentenceWords: Word[], scores?: WordScore[]): void => {
    if (state.sentenceReadEnabled) {
      setState((prev) => ({
        ...prev,
        sentenceWords,
        wordScores: scores ?? prev.wordScores,
        stage: 'read',
      }));
    } else {
      setState((prev) => ({
        ...prev,
        sentenceWords,
        wordScores: scores ?? prev.wordScores,
        stage: 'write',
      }));
    }
  };

  const onStartSentenceWrite = (
    seenOffsets: Record<string, { offset: number; text: string; english: string }>,
  ): void => {
    if (state.sentenceWriteEnabled) {
      setState((prev) => ({ ...prev, stage: 'write', seenOffsets }));
    } else {
      setState((prev) => ({ ...prev, stage: 'summary' }));
    }
  };

  const onVocabComplete = (scores: WordScore[]): void => {
    setState((prev) => ({ ...prev, wordScores: scores, stage: 'summary' }));
  };

  const onSentenceWriteComplete = (): void => {
    setState((prev) => ({ ...prev, stage: 'summary' }));
  };

  // All dev stages require auth since they use real words from user's bank
  // Wait for auth to initialize before redirecting
  if (devConfig && !authInitialized) {
    return <Spinner />;
  }
  if (userId === null && !isDemo) {
    return <Redirect to="/" />;
  }

  let content: React.ReactNode = null;

  if (state.selectedWords.length > 0) {
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
              startSentenceRead={(sentenceWords: Word[], scores?: WordScore[]) =>
                onStartSentenceRead(sentenceWords, scores)
              }
              onVocabComplete={onVocabComplete}
              finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
              devTestFinished={state.devTestFinished}
              practiceMode={state.practiceMode}
            />
          </ErrorBoundary>
        );

        break;
      case 'read':
        content = (
          <ErrorBoundary>
            <SentenceRead
              words={state.sentenceWords}
              startSentenceWrite={onStartSentenceWrite}
              sentenceWriteEnabled={state.sentenceWriteEnabled}
              isDemo={isDemo}
            />
          </ErrorBoundary>
        );
        break;
      case 'write':
        content = (
          <ErrorBoundary>
            <SentenceWrite
              words={state.sentenceWords}
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
            startSentenceRead={(sentenceWords: Word[], scores?: WordScore[]) =>
              onStartSentenceRead(sentenceWords, scores)
            }
            onVocabComplete={onVocabComplete}
            finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
            practiceMode={state.practiceMode}
          />
        );
    }
  } else if (wordsLoading) {
    // Still loading words from user's bank
    content = <Spinner />;
  } else {
    // Check if user has words in bank (even if none due)
    const hasWordsInBank = words.length > 0;

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
          {hasWordsInBank && (
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
    if (state.sentenceReadEnabled || state.sentenceWriteEnabled) steps.push('Practice');
    steps.push('Done');

    const stageToStep: Partial<Record<Stage, number>> = {
      new: steps.indexOf('Learn'),
      vocab: steps.indexOf('Test'),
      read: steps.indexOf('Practice'),
      write: steps.indexOf('Practice'),
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
