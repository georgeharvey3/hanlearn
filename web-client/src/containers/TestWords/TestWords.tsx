import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';

import * as wordActions from '../../store/actions/index';

import Modal from '../../components/UI/Modal/Modal';
import Button from '../../components/UI/Buttons/Button/Button';
import Test from '../../components/Test/Test';
import SentenceWrite from '../../components/Test/SentenceWrite/SentenceWrite';
import SentenceRead from '../../components/Test/SentenceRead/SentenceRead';
import NewWords from '../../components/Test/NewWords/NewWords';

import * as testLogic from '../../components/Test/Logic/TestLogic';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';

// set to null for normal functionality
const STAGE_OVERRIDE: string | null = null;

const startingWords: Word[] = STAGE_OVERRIDE
  ? [{ simp: '大学', trad: '大學', pinyin: 'da4 xue2', meaning: 'university', id: 0 }]
  : [];

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
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  userId: state.auth.userId,
});

const mapDispatchToProps = {
  onInitWords: wordActions.initWords,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const TestWords: React.FC<Props> = ({
  words,
  userId,
  isDemo,
  onInitWords,
  history,
}) => {
  const [state, setState] = useState<TestWordsState>({
    sentenceWords: startingWords,
    stage: (STAGE_OVERRIDE as Stage) || 'new',
    numWords: parseInt(localStorage.getItem('numWords') || '5', 10),
    newWords: startingWords,
    selectedWords: startingWords,
    newWordsEnabled: localStorage.getItem('newWords') === 'false' ? false : true,
    sentenceReadEnabled: localStorage.getItem('sentenceRead') === 'false' ? false : true,
    sentenceWriteEnabled: localStorage.getItem('sentenceWrite') === 'false' ? false : true,
  });

  const prevWordsLength = useRef(words.length);

  const selectTestWords = useCallback((): Word[] => {
    const allWords = words.slice();
    const nonChengyus = allWords.filter((word) => word.simp.length < 4);
    const actualNumWords =
      nonChengyus.length >= state.numWords ? state.numWords : nonChengyus.length;
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

  useEffect(() => {
    if (!isDemo && userId !== null) {
      onInitWords();
    }

    if (!STAGE_OVERRIDE) {
      setSelectedWords();
    }

    window.speechSynthesis.getVoices();
  }, [isDemo, onInitWords, setSelectedWords, userId]);

  useEffect(() => {
    if (prevWordsLength.current === 0 && words.length > 0) {
      setSelectedWords();
    }
    prevWordsLength.current = words.length;
  }, [setSelectedWords, words.length]);

  const onClickAddWords = (): void => {
    history.push('/add-words');
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

  if (userId === null && !isDemo) {
    return <Redirect to="/" />;
  }

  let content: React.ReactNode = null;

  if (state.selectedWords.length > 0) {
    switch (state.stage) {
      case 'new':
        content = (
          <NewWords words={state.newWords} startTest={onStartVocab} isDemo={isDemo} />
        );
        break;
      case 'vocab':
        content = (
          <Test
            isDemo={isDemo}
            words={state.selectedWords}
            startSentenceRead={(sentenceWords: Word[]) => onStartSentenceRead(sentenceWords)}
            finalStage={!state.sentenceReadEnabled && !state.sentenceWriteEnabled}
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
          />
        );
    }
  } else {
    content = (
      <Modal show>
        <p>You have no words to test!</p>
        <Button clicked={onClickAddWords}>Add Words</Button>
      </Modal>
    );
  }

  return content;
};

export default withRouter(connector(TestWords));
