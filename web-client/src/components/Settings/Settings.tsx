import React, { Component, ChangeEvent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import classes from './Settings.module.css';
import { RootState } from '../../types/store';

interface SettingsState {
  charSet: string;
  numWords: number;
  useChineseSpeechRecognition: boolean;
  useEnglishSpeechRecognition: boolean;
  useHandwriting: boolean;
  useSound: boolean;
  useAutoRecord: boolean;
  useFlashcards: boolean;
  newWords: boolean;
  sentenceRead: boolean;
  sentenceWrite: boolean;
  priority: string;
  onlyPriority: boolean;
  [key: string]: string | number | boolean;
}

const mapStateToProps = (state: RootState) => {
  return {
    speechAvailable: state.settings.speechAvailable,
    synthAvailable: state.settings.synthAvailable,
  };
};

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

class Settings extends Component<PropsFromRedux, SettingsState> {
  constructor(props: PropsFromRedux) {
    super(props);
    const localCharSet = localStorage.getItem('charSet');
    const localNumWords = localStorage.getItem('numWords');
    const useChineseSpeechRecognition = localStorage.getItem(
      'useChineseSpeechRecognition'
    );
    const useEnglishSpeechRecognition = localStorage.getItem(
      'useEnglishSpeechRecognition'
    );
    const useHandwriting = localStorage.getItem('useHandwriting');
    const useSound = localStorage.getItem('useSound');
    const useAutoRecord = localStorage.getItem('useAutoRecord');
    const useFlashcards = localStorage.getItem('useFlashcards');
    const newWords = localStorage.getItem('newWords');
    const sentenceRead = localStorage.getItem('sentenceRead');
    const sentenceWrite = localStorage.getItem('sentenceWrite');
    const priority = localStorage.getItem('priority');
    const onlyPriority = localStorage.getItem('onlyPriority');

    this.state = {
      charSet: localCharSet || 'simp',
      numWords: localNumWords ? parseInt(localNumWords) : 5,
      useChineseSpeechRecognition:
        useChineseSpeechRecognition === 'false' ? false : true,
      useEnglishSpeechRecognition:
        useEnglishSpeechRecognition === 'false' ? false : true,
      useHandwriting: useHandwriting === 'false' ? false : true,
      useSound: useSound === 'false' ? false : true,
      useAutoRecord: useAutoRecord === 'false' ? false : true,
      useFlashcards: useFlashcards === 'false' ? false : true,
      newWords: newWords === 'false' ? false : true,
      sentenceRead: sentenceRead === 'false' ? false : true,
      sentenceWrite: sentenceWrite === 'false' ? false : true,
      priority: priority || 'none',
      onlyPriority: onlyPriority === 'true' ? true : false,
    };
    this.onRadioChange = this.onRadioChange.bind(this);
  }

  onRadioChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      [e.target.name]: e.target.value,
    } as Pick<SettingsState, keyof SettingsState>);
    localStorage.setItem(e.target.name, e.target.value);

    if (e.target.name === 'priority' && e.target.value === 'none') {
      this.setState({
        onlyPriority: false,
      });
      localStorage.setItem('onlyPriority', 'false');
    }
  };

  onSliderChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      numWords: parseInt(e.target.value),
    });
    localStorage.setItem('numWords', e.target.value);
  };

  onCheckChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const key = e.target.value as keyof SettingsState;
    this.setState({
      [key]: !this.state[key],
    } as Pick<SettingsState, keyof SettingsState>);
    localStorage.setItem(e.target.value, String(e.target.checked));

    if (e.target.value === 'useEnglishSpeechRecognition' && e.target.checked) {
      this.setState({
        useFlashcards: false,
      });
      localStorage.setItem('useFlashcards', 'false');
    }

    if (e.target.value === 'useFlashcards' && e.target.checked) {
      this.setState({
        useEnglishSpeechRecognition: false,
      });
      localStorage.setItem('useEnglishSpeechRecognition', 'false');
    }

    if (e.target.value === 'useHandwriting' && !e.target.checked) {
      this.setState({
        priority: 'none',
        onlyPriority: false,
      });
      localStorage.setItem('priority', 'none');
      localStorage.setItem('onlyPriority', 'false');
    }
  };

  render(): React.ReactNode {
    return (
      <div className={classes.Settings}>
        <h3>Character Set</h3>
        <label>
          Simplified
          <input
            type="radio"
            name="charSet"
            checked={this.state.charSet === 'simp'}
            value="simp"
            onChange={this.onRadioChange}
          />
        </label>
        <label>
          Traditional
          <input
            type="radio"
            name="charSet"
            checked={this.state.charSet === 'trad'}
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
              checked={this.state.priority === 'none'}
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
              checked={this.state.priority === 'MP'}
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
              checked={this.state.priority === 'PM'}
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
              checked={this.state.priority === 'MC'}
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
              checked={this.state.priority === 'CM'}
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
                this.state.onlyPriority && this.state.priority !== 'none'
              }
              disabled={this.state.priority === 'none'}
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

export default connector(Settings);
