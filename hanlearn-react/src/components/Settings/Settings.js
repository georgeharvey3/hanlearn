import React, { Component } from "react";
import { connect } from "react-redux";

import classes from "./Settings.module.css";

class Settings extends Component {
  constructor() {
    super();
    let localCharSet = localStorage.getItem("charSet");
    let localNumWords = localStorage.getItem("numWords");
    let useChineseSpeechRecognition = localStorage.getItem(
      "useChineseSpeechRecognition"
    );
    let useEnglishSpeechRecognition = localStorage.getItem(
      "useEnglishSpeechRecognition"
    );
    let useHandwriting = localStorage.getItem("useHandwriting");
    let useSound = localStorage.getItem("useSound");
    let useAutoRecord = localStorage.getItem("useAutoRecord");
    let useFlashcards = localStorage.getItem("useFlashcards");
    let newWords = localStorage.getItem("newWords");
    let sentenceRead = localStorage.getItem("sentenceRead");
    let sentenceWrite = localStorage.getItem("sentenceWrite");
    let priority = localStorage.getItem("priority");
    let onlyPriority = localStorage.getItem("onlyPriority");

    this.state = {
      charSet: localCharSet || "simp",
      numWords: localNumWords || 5,
      useChineseSpeechRecognition:
        useChineseSpeechRecognition === "false" ? false : true,
      useEnglishSpeechRecognition:
        useEnglishSpeechRecognition === "false" ? false : true,
      useHandwriting: useHandwriting === "false" ? false : true,
      useSound: useSound === "false" ? false : true,
      useAutoRecord: useAutoRecord === "false" ? false : true,
      useFlashcards: useFlashcards === "false" ? false : true,
      newWords: newWords === "false" ? false : true,
      sentenceRead: sentenceRead === "false" ? false : true,
      sentenceWrite: sentenceWrite === "false" ? false : true,
      priority: priority || "none",
      onlyPriority: onlyPriority === "true" ? true : false,
    };
    this.onRadioChange = this.onRadioChange.bind(this);
  }

  onRadioChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value,
    });
    localStorage.setItem(e.target.name, e.target.value);

    if (e.target.name === "priority" && e.target.value === "none") {
      this.setState({
        onlyPriority: false
      });
      localStorage.setItem("onlyPriority", "false");
    }
  };

  onSliderChange = (e) => {
    this.setState({
      numWords: e.target.value,
    });
    localStorage.setItem("numWords", e.target.value);
  };

  onCheckChange = (e) => {
    this.setState({
      [e.target.value]: !this.state[e.target.value],
    });
    localStorage.setItem(e.target.value, e.target.checked);

    if (e.target.value === "useEnglishSpeechRecognition" && e.target.checked) {
      this.setState({
        useFlashcards: false
      });
      localStorage.setItem("useFlashcards", false);
    }

    if (e.target.value === "useFlashcards" && e.target.checked) {
      this.setState({
        useEnglishSpeechRecognition: false
      });
      localStorage.setItem("useEnglishSpeechRecognition", false);
    }

    if (e.target.value === "useHandwriting" && !e.target.checked) {
      this.setState({
        priority: "none",
        onlyPriority: false
      });
      localStorage.setItem("priority", "none");
      localStorage.setItem("onlyPriority", "false");
    }
  };

  render() {
    return (
      <div className={classes.Settings}>
        <h3>Character Set</h3>
        <label>
          Simplified
          <input
            type="radio"
            name="charSet"
            checked={this.state.charSet === "simp"}
            value="simp"
            onChange={this.onRadioChange}
          />
        </label>
        <label>
          Traditional
          <input
            type="radio"
            name="charSet"
            checked={this.state.charSet === "trad"}
            value="trad"
            onChange={this.onRadioChange}
          />
        </label>
        <hr />
        <h3>Characters per test:</h3>
        <div className={classes.SliderBox}>
          <p>{this.state.numWords}</p>
          <input
            type="range"
            min="1"
            max="20"
            value={this.state.numWords}
            className={classes.Slider}
            id="slider"
            onChange={this.onSliderChange}
          />
        </div>
        <hr />
        <p>Test Settings</p>
        <div className={classes.CheckGrid}>
          <input
            type="checkbox"
            value="useSound"
            checked={this.state.useSound && this.props.synthAvailable}
            onChange={this.onCheckChange}
            disabled={!this.props.synthAvailable}
          />
          <label>Sound</label>
          <input
            type="checkbox"
            value="useChineseSpeechRecognition"
            checked={
              this.state.useChineseSpeechRecognition &&
              this.props.speechAvailable
            }
            onChange={this.onCheckChange}
            disabled={!this.props.speechAvailable}
          />
          <label>Chinese speech recognition</label>
          <input
            type="checkbox"
            value="useEnglishSpeechRecognition"
            checked={
              this.state.useEnglishSpeechRecognition &&
              this.props.speechAvailable
            }
            onChange={this.onCheckChange}
            disabled={!this.props.speechAvailable}
          />
          <label>English speech recognition</label>
          <input
            type="checkbox"
            value="useFlashcards"
            checked={this.state.useFlashcards}
            onChange={this.onCheckChange}
          />
          <label>Meaning flashcards</label>
          <input
            type="checkbox"
            value="useHandwriting"
            checked={this.state.useHandwriting}
            onChange={this.onCheckChange}
          />
          <label>Handwriting input</label>
        </div>
        <hr />
        <p>Priority</p>
        <div className={classes.CheckGrid2}>
          <label htmlFor="none">
            <input
              id="none"
              type="radio"
              name="priority"
              value="none"
              checked={this.state.priority === "none"}
              onChange={this.onRadioChange}
            />
            None
          </label>
          <label htmlFor="MP">
            <input
              id="MP"
              type="radio"
              name="priority"
              value="MP"
              checked={this.state.priority === "MP"}
              onChange={this.onRadioChange}
            />
            Listening
          </label>
          <label htmlFor="PM">
            <input
              id="PM"
              type="radio"
              name="priority"
              value="PM"
              checked={this.state.priority === "PM"}
              onChange={this.onRadioChange}
            />
            Speaking
          </label>
          <label htmlFor="MC">
            <input
              id="MC"
              type="radio"
              name="priority"
              value="MC"
              checked={this.state.priority === "MC"}
              onChange={this.onRadioChange}
            />
            Reading
          </label>
          <label htmlFor="MC">
            <input
              id="CM"
              type="radio"
              name="priority"
              value="CM"
              checked={this.state.priority === "CM"}
              onChange={this.onRadioChange}
              disabled={!this.state.useHandwriting}
            />
            Writing
          </label>
          <label>
            <input
              id="only-priority"
              type="checkbox"
              value="onlyPriority"
              checked={
                this.state.onlyPriority && this.state.priority !== "none"
              }
              disabled={this.state.priority === "none"}
              onChange={this.onCheckChange}
            />
            Only Priority
          </label>
        </div>
        <hr />
        <p>Stages</p>
        <div className={classes.CheckGrid}>
          <input
            type="checkbox"
            value="newWords"
            checked={this.state.newWords}
            onChange={this.onCheckChange}
            disabled={!this.props.synthAvailable}
          />
          <label>New Words</label>
          <input
            type="checkbox"
            value="sentenceRead"
            checked={this.state.sentenceRead}
            onChange={this.onCheckChange}
            disabled={!this.props.speechAvailable}
          />
          <label>Translate Sentences</label>
          <input
            type="checkbox"
            value="sentenceWrite"
            checked={this.state.sentenceWrite}
            onChange={this.onCheckChange}
          />
          <label>Make Sentences</label>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    speechAvailable: state.settings.speechAvailable,
    synthAvailable: state.settings.synthAvailable,
  };
};

export default connect(mapStateToProps)(Settings);
