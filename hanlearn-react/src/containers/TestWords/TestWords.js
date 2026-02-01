import React, { Component } from "react";
import { connect } from "react-redux";
import * as wordActions from "../../store/actions/index";
import { Redirect } from "react-router-dom";

import Modal from "../../components/UI/Modal/Modal";
import Button from "../../components/UI/Buttons/Button/Button";
import Test from "../../components/Test/Test";
import SentenceWrite from "../../components/Test/SentenceWrite/SentenceWrite";
import SentenceRead from "../../components/Test/SentenceRead/SentenceRead";
import NewWords from "../../components/Test/NewWords/NewWords";

import * as testLogic from "../../components/Test/Logic/TestLogic";

// set to null for normal functionality
const STAGE_OVERRIDE = null;

const startingWords = STAGE_OVERRIDE ? [{ simp: "大学" }] : [];

class TestWords extends Component {
  state = {
    sentenceWords: startingWords,
    stage: STAGE_OVERRIDE || "new",
    numWords: localStorage.getItem("numWords") || 5,
    newWords: startingWords,
    selectedWords: startingWords,
    newWordsEnabled:
      localStorage.getItem("newWords") === "false" ? false : true,
    sentenceReadEnabled:
      localStorage.getItem("sentenceRead") === "false" ? false : true,
    sentenceWriteEnabled:
      localStorage.getItem("sentenceWrite") === "false" ? false : true,
  };

  componentDidMount() {
    if (!this.props.isDemo && this.props.token !== null) {
      this.props.onInitWords(this.props.token);
    }

    if (!STAGE_OVERRIDE) {
      this.setSelectedWords();
    }

    window.speechSynthesis.getVoices();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.words.length === 0 && this.props.words.length > 0) {
      this.setSelectedWords();
    }
  }

  setSelectedWords = () => {
    if (this.props.isDemo) {
      const words = [
        {
          simp: "你好",
          trad: "你好",
          pinyin: "ni3 hao3",
          meaning: "hello/hi",
          due_date: new Date(),
          bank: 1,
        },
      ];
      this.setState({
        newWords: words,
        selectedWords: words,
      });
      return;
    }
    let selectedWords = this.selectTestWords();

    let newWords = selectedWords.filter((word) => word.bank === 1);

    if (newWords.length === 0 || !this.state.newWordsEnabled) {
      this.setState({
        stage: "vocab",
        newWords: newWords,
        selectedWords: selectedWords,
      });
    } else {
      this.setState({
        stage: "new",
        newWords: newWords,
        selectedWords: selectedWords,
      });
    }
  };

  onClickAddWords = () => {
    this.props.history.push("/add-words");
  };

  onStartVocab = () => {
    this.setState({
      stage: "vocab",
    });
  };

  onStartSentenceRead = (sentenceWords) => {
    if (this.state.sentenceReadEnabled) {
      this.setState({
        sentenceWords: sentenceWords,
        stage: "read",
      });
    } else {
      this.setState({
        sentenceWords: sentenceWords,
        stage: "write",
      });
    }
  };

  onStartSentenceWrite = () => {
    if (this.state.sentenceWriteEnabled) {
      this.setState({
        stage: "write",
      });
    }
  };

  selectTestWords = () => {
    let allWords = this.props.words.slice();

    const nonChengyus = allWords.filter(word => word.simp.length < 4);

    let actualNumWords =
      nonChengyus.length >= this.state.numWords
        ? this.state.numWords
        : nonChengyus.length;
    let selectedWords = testLogic.chooseTestSet(nonChengyus, actualNumWords);

    return selectedWords;
  };

  render() {
    if (this.props.token === null && !this.props.isDemo) {
      return <Redirect to="/" />;
    }

    let content = null;

    if (this.state.selectedWords.length > 0) {
      switch (this.state.stage) {
        case "new":
          content = (
            <NewWords
              words={this.state.newWords}
              startTest={this.onStartVocab}
              isDemo={this.props.isDemo}
            />
          );
          break;
        case "vocab":
          content = (
            <Test
              isDemo={this.props.isDemo}
              words={this.state.selectedWords}
              startSentenceRead={(sentenceWords) =>
                this.onStartSentenceRead(sentenceWords)
              }
              finalStage={
                !this.state.sentenceReadEnabled &&
                !this.state.sentenceWriteEnabled
              }
            />
          );

          break;
        case "read":
          content = (
            <SentenceRead
              words={this.state.sentenceWords}
              startSentenceWrite={this.onStartSentenceWrite}
              sentenceWriteEnabled={this.state.sentenceWriteEnabled}
            />
          );
          break;
        case "write":
          content = <SentenceWrite words={this.state.sentenceWords} />;
          break;
        default:
          content = (
            <Test
              words={this.state.selectedWords}
              startSentenceRead={(sentenceWords) =>
                this.onStartSentenceRead(sentenceWords)
              }
              finalStage={
                !this.state.sentenceReadEnabled &&
                !this.state.sentenceWriteEnabled
              }
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

const mapStateToProps = (state) => {
  return {
    words: state.addWords.words,
    token: state.auth.token,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onInitWords: (token) => dispatch(wordActions.initWords(token)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(TestWords);
