import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';

import * as wordActions from '../../store/actions/index';

import Modal from '../../components/UI/Modal/Modal';
import Button from '../../components/UI/Buttons/Button/Button';
import TestChengyusTest from '../../components/TestChengyusTest/TestChengyusTest';

import * as testLogic from '../../components/Test/Logic/TestLogic';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';

interface TestChengyusState {
  selectedWords: Word[];
  numWords: number;
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  token: state.auth.token,
});

const mapDispatchToProps = {
  onInitWords: wordActions.initWords,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const TestChengyus: React.FC<Props> = ({
  words,
  token,
  isDemo,
  onInitWords,
  history,
}) => {
  const [state, setState] = useState<TestChengyusState>({
    selectedWords: [],
    numWords: 5,
  });

  const selectTestWords = useCallback((): Word[] => {
    const allWords = words.slice();
    const chengyus = allWords.filter((word) => word.simp.length >= 4);
    const actualNumWords =
      chengyus.length >= state.numWords ? state.numWords : chengyus.length;
    const selectedWords = testLogic.chooseTestSet(chengyus, actualNumWords);

    return selectedWords;
  }, [state.numWords, words]);

  const setSelectedWords = useCallback((): void => {
    const selectedWords = selectTestWords();
    setState((prev) => ({
      ...prev,
      selectedWords: selectedWords,
    }));
  }, [selectTestWords]);

  useEffect(() => {
    if (token !== null) {
      onInitWords(token);
    }

    setSelectedWords();
    window.speechSynthesis.getVoices();
  }, [onInitWords, setSelectedWords, token]);

  useEffect(() => {
    if (words.length > 0) {
      setSelectedWords();
    }
  }, [setSelectedWords, words.length]);

  const onClickAddWords = (): void => {
    history.push('/add-words');
  };

  if (token === null && !isDemo) {
    return <Redirect to="/" />;
  }

  let content: React.ReactNode = null;

  if (state.selectedWords.length > 0) {
    content = <TestChengyusTest words={state.selectedWords} />;
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

export default withRouter(connector(TestChengyus));
