import React, { Component } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Howl } from "howler";

import Button from "../../UI/Buttons/Button/Button";
import PictureButton from "../../UI/Buttons/PictureButton/PictureButton";
import Aux from "../../../hoc/Aux";
import Modal from "../../UI/Modal/Modal";
import Table from "../../UI/Table/Table";
import TableRow from "../../UI/Table/TableRow/TableRow";

import micPic from "../../../assets/images/microphone.png";
import likePic from "../../../assets/images/like.png";
import dislikePic from "../../../assets/images/dislike.png";

import classes from "./SentenceWrite.module.css";

import successSound from "../../../assets/sounds/success1.wav";
import failSound from "../../../assets/sounds/failure1.wav";

let pinyinConverter = require("pinyin");

const beep = new Howl({
  src: [successSound],
  volume: 0.5,
});

const fail = new Howl({
  src: [failSound],
  volume: 0.7,
});

class SentenceWrite extends Component {
  state = {
    currentWord: null,
    wordIndex: 0,
    charSet: localStorage.getItem("charSet") || "simp",
    useChineseSpeechRecognition:
      localStorage.getItem("useChineseSpeechRecognition") === "false" ||
      !this.props.speechAvailable
        ? false
        : true,
    useSound:
      localStorage.getItem("useSound") === "false" || !this.props.synthAvailable
        ? false
        : true,
    finished: false,
    sentence: null,
    chineseSentence: null,
    entered: "",
    enteredEnglish: "",
    error: false,
    errorMessage: "",
    message: "",
    sentences: [],
    usedWords: [],
    translatedEnglish: "",
    lastEnteredEnglish: "",
    englishTranslationLoading: false,
  };

  componentDidMount = () => {
    document.addEventListener("keyup", this.onKeyUp);
  };

  componentWillUnmount = () => {
    document.removeEventListener("keyup", this.onKeyUp);
  };

  onKeyUp = (event) => {
    let sourceElement = event.target.tagName.toLowerCase();

    let finished = this.state.usedWords.length === this.props.words.length;

    if (event.key === " ") {
      if (finished) {
        // advance to next stage
        event.preventDefault();
        this.onHomeClicked();
      } else if (sourceElement !== "input") {
        // start recording
        this.onListenPinyin();
      }
    }

    if (event.ctrlKey && event.key === "m") {
      if (!finished) {
        //start recording
        this.onListenPinyin();
      }
    }

    if (event.ctrlKey && event.key === "b") {
      // focus on input
      document.getElementById("answerInput").focus();
    }

    if (event.key === "ArrowUp" && this.state.sentence !== null) {
      // approve sentence
      this.onYesClicked();
    }

    if (event.key === "ArrowDown" && this.state.sentence !== null) {
      // reject sentence
      this.onNoClicked();
    }
  };

  onInputKeyPress = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    let sentence = event.target.value;

    let containsWord = false;

    this.props.words.forEach((word) => {
      if (sentence.includes(word[this.state.charSet])) {
        containsWord = true;
      }
    });

    if (containsWord) {
      this.setState({
        error: false,
        errorMessage: "",
        message: "Translating...",
      });
      document.getElementById("answerInput").blur();
      this.translateSentence(sentence);
    } else {
      this.setState({
        error: true,
        errorMessage: "Sentence does not contain word!",
      });
    }
  };

  translateSentence = (sentence) => {
    const apiKey = "95b7061f-d806-ef5b-3fd1-c3ea287ce9fb:fx";
    fetch(
      `https://api-free.deepl.com/v2/translate?auth_key=${apiKey}&text=${sentence}&target_lang=EN`
    )
      .then((res) =>
        res.json().then((data) => {
          this.setState({
            sentence: data.translations[0].text,
            chineseSentence: sentence,
            message: "Translation:",
          });
        })
      )
      .catch((e) => {
        console.error(e);
      });
  };

  translateEnglishWord = (sentence) => {
    const apiKey = "95b7061f-d806-ef5b-3fd1-c3ea287ce9fb:fx";
    fetch(
      `https://api-free.deepl.com/v2/translate?auth_key=${apiKey}&text=${sentence}&target_lang=ZH`
    )
      .then((res) =>
        res.json().then((data) => {
          this.setState((prevState) => {
            return {
              translatedEnglish: data.translations[0].text,
              englishTranslationLoading: false,
            };
          });
        })
      )
      .catch((e) => {
        console.error(e);
      });
  };

  onNoClicked = () => {
    if (this.state.useSound) {
      fail.play();
    }

    this.setState({
      sentence: null,
      chineseSentence: null,
      entered: "",
      message: "Try again",
    });
  };

  onYesClicked = () => {
    if (this.state.useSound) {
      beep.play();
    }

    let foundWords = this.props.words.filter((word) =>
      this.state.chineseSentence.includes(word[this.state.charSet])
    );

    this.setState((prevState) => {
      return {
        sentence: null,
        chineseSentence: null,
        entered: "",
        enteredEnglish: "",
        translatedEnglish: "",
        message: "",
        sentences: prevState.sentences.concat(prevState.chineseSentence),
        usedWords: prevState.usedWords.concat(foundWords),
      };
    });
  };

  onInputChanged = (event) => {
    this.setState({
      entered: event.target.value,
      error: false,
      errorMessage: "",
    });
  };

  onEnglishInputChanged = (event) => {
    this.setState({
      enteredEnglish: event.target.value,
    });
  };

  onEnglishInputKeyPress = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    this.setState({ englishTranslationLoading: true });
    this.translateEnglishWord(this.state.enteredEnglish);
  };

  onListenPinyin = () => {
    let recognition = new window.webkitSpeechRecognition();
    recognition.lang = "zh-CN";

    this.setState({
      error: false,
      errorMessage: "",
    });

    let result;

    recognition.addEventListener("result", (event) => {
      result = event.results[0][0].transcript;
      this.setState({
        entered: result,
        message: "",
      });
      document.getElementById("answerInput").focus();
    });

    recognition.addEventListener("end", (event) => {
      if (!result) {
        this.setState({
          message: "Couldn't hear anything...",
        });
      }
    });

    recognition.addEventListener("audiostart", (event) => {
      this.setState({ message: "Listening..." });
    });

    recognition.start();
  };

  onHomeClicked = () => {
    this.props.history.push("/");
  };

  findHighlights = (string, words) => {
    let filteredWords = words.filter((word) => string.includes(word));

    let orderedWords = [...filteredWords].sort(
      (a, b) => string.indexOf(a) - string.indexOf(b)
    );

    let highlights = orderedWords.reduce((acc, word, index, arr) => {
      let previousWord = index > 0 ? arr[index - 1] : null;
      let previousStart = previousWord ? string.indexOf(previousWord) : null;
      let previousHighlight = previousStart
        ? [previousStart, previousStart + previousWord.length]
        : null;
      let start = previousHighlight ? previousHighlight[1] : 0;

      let thisStart = string.indexOf(word);
      let thisHighlight = [thisStart, thisStart + word.length];

      let addition = [
        { type: "low", light: [start, thisStart] },
        { type: "high", light: thisHighlight },
      ];

      if (index === arr.length - 1) {
        addition = [
          ...addition,
          { type: "low", light: [thisHighlight[1], string.length] },
        ];
      }

      return [...acc, ...addition];
    }, []);

    return highlights.filter(
      (highlight) => highlight.light[1] - highlight.light[0] > 0
    );
  };

  createElement = (string, words, index) => {
    const highlights = this.findHighlights(string, words);
    const elements = highlights.map((highlight, index) => {
      const text = string.slice(highlight.light[0], highlight.light[1]);

      const className =
        highlight.type === "high" ? classes.Highlighted : classes.Lowlighted;
      return highlight.type === "high" ? (
        <span key={index} className={className}>
          {text}
        </span>
      ) : (
        text
      );
    });

    return <p key={index}>{elements}</p>;
  };

  render() {
    let sentence = null;

    let sentenceText =
      this.state.sentence === null ? null : <h3>"{this.state.sentence}"</h3>;

    if (this.state.usedWords.length < this.props.words.length) {
      let micButton = null;

      if (this.props.speechAvailable) {
        micButton = (
          <PictureButton
            colour="yellow"
            src={micPic}
            clicked={this.onListenPinyin}
          />
        );
      }
      let unusedWords = this.props.words.filter(
        (word) => !this.state.usedWords.includes(word)
      );

      let words = unusedWords.map((word) => {
        return (
          <li key={word[this.state.charSet]}>{word[this.state.charSet]}</li>
        );
      });

      sentence = (
        <div>
          <h2>Create a sentence using...</h2>
          <ul className={classes.WordList}>{words}</ul>

          <input
            autoComplete="off"
            onKeyPress={this.onInputKeyPress}
            value={this.state.entered}
            onChange={this.onInputChanged}
            id="answerInput"
          />
          {micButton}
          <p>{this.state.message}</p>
          {sentenceText}
        </div>
      );
    }

    let buttons = null;
    let errorMessage = null;

    if (this.state.error) {
      errorMessage = <p>{this.state.errorMessage}</p>;
    }

    if (this.state.sentence !== null) {
      let buttonStyle = {
        display: "inline-block",
        width: "50px",
        height: "50px",
        margin: "10px 20px",
      };
      buttons = (
        <div>
          <PictureButton
            style={buttonStyle}
            clicked={this.onYesClicked}
            src={likePic}
          >
            Yes
          </PictureButton>
          <PictureButton
            style={buttonStyle}
            clicked={this.onNoClicked}
            src={dislikePic}
          >
            No
          </PictureButton>
        </div>
      );
    }

    let englishTranslatedMessage = null;

    if (this.state.englishTranslationLoading) {
      englishTranslatedMessage = <h4>Translating...</h4>;
    } else if (this.state.translatedEnglish) {
      let asPinyin = pinyinConverter(this.state.translatedEnglish, {
        style: pinyinConverter.STYLE_TONE2,
      });
      englishTranslatedMessage = (
        <Aux>
          <h4>Translation:</h4>
          <p>{this.state.translatedEnglish}</p>
          <p>{asPinyin.join(" ")}</p>
        </Aux>
      );
    }

    return (
      <Aux>
        <div className={classes.SentenceWrite}>
          {sentence}
          {errorMessage}
          {buttons}
          <h3>English Translator:</h3>
          <input
            value={this.state.enteredEnglish}
            onChange={this.onEnglishInputChanged}
            onKeyPress={this.onEnglishInputKeyPress}
          />
          {englishTranslatedMessage}
        </div>
        <Modal
          show={this.state.usedWords.length === this.props.words.length}
          style={{
            backgroundColor: "rgb(82, 129, 122)",
            top: "20%",
          }}
        >
          <h3>Finished!</h3>
          <Table headings={["Your sentences:"]}>
            {this.state.sentences.map((sentence, index) => {
              const words = this.props.words.map(
                (word) => word[this.state.charSet]
              );
              const elem = this.createElement(sentence, words, index);
              return <TableRow key={index}>{[elem]}</TableRow>;
            })}
          </Table>
          <Button clicked={this.onHomeClicked}>Home</Button>
        </Modal>
      </Aux>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    speechAvailable: state.settings.speechAvailable,
    synthAvailable: state.settings.synthAvailable,
  };
};

export default withRouter(connect(mapStateToProps)(SentenceWrite));
