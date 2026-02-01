import React, { Component } from 'react';
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
  token: state.auth.token,
});

const mapDispatchToProps = {
  onInitWords: wordActions.initWords,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & OwnProps & RouteComponentProps;

class TestWords extends Component<Props, TestWordsState> {
  state: TestWordsState = {
    sentenceWords: startingWords,
    stage: (STAGE_OVERRIDE as Stage) || 'new',
    numWords: parseInt(localStorage.getItem('numWords') || '5', 10),
    newWords: startingWords,
    selectedWords: startingWords,
    newWordsEnabled: localStorage.getItem('newWords') === 'false' ? false : true,
    sentenceReadEnabled: localStorage.getItem('sentenceRead') === 'false' ? false : true,
    sentenceWriteEnabled: localStorage.getItem('sentenceWrite') === 'false' ? false : true,
  };

  componentDidMount(): void {
    if (!this.props.isDemo && this.props.token !== null) {
      this.props.onInitWords(this.props.token);
    }

    if (!STAGE_OVERRIDE) {
      this.setSelectedWords();
    }

    window.speechSynthesis.getVoices();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.words.length === 0 && this.props.words.length > 0) {
      this.setSelectedWords();
    }
  }

  setSelectedWords = (): void => {
    if (this.props.isDemo) {
      const words: Word[] = [
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
      this.setState({
        newWords: words,
        selectedWords: words,
      });
      return;
    }
    const selectedWords = this.selectTestWords();

    const newWords = selectedWords.filter((word) => word.bank === 1);

    if (newWords.length === 0 || !this.state.newWordsEnabled) {
      this.setState({
        stage: 'vocab',
        newWords: newWords,
        selectedWords: selectedWords,
      });
    } else {
      this.setState({
        stage: 'new',
        newWords: newWords,
        selectedWords: selectedWords,
      });
    }
  };

  onClickAddWords = (): void => {
    this.props.history.push('/add-words');
  };

  onStartVocab = (): void => {
    this.setState({
      stage: 'vocab',
    });
  };

  onStartSentenceRead = (sentenceWords: Word[]): void => {
    if (this.state.sentenceReadEnabled) {
      this.setState({
        sentenceWords: sentenceWords,
        stage: 'read',
      });
    } else {
      this.setState({
        sentenceWords: sentenceWords,
        stage: 'write',
      });
    }
  };

  onStartSentenceWrite = (): void => {
    if (this.state.sentenceWriteEnabled) {
      this.setState({
        stage: 'write',
      });
    }
  };

  selectTestWords = (): Word[] => {
    const allWords = this.props.words.slice();

    const nonChengyus = allWords.filter((word) => word.simp.length < 4);

    const actualNumWords =
      nonChengyus.length >= this.state.numWords ? this.state.numWords : nonChengyus.length;
    const selectedWords = testLogic.chooseTestSet(nonChengyus, actualNumWords);

    return selectedWords;
  };

  render(): React.ReactNode {
    if (this.props.token === null && !this.props.isDemo) {
      return <Redirect to="/" />;
    }

    let content: React.ReactNode = null;

    if (this.state.selectedWords.length > 0) {
      switch (this.state.stage) {
        case 'new':
          content = (
            <NewWords
              words={this.state.newWords}
              startTest={this.onStartVocab}
              isDemo={this.props.isDemo}
            />
          );
          break;
        case 'vocab':
          content = (
            <Test
              isDemo={this.props.isDemo}
              words={this.state.selectedWords}
              startSentenceRead={(sentenceWords: Word[]) => this.onStartSentenceRead(sentenceWords)}
              finalStage={!this.state.sentenceReadEnabled && !this.state.sentenceWriteEnabled}
            />
          );

          break;
        case 'read':
          content = (
            <SentenceRead
              words={this.state.sentenceWords}
              startSentenceWrite={this.onStartSentenceWrite}
              sentenceWriteEnabled={this.state.sentenceWriteEnabled}
            />
          );
          break;
        case 'write':
          content = <SentenceWrite words={this.state.sentenceWords} />;
          break;
        default:
          content = (
            <Test
              words={this.state.selectedWords}
              startSentenceRead={(sentenceWords: Word[]) => this.onStartSentenceRead(sentenceWords)}
              finalStage={!this.state.sentenceReadEnabled && !this.state.sentenceWriteEnabled}
            />
          );
      }
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

export default withRouter(connector(TestWords));
