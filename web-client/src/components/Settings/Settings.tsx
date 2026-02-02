import React, { ChangeEvent, useCallback, useState } from 'react';
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

const Settings: React.FC<PropsFromRedux> = ({
  speechAvailable,
  synthAvailable,
}) => {
  const [state, setState] = useState<SettingsState>(() => {
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

    return {
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
  });

  const onRadioChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setState((prev) => {
      const nextState: SettingsState = {
        ...prev,
        [name]: value,
      } as SettingsState;

      if (name === 'priority' && value === 'none') {
        nextState.onlyPriority = false;
      }

      return nextState;
    });
    localStorage.setItem(name, value);

    if (name === 'priority' && value === 'none') {
      localStorage.setItem('onlyPriority', 'false');
    }
  }, []);

  const onSliderChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    setState((prev) => ({
      ...prev,
      numWords: parseInt(e.target.value),
    }));
    localStorage.setItem('numWords', e.target.value);
  }, []);

  const onCheckChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    const key = e.target.value as keyof SettingsState;
    const checked = e.target.checked;

    setState((prev) => {
      const nextState: SettingsState = {
        ...prev,
        [key]: !Boolean(prev[key]),
      } as SettingsState;

      if (key === 'useEnglishSpeechRecognition' && checked) {
        nextState.useFlashcards = false;
      }

      if (key === 'useFlashcards' && checked) {
        nextState.useEnglishSpeechRecognition = false;
      }

      if (key === 'useHandwriting' && !checked) {
        nextState.priority = 'none';
        nextState.onlyPriority = false;
      }

      return nextState;
    });

    localStorage.setItem(e.target.value, String(checked));

    if (e.target.value === 'useEnglishSpeechRecognition' && checked) {
      localStorage.setItem('useFlashcards', 'false');
    }

    if (e.target.value === 'useFlashcards' && checked) {
      localStorage.setItem('useEnglishSpeechRecognition', 'false');
    }

    if (e.target.value === 'useHandwriting' && !checked) {
      localStorage.setItem('priority', 'none');
      localStorage.setItem('onlyPriority', 'false');
    }
  }, []);

  return (
    <div className={classes.Settings}>
      <h3>Character Set</h3>
      <label>
        Simplified
        <input
          type="radio"
          name="charSet"
          checked={state.charSet === 'simp'}
          value="simp"
          onChange={onRadioChange}
        />
      </label>
      <label>
        Traditional
        <input
          type="radio"
          name="charSet"
          checked={state.charSet === 'trad'}
          value="trad"
          onChange={onRadioChange}
        />
      </label>
      <hr />
      <h3>Characters per test:</h3>
      <div className={classes.SliderBox}>
        <p>{state.numWords}</p>
        <input
          type="range"
          min="1"
          max="20"
          value={state.numWords}
          className={classes.Slider}
          id="slider"
          onChange={onSliderChange}
        />
      </div>
      <hr />
      <p>Test Settings</p>
      <div className={classes.CheckGrid}>
        <input
          type="checkbox"
          value="useSound"
          checked={state.useSound && synthAvailable}
          onChange={onCheckChange}
          disabled={!synthAvailable}
        />
        <label>Sound</label>
        <input
          type="checkbox"
          value="useChineseSpeechRecognition"
          checked={state.useChineseSpeechRecognition && speechAvailable}
          onChange={onCheckChange}
          disabled={!speechAvailable}
        />
        <label>Chinese speech recognition</label>
        <input
          type="checkbox"
          value="useEnglishSpeechRecognition"
          checked={state.useEnglishSpeechRecognition && speechAvailable}
          onChange={onCheckChange}
          disabled={!speechAvailable}
        />
        <label>English speech recognition</label>
        <input
          type="checkbox"
          value="useAutoRecord"
          checked={state.useAutoRecord}
          onChange={onCheckChange}
        />
        <label>Automatic recording</label>
        <input
          type="checkbox"
          value="useFlashcards"
          checked={state.useFlashcards}
          onChange={onCheckChange}
        />
        <label>Meaning flashcards</label>
        <input
          type="checkbox"
          value="useHandwriting"
          checked={state.useHandwriting}
          onChange={onCheckChange}
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
            checked={state.priority === 'none'}
            onChange={onRadioChange}
          />
          None
        </label>
        <label htmlFor="MP">
          <input
            id="MP"
            type="radio"
            name="priority"
            value="MP"
            checked={state.priority === 'MP'}
            onChange={onRadioChange}
          />
          Listening
        </label>
        <label htmlFor="PM">
          <input
            id="PM"
            type="radio"
            name="priority"
            value="PM"
            checked={state.priority === 'PM'}
            onChange={onRadioChange}
          />
          Speaking
        </label>
        <label htmlFor="MC">
          <input
            id="MC"
            type="radio"
            name="priority"
            value="MC"
            checked={state.priority === 'MC'}
            onChange={onRadioChange}
          />
          Reading
        </label>
        <label htmlFor="MC">
          <input
            id="CM"
            type="radio"
            name="priority"
            value="CM"
            checked={state.priority === 'CM'}
            onChange={onRadioChange}
            disabled={!state.useHandwriting}
          />
          Writing
        </label>
        <label>
          <input
            id="only-priority"
            type="checkbox"
            value="onlyPriority"
            checked={state.onlyPriority && state.priority !== 'none'}
            disabled={state.priority === 'none'}
            onChange={onCheckChange}
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
          checked={state.newWords}
          onChange={onCheckChange}
          disabled={!synthAvailable}
        />
        <label>New Words</label>
        <input
          type="checkbox"
          value="sentenceRead"
          checked={state.sentenceRead}
          onChange={onCheckChange}
          disabled={!speechAvailable}
        />
        <label>Translate Sentences</label>
        <input
          type="checkbox"
          value="sentenceWrite"
          checked={state.sentenceWrite}
          onChange={onCheckChange}
        />
        <label>Make Sentences</label>
      </div>
    </div>
  );
};

export default connector(Settings);
