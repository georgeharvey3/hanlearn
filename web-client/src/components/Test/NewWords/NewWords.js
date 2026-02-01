import React, { Component } from "react";

import Button from "../../UI/Buttons/Button/Button";
import NewWord from "./NewWord/NewWord";

import classes from "./NewWords.module.css";

class NewWords extends Component {
    state = {
        wordIndex: 0,
    };

    componentDidMount = () => {
        document.addEventListener("keydown", this.onKeyDown);
    };

    componentWillUnmount = () => {
        document.removeEventListener("keydown", this.onKeyDown);
    };

    onChangeWord = (direction) => {
        this.setState((prevState) => {
            return {
                wordIndex: prevState.wordIndex + direction,
                charData: null,
            };
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
    };

    render() {
        return (
            <div className={classes.NewWords}>
                <h2>New Words</h2>
                <h4>Click on a character to see information</h4>
                <NewWord
                    word={this.props.words[this.state.wordIndex]}
                    isDemo={this.props.isDemo}
                ></NewWord>
                <Button
                    clicked={() => this.onChangeWord(-1)}
                    disabled={this.state.wordIndex < 1}
                >
                    Previous Word
                </Button>
                <Button
                    clicked={() => {
                        if (
                            this.state.wordIndex <
                            this.props.words.length - 1
                        ) {
                            this.onChangeWord(1);
                        } else {
                            this.props.startTest();
                        }
                    }}
                >
                    {this.state.wordIndex < this.props.words.length - 1
                        ? "Next Word"
                        : "Start Test"}
                </Button>
            </div>
        );
    }
}

export default NewWords;
