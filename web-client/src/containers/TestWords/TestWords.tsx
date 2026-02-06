import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';

import * as wordActions from '../../store/actions/index';

import Modal from '../../components/UI/Modal/Modal';
import Button from '../../components/UI/Buttons/Button/Button';
import Spinner from '../../components/UI/Spinner/Spinner';
import Test from '../../components/Test/Test';
import SentenceWrite from '../../components/Test/SentenceWrite/SentenceWrite';
import SentenceRead from '../../components/Test/SentenceRead/SentenceRead';
import NewWords from '../../components/Test/NewWords/NewWords';

import * as testLogic from '../../components/Test/Logic/TestLogic';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import { getDevTestConfig, DevTestConfig } from '../../utils/devTestMode';

// Dev test mode config - loaded once on mount
const devConfig: DevTestConfig | null = getDevTestConfig();

type Stage = 'new' | 'vocab' | 'read' | 'write';

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
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  wordsLoading: state.addWords.loading,
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
});

const mapDispatchToProps = {
  onInitWords: wordActions.initWords,
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
  onInitWords,
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
    numWords: parseInt(localStorage.getItem('numWords') || '5', 10),
    newWords: [],
    selectedWords: [],
    newWordsEnabled: localStorage.getItem('newWords') === 'false' ? false : true,
    sentenceReadEnabled: localStorage.getItem('sentenceRead') === 'false' ? false : true,
    sentenceWriteEnabled: localStorage.getItem('sentenceWrite') === 'false' ? false : true,
    devTestFinished: devConfig?.testFinished ?? false,
    practiceMode: false,
  });

  const prevWordsLength = useRef(words.length);

  const selectTestWords = useCallback((ignoreDueDates = false): Word[] => {
    const allWords = words.slice();
    const nonChengyus = allWords.filter((word) => word.simp.length < 4);
    const actualNumWords =
      nonChengyus.length >= state.numWords ? state.numWords : nonChengyus.length;
    if (ignoreDueDates) {
      return testLogic.chooseRandomTestSet(nonChengyus, actualNumWords);
    }
    return testLogic.chooseTestSet(nonChengyus, actualNumWords);
  }, [state.numWords, words]);

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

  useEffect(() => {
    if (!isDemo && userId !== null) {
      onInitWords();
    }

    window.speechSynthesis.getVoices();
  }, [isDemo, onInitWords, userId]);

  // Separate effect for initial word selection - only runs once when words are first available
  useEffect(() => {
    if (!hasInitialized.current && words.length > 0) {
      hasInitialized.current = true;

      if (devConfig) {
        // For dev stages, use actual words from user's bank
        const selectedWords = selectTestWords();
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
  }, [selectTestWords, setSelectedWords, words.length]);

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

  const onStartSentenceRead = (sentenceWords: Word[]): void => {
    if (state.sentenceReadEnabled) {
      setState((prev) => ({
        ...prev,
        sentenceWords: sentenceWords,
        stage: 'read',
      }));
    } else {
      setState((prev) => ({
        ...prev,
        sentenceWords: sentenceWords,
        stage: 'write',
      }));
    }
  };

  const onStartSentenceWrite = (): void => {
    if (state.sentenceWriteEnabled) {
      setState((prev) => ({ ...prev, stage: 'write' }));
    }
  };

  // All dev stages require auth since they use real words from user's bank
  // Wait for auth to initialize before redirecting
  if (devConfig && !authInitialized) {
    return null;
  }
  if (userId === null && !isDemo) {
    return <Redirect to="/" />;
  }

  let content: React.ReactNode = null;

  if (state.selectedWords.length > 0) {
    switch (state.stage) {
      case 'new':
        content = (
          <NewWords words={state.newWords} startTest={onStartVocab} isDemo={isDemo || !!devConfig} />
        );
        break;
      case 'vocab':
        content = (
          <Test
            isDemo={isDemo || !!devConfig}
            words={state.selectedWords}
            startSentenceRead={(sentenceWords: Word[]) => onStartSentenceRead(sentenceWords)}
            finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
            devTestFinished={state.devTestFinished}
            practiceMode={state.practiceMode}
          />
        );

        break;
      case 'read':
        content = (
          <SentenceRead
            words={state.sentenceWords}
            startSentenceWrite={onStartSentenceWrite}
            sentenceWriteEnabled={state.sentenceWriteEnabled}
          />
        );
        break;
      case 'write':
        content = <SentenceWrite words={state.sentenceWords} />;
        break;
      default:
        content = (
          <Test
            words={state.selectedWords}
            startSentenceRead={(sentenceWords: Word[]) => onStartSentenceRead(sentenceWords)}
            finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
            practiceMode={state.practiceMode}
          />
        );
    }
  } else if (devConfig && (wordsLoading || !hasInitialized.current)) {
    // Still loading words from user's bank for dev stages
    content = <Spinner />;
  } else {
    // Check if user has words in bank (even if none due)
    const nonChengyus = words.filter((word) => word.simp.length < 4);
    const hasWordsInBank = nonChengyus.length > 0;

    content = (
      <Modal show>
        <p>You have no words due for testing!</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Button clicked={onClickAddWords}>Add Words</Button>
          {hasWordsInBank && (
            <Button clicked={onStartPractice}>Practice</Button>
          )}
        </div>
      </Modal>
    );
  }

  return content;
};

export default withRouter(connector(TestWords));
