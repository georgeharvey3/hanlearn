import React, { Component } from "react";
import { connect } from "react-redux";

import Aux from "../../hoc/Aux";
import Button from "../UI/Buttons/Button/Button";

import classes from "./TestChengyusTest.module.css";

class TestChengyusTest extends Component {
    state = {
        wordIndex: 0,
        charSet: localStorage.getItem("charSet") || "simp",
        charData: null,
        errorMessage: "",
        showChengyuMeaning: false,
        useSound:
            localStorage.getItem("useSound") === "false" ||
            !this.props.synthAvailable
                ? false
                : true,
    };

    componentDidMount = () => {
        document.addEventListener("keydown", this.onKeyDown);
        if (this.state.useSound) {
            this.onSpeakPinyin(this.props.words[0][this.state.charSet]);
        }
    };

    componentDidUpdate = (_, prevState) => {
        if (this.state.wordIndex !== prevState.wordIndex) {
            if (this.state.useSound) {
                this.onSpeakPinyin(
                    this.props.words[this.state.wordIndex][this.state.charSet]
                );
            }
        }
    };

    componentWillUnmount = () => {
        document.removeEventListener("keydown", this.onKeyDown);
    };

    onSpeakPinyin = (word) => {
        let synth = window.speechSynthesis;
        let utterThis = new SpeechSynthesisUtterance(word);
        utterThis.lang = this.props.lang;
        utterThis.voice = this.props.voice;
        utterThis.onerror = (e) => {
            if (e.error === "synthesis-failed") {
                this.setState({
                    result: "Error playing pinyin",
                    showPinyin: true,
                });
            }
        };
        synth.cancel();
        synth.speak(utterThis);
    };

    onChangeWord = (direction) => {
        this.setState((prevState) => {
            return {
                wordIndex: prevState.wordIndex + direction,
                charData: null,
                showChengyuMeaning: false
            };
        });
    };

    onDisplayMeaning = (char) => {
        fetch(`/api/lookup-chengyu-char/${char}`).then((response) => {
            if (response.ok) {
                response.json().then((data) => {
                    this.setState({
                        charData: data,
                    });
                });
            } else {
                this.setState({
                    errorMessage: "Error looking up character",
                });
            }
        });
    };

    onKeyDown = (event) => {
        if (event.key === "ArrowLeft") {
            if (this.state.wordIndex > 0) {
                this.onChangeWord(-1);
            }
        }

        if (event.key === "ArrowRight") {
            if (this.state.wordIndex < this.props.words.length - 1) {
                this.onChangeWord(1);
            } else {
                this.props.startTest();
            }
        }

        if (event.key === ' ') {
            this.onToggleAnswer();
        }
    };

    onCharacterClick = (char) => {
        this.onDisplayMeaning(char);
        if (
            this.state.useSound ||
            (this.props.isDemo && this.props.synthAvailable)
        ) {
            this.onSpeakPinyin(char);
        }
    };

    onToggleAnswer = () => {
        this.setState((prevState) => ({
            showChengyuMeaning: !prevState.showChengyuMeaning,
        }));
    };

    render() {
        let chars =
            this.props.words[this.state.wordIndex][this.state.charSet].split(
                ""
            );

        let charInfo = null;

        if (this.state.charData !== null) {
            charInfo = (
                <Aux>
                    <p style={{ fontSize: "3em" }}>
                        {this.state.charData.simp}
                    </p>
                    <p style={{ fontSize: "1.5em" }}>
                        ({this.state.charData.pinyins.join("/")})
                    </p>
                    <p style={{ fontSize: "1.1em" }}>
                        {this.state.charData.meanings.join(" / ")}
                    </p>
                </Aux>
            );
        }

        return (
            <div className={classes.TestChengyusTest}>
                <h4>Click on a character to see information</h4>
                <div className={classes.CharCard}>
                    <div className={classes.CharHolder}>
                        {chars.map((char, index) => {
                            return (
                                <div key={index}>
                                    <p
                                        className={classes.Char}
                                        onClick={() =>
                                            this.onCharacterClick(char)
                                        }
                                    >
                                        {char}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                    {this.state.showChengyuMeaning ? (
                        <Aux>
                            <p style={{ fontSize: "0.6em" }}>
                                ({this.props.words[this.state.wordIndex].pinyin}
                                )
                            </p>
                            <p style={{ fontSize: "1.1em" }}>
                                {this.props.words[this.state.wordIndex].meaning}
                            </p>
                        </Aux>
                    ) : null}
                </div>
                <a target="_blank" style={{"color": "#E6E0AE"}} href={`https://baike.baidu.com/item/${this.props.words[this.state.wordIndex].simp}`}>
                    Lookup chengyu information
                </a>
                <div style={{ minHeight: "250px" }}>{charInfo}</div>
                <Button
                    style={{ width: "230px", margin: "0 auto" }}
                    clicked={this.onToggleAnswer}
                >
                    {this.state.showChengyuMeaning ? 'Hide': 'Show'} Answer
                </Button>
                <br />
                <Button
                    clicked={() => this.onChangeWord(-1)}
                    disabled={this.state.wordIndex < 1}
                >
                    Previous
                </Button>
                <Button
                    clicked={() => this.onChangeWord(1)}
                    disabled={this.state.wordIndex === this.props.words.length - 1}
                >
                    Next
                </Button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        synthAvailable: state.settings.synthAvailable,
        voice: state.settings.voice,
        lang: state.settings.lang,
    };
};

export default connect(mapStateToProps)(TestChengyusTest);
