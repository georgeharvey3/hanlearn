import React, { Component } from "react";
import { connect } from "react-redux";
import { withRouter } from "react-router";
import { Howl } from "howler";

import Button from "../../UI/Buttons/Button/Button";
import Input from "../../UI/Input/Input";
import Aux from "../../../hoc/Aux";
import PictureButton from "../../UI/Buttons/PictureButton/PictureButton";
import Spinner from "../../UI/Spinner/Spinner";

import likePic from "../../../assets/images/like.png";
import dislikePic from "../../../assets/images/dislike.png";
import speakerPic from "../../../assets/images/speaker.png";
import micPic from "../../../assets/images/microphone.png";

import classes from "./SentenceRead.module.css";

import successSound from "../../../assets/sounds/success1.wav";
import failSound from "../../../assets/sounds/failure1.wav";

import * as wordActions from "../../../store/actions/index";

const beep = new Howl({
  src: [successSound],
  volume: 0.5,
});

const fail = new Howl({
  src: [failSound],
  volume: 0.7,
});

class SentenceRead extends Component {
  state = {
    sentences: [],
    charSet: localStorage.getItem("charSet") || "simp",
    sentenceIndex: 0,
    wordIndex: 0,
    submitted: false,
    entered: "",
    loading: false,
    useSound: true,
    useEnglishSpeechRecognition: false,
    showText: false,
    openPopup: "",
    message: "",
    recognition: null,
  };

  componentDidMount = () => {
    this.getSentences();
    this.initialiseSettings();
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("click", this.closePopup);
  };

  componentDidUpdate = (_, prevState) => {
    if (prevState.wordIndex !== this.state.wordIndex) {
      this.getSentences();
    } else if (prevState.sentenceIndex !== this.state.sentenceIndex) {
      if (this.state.useSound) {
        this.onSpeakPinyin(
          this.state.sentences[this.state.sentenceIndex].chinese.sentence
        );
      }
    }
  };

  componentWillUnmount = () => {
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("click", this.closePopup);
  };

  initialiseSettings = () => {
    const useSound =
      this.props.synthAvailable &&
      (!(localStorage.getItem("useSound") === "false") ||
        Boolean(this.props.isDemo));

    const useEnglishSpeechRecognition =
      this.props.synthAvailable &&
      (!(localStorage.getItem("useSound") === "false") ||
        Boolean(this.props.isDemo));

    this.setState({
      useSound: useSound,
      useEnglishSpeechRecognition: useEnglishSpeechRecognition,
    });
  };

  onSpeakPinyin = (sentence) => {
    if (this.state.recognition !== null) {
      this.state.recognition.abort();
    }
    window.speechSynthesis.cancel();

    let synth = window.speechSynthesis;
    let utterThis = new SpeechSynthesisUtterance(sentence);
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

  onListenPinyin = () => {
    if (this.state.recognition !== null) {
      this.state.recognition.abort();
    }
    window.speechSynthesis.cancel();

    let recognition = new window.webkitSpeechRecognition();

    this.setState({
      error: false,
      recognition: recognition,
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

    recognition.addEventListener("end", () => {
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

  getSentences = () => {
    this.setState({
      loading: true,
    });

    let word = this.props.words[this.state.wordIndex][this.state.charSet];
    fetch(`/api/get-sentences/${word}`)
      .then((response) =>
        response.json().then((data) => {
          const shortSentences = data.sentences.filter(sentence => sentence.chinese.sentence.length <= 18);

          if (shortSentences.length) {
            this.setState({
              sentences: shortSentences,
              loading: false,
            });
            if (this.state.useSound) {
              this.onSpeakPinyin(
                this.state.sentences[this.state.sentenceIndex].chinese.sentence
              );
            }
          } else {
            if (this.state.wordIndex >= this.props.words.length - 1) {
              this.onEndStage();
            } else {
              this.setState((prevState) => {
                return {
                  wordIndex: prevState.wordIndex + 1,
                };
              });
            }
          }
        })
      )
      .catch((error) => {
        console.log(error);
      });
  };

  onChangeSentence = (direction) => {
    this.setState((prevState) => {
      return {
        sentenceIndex: prevState.sentenceIndex + direction,
        showText: false
      };
    });
  };

  onNextWord = () => {
    this.setState((prevState) => {
      return {
        wordIndex: prevState.wordIndex + 1,
      };
    });
  };

  onSubmitInput = () => {
    this.setState({
      submitted: true,
    });
  };

  onEndStage = () => {
    if (this.props.sentenceWriteEnabled) {
      this.props.startSentenceWrite();
    } else {
      this.props.history.push("/");
    }
  }

  onYesClicked = () => {
    if (this.state.useSound) {
      beep.play();
    }

    if (this.state.wordIndex >= this.props.words.length - 1) {
      this.onEndStage();
    } else {
      this.setState((prevState) => {
        return {
          wordIndex: prevState.wordIndex + 1,
          sentenceIndex: 0,
          submitted: false,
          entered: "",
          showText: false
        };
      });
    }
  };

  onNoClicked = () => {
    if (this.state.useSound) {
      fail.play();
    }

    this.setState({
      entered: "",
      submitted: false,
    });
  };

  onInputChanged = (event) => {
    this.setState({
      entered: event.target.value,
    });
  };

  onKeyPressed = (event) => {
    if (event.key !== "Enter" || this.state.entered === "") {
      return;
    }

    this.onSubmitInput();
  };

  onKeyUp = (event) => {
    if (event.target.tagName.toLowerCase() === "input") {
      return;
    }

    if (event.ctrlKey && event.key === "b") {
      document.getElementById("answerInput").focus();
    }

    if (event.key === "ArrowUp" && this.state.submitted) {
      this.onYesClicked();
      return;
    }

    if (event.key === "ArrowDown" && this.state.submitted) {
      this.onNoClicked();
      return;
    }

    if (event.key === "ArrowLeft" && !this.state.submitted) {
      if (this.state.sentenceIndex > 0) {
        this.onChangeSentence(-1);
        return;
      }
    }

    if (event.key === "ArrowRight" && !this.state.submitted) {
      if (this.state.sentenceIndex < this.state.sentences.length - 1) {
        this.onChangeSentence(1);
        return;
      }
    }
  };

  onToggleText = () => {
    this.setState((prevState) => {
      return {
        showText: !prevState.showText,
      };
    });
  };

  onShowPopup = (id, word) => {
    let vocabs = document.getElementsByClassName(classes.popuptext);
    let popup = document.getElementById(id);

    //attach CSS class to display popup
    if (!popup.classList.contains(classes.show)) {
      for (let i = 0; i < vocabs.length; i++) {
        vocabs[i].classList.remove(classes.show);
      }

      if (this.state.useSound) {
        //speak word
        this.onSpeakPinyin(word);
      }
    }

    popup.classList.toggle(classes.show);
    this.setState({ openPopup: id });
  };

  closePopup = (event) => {
    if (
      this.state.openPopup !== "" &&
      !event.target.classList.contains(classes.popup) &&
      !(
        event.target.parentElement.classList.contains(classes.popuptext) ||
        event.target.classList.contains(classes.popuptext)
      )
    ) {
      Array.from(document.getElementsByClassName(classes.show)).forEach(
        (element) => {
          element.classList.remove(classes.show);
        }
      );
    }
  };

  render() {
    let sentenceWords = <Spinner />;

    if (this.state.sentences.length > 0) {
      if (this.state.loading) {
        sentenceWords = <Spinner />;
      } else {
        let sentenceText =
          this.state.sentences[this.state.sentenceIndex].chinese.sentence;
        let wordStart =
          this.state.sentences[this.state.sentenceIndex].chinese
            .highlight[0][0];
        let wordEnd =
          this.state.sentences[this.state.sentenceIndex].chinese
            .highlight[0][1];
        let chosenWord = sentenceText.slice(wordStart, wordEnd);

        sentenceWords = this.state.sentences[
          this.state.sentenceIndex
        ].chinese.words.map((word, index) => {
          if (typeof word === "string") {
            if (word === chosenWord) {
              return (
                <span key={index} className={classes.ChosenWord}>
                  {word}
                </span>
              );
            } else {
              return word;
            }
          } else {
            if (word[this.state.charSet] === chosenWord) {
              return (
                <span key={index} className={classes.ChosenWord}>
                  {word[this.state.charSet]}
                </span>
              );
            } else {
              return (
                <span
                  className={classes.popup}
                  onClick={(event) => {
                    if (event.target.classList.contains(classes.popup)) {
                      this.onShowPopup(
                        word.id + "popup",
                        word[this.state.charSet]
                      );
                    }
                  }}
                  key={index}
                >
                  {word[this.state.charSet]}
                  <span className={classes.popuptext} id={word.id + "popup"}>
                    <h5>Pinyin:</h5>
                    <p>{word.pinyin}</p>
                    <h5>Meaning:</h5>
                    <p>{word.meaning.split("/").join(" / ")}</p>
                    {this.props.addedWords.filter(
                      (addedWord) => addedWord.id === word.id
                    ).length > 0 ? (
                      <Button disabled>Added!</Button>
                    ) : (
                      <Button
                        clicked={() =>
                          this.props.onPostWord(this.props.token, word)
                        }
                      >
                        Add to bank
                      </Button>
                    )}
                  </span>
                </span>
              );
            }
          }
        });
        if (this.state.useSound && !this.state.showText) {
          sentenceWords = (
            <PictureButton
              colour="grey"
              src={speakerPic}
              clicked={() =>
                this.onSpeakPinyin(
                  this.state.sentences[this.state.sentenceIndex].chinese
                    .sentence
                )
              }
            />
          );
        }
      }
    }

    let showHide = null;

    if (this.state.useSound) {
      showHide = (
        <Button clicked={this.onToggleText}>
          {this.state.showText ? "Hide" : "Show"} Text
        </Button>
      );
    }

    let micButton = null;

    if (this.state.useEnglishSpeechRecognition) {
      micButton = (
        <Aux>
          <p>{this.state.message}</p>
          <PictureButton
            colour="yellow"
            src={micPic}
            clicked={() => this.onListenPinyin()}
          />
        </Aux>
      );
    }

    let content = (
      <Aux>
        <Input
          id="answerInput"
          changed={this.onInputChanged}
          keyPressed={this.onKeyPressed}
          autoComplete="off"
          value={this.state.entered}
          style={{ width: "100%", margin: "16px auto" }}
        />
        {micButton}
        <br />
        <Button
          clicked={() => this.onChangeSentence(-1)}
          disabled={this.state.sentenceIndex < 1}
        >
          Previous Sentence
        </Button>
        <Button
          clicked={() => this.onChangeSentence(1)}
          disabled={this.state.sentenceIndex > this.state.sentences.length - 2}
        >
          Next Sentence
        </Button>
        {showHide}
      </Aux>
    );

    let buttons = null;

    if (this.state.submitted) {
      let translation =
        this.state.sentences[this.state.sentenceIndex].english.sentence;

      if (
        this.state.sentences[this.state.sentenceIndex].english.highlight
          .length > 0
      ) {
        let translationText =
          this.state.sentences[this.state.sentenceIndex].english.sentence;
        let wordStart =
          this.state.sentences[this.state.sentenceIndex].english
            .highlight[0][0];
        let wordEnd =
          this.state.sentences[this.state.sentenceIndex].english
            .highlight[0][1];
        let beforeWord = translationText.slice(0, wordStart);
        let word = translationText.slice(wordStart, wordEnd);
        let afterWord = translationText.slice(
          wordEnd,
          this.state.sentences[this.state.sentenceIndex].english.sentence.length
        );
        translation = (
          <p>
            {beforeWord}
            <span>{word}</span>
            {afterWord}
          </p>
        );
      }

      content = (
        <Aux>
          <h2>Your Translation:</h2>

          <div
            className={classes.QuestionCard}
            style={{ fontSize: "1em", minHeight: "0" }}
          >
            <p>{this.state.entered}</p>
          </div>

          <h2>Correct Translation:</h2>

          <div
            className={classes.QuestionCard}
            style={{ fontSize: "1em", minHeight: "0" }}
          >
            {translation}
          </div>
        </Aux>
      );

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
    return (
      <div className={classes.SentenceRead}>
        <h2>Try to translate...</h2>
        <div className={classes.QuestionCard}>{sentenceWords}</div>
        {content}
        {buttons}
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    synthAvailable: state.settings.synthAvailable,
    voice: state.settings.voice,
    lang: state.settings.lang,
    token: state.auth.token,
    addedWords: state.addWords.words,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onPostWord: (token, word) => dispatch(wordActions.postWord(token, word)),
  };
};

export default withRouter(
  connect(mapStateToProps, mapDispatchToProps)(SentenceRead)
);
