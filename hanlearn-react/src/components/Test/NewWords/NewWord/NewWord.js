import React, { Component } from "react";
import { connect } from "react-redux";

import Aux from "../../../../hoc/Aux";

import classes from "./NewWord.module.css";

class NewWord extends Component {
    state = {
        charData: null,
        charSet: localStorage.getItem("charSet") || "simp",
        errorMessage: "",
        useSound:
            localStorage.getItem("useSound") === "false" ||
            !this.props.synthAvailable
                ? false
                : true,
    };

    componentDidMount = () => {
        if (this.state.useSound) {
            this.onSpeakPinyin(this.props.word[this.state.charSet]);
        }
    };

    componentDidUpdate(prevProps) {
        if (prevProps.word.id !== this.props.word.id) {
            if (this.state.useSound) {
                this.onSpeakPinyin(this.props.word[this.state.charSet]);
            }
            this.setState({
                charData: null,
            });
        }
    }

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

    onCharacterClick = (char) => {
        this.onDisplayMeaning(char);
        if (
            this.state.useSound ||
            (this.props.isDemo && this.props.synthAvailable)
        ) {
            this.onSpeakPinyin(char);
        }
    };

    render() {
        let chars = this.props.word[this.state.charSet].split("");

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
            <div className={classes.NewWordWrapper}>
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
                    <p style={{ fontSize: "0.6em" }}>
                        ({this.props.word.pinyin})
                    </p>
                    {this.props.isAddedWord ? (
                        <p
                            style={{ fontSize: "0.7em", marginTop: "5px" }}
                            contentEditable
							suppressContentEditableWarning
                            data-new-word-meaning
                            onKeyPress={this.props.meaningKeyPressed}
                            onBlur={this.props.meaningBlurred}
							data-orig={this.props.originalMeaning}
                        >
                            {this.props.word.meaning}
                        </p>
                    ) : (
                        <p style={{ fontSize: "0.7em", marginTop: "5px" }}>
                            {this.props.word.meaning}
                        </p>
                    )}
                </div>
                <div style={{ minHeight: "250px" }}>{charInfo}</div>
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

export default connect(mapStateToProps)(NewWord);
