import React, { Component } from "react";
import { connect } from "react-redux";
import * as wordActions from "../../store/actions/index";
import { Redirect } from "react-router-dom";

import Modal from "../../components/UI/Modal/Modal";
import Button from "../../components/UI/Buttons/Button/Button";
import TestChengyusTest from "../../components/TestChengyusTest/TestChengyusTest";

import * as testLogic from "../../components/Test/Logic/TestLogic";

class TestChengyus extends Component {
    state = {
        selectedWords: [],
    };

    componentDidMount() {
        if (this.props.token !== null) {
            this.props.onInitWords(this.props.token);
        }

        this.setSelectedWords();

        window.speechSynthesis.getVoices();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.words.length === 0 && this.props.words.length > 0) {
            this.setSelectedWords();
        }
    }

    setSelectedWords = () => {
        let selectedWords = this.selectTestWords();
        this.setState({
            selectedWords: selectedWords,
        });
    };

    onClickAddWords = () => {
        this.props.history.push("/add-words");
    };

    selectTestWords = () => {
        let allWords = this.props.words.slice();

        const chengyus = allWords.filter((word) => word.simp.length >= 4);

        let actualNumWords =
            chengyus.length >= this.state.numWords
                ? this.state.numWords
                : chengyus.length;
        let selectedWords = testLogic.chooseTestSet(chengyus, actualNumWords);

        return selectedWords;
    };

    render() {
        if (this.props.token === null && !this.props.isDemo) {
            return <Redirect to="/" />;
        }

        let content = null;

        if (this.state.selectedWords.length > 0) {
            content = (
                <TestChengyusTest
                    words={this.state.selectedWords}
                />
            );
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

export default connect(mapStateToProps, mapDispatchToProps)(TestChengyus);
