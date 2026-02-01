import React, { Component } from 'react';
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

class TestChengyus extends Component<Props, TestChengyusState> {
  state: TestChengyusState = {
    selectedWords: [],
    numWords: 5,
  };

  componentDidMount(): void {
    if (this.props.token !== null) {
      this.props.onInitWords(this.props.token);
    }

    this.setSelectedWords();

    window.speechSynthesis.getVoices();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.words.length === 0 && this.props.words.length > 0) {
      this.setSelectedWords();
    }
  }

  setSelectedWords = (): void => {
    const selectedWords = this.selectTestWords();
    this.setState({
      selectedWords: selectedWords,
    });
  };

  onClickAddWords = (): void => {
    this.props.history.push('/add-words');
  };

  selectTestWords = (): Word[] => {
    const allWords = this.props.words.slice();

    const chengyus = allWords.filter((word) => word.simp.length >= 4);

    const actualNumWords =
      chengyus.length >= this.state.numWords ? this.state.numWords : chengyus.length;
    const selectedWords = testLogic.chooseTestSet(chengyus, actualNumWords);

    return selectedWords;
  };

  render(): React.ReactNode {
    if (this.props.token === null && !this.props.isDemo) {
      return <Redirect to="/" />;
    }

    let content: React.ReactNode = null;

    if (this.state.selectedWords.length > 0) {
      content = <TestChengyusTest words={this.state.selectedWords} />;
    } else {
      content = (
        <Modal show>
          <p>You have no words to test!</p>
          <Button clicked={this.onClickAddWords}>Add Words</Button>
        </Modal>
      );
    }

    return content;
  }
}

export default withRouter(connector(TestChengyus));
