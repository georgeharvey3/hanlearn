import React, { ChangeEvent, useCallback, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';

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

  const onSliderChange = useCallback((_e: Event, value: number | number[]): void => {
    const numValue = value as number;
    setState((prev) => ({
      ...prev,
      numWords: numValue,
    }));
    localStorage.setItem('numWords', String(numValue));
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
    <Box sx={{ width: 300, display: 'inline-block', p: 1.5, color: 'text.primary' }}>
      <Typography variant="subtitle1" fontWeight="bold">Character Set</Typography>
      <RadioGroup name="charSet" value={state.charSet} onChange={onRadioChange} row>
        <FormControlLabel value="simp" control={<Radio size="small" />} label="Simplified" />
        <FormControlLabel value="trad" control={<Radio size="small" />} label="Traditional" />
      </RadioGroup>
      <Divider sx={{ my: 1 }} />

      <Typography variant="subtitle1" fontWeight="bold">Characters per test:</Typography>
      <Box sx={{ width: '60%', mx: 'auto', textAlign: 'center' }}>
        <Typography>{state.numWords}</Typography>
        <Slider
          value={state.numWords}
          onChange={onSliderChange}
          min={1}
          max={20}
          size="small"
          color="primary"
          aria-label="Characters per test"
        />
      </Box>
      <Divider sx={{ my: 1 }} />

      <Typography variant="body2">Test Settings</Typography>
      <FormGroup>
        <FormControlLabel
          control={<Checkbox size="small" value="useSound" checked={state.useSound && synthAvailable} onChange={onCheckChange} disabled={!synthAvailable} />}
          label="Sound"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="useChineseSpeechRecognition" checked={state.useChineseSpeechRecognition && speechAvailable} onChange={onCheckChange} disabled={!speechAvailable} />}
          label="Chinese speech recognition"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="useEnglishSpeechRecognition" checked={state.useEnglishSpeechRecognition && speechAvailable} onChange={onCheckChange} disabled={!speechAvailable} />}
          label="English speech recognition"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="useAutoRecord" checked={state.useAutoRecord} onChange={onCheckChange} />}
          label="Automatic recording"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="useFlashcards" checked={state.useFlashcards} onChange={onCheckChange} />}
          label="Meaning flashcards"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="useHandwriting" checked={state.useHandwriting} onChange={onCheckChange} />}
          label="Handwriting input"
        />
      </FormGroup>
      <Divider sx={{ my: 1 }} />

      <Typography variant="body2">Priority</Typography>
      <RadioGroup name="priority" value={state.priority} onChange={onRadioChange}>
        <FormControlLabel value="none" control={<Radio size="small" />} label="None" />
        <FormControlLabel value="MP" control={<Radio size="small" />} label="Listening" />
        <FormControlLabel value="PM" control={<Radio size="small" />} label="Speaking" />
        <FormControlLabel value="MC" control={<Radio size="small" />} label="Reading" />
        <FormControlLabel value="CM" control={<Radio size="small" disabled={!state.useHandwriting} />} label="Writing" />
      </RadioGroup>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            value="onlyPriority"
            checked={state.onlyPriority && state.priority !== 'none'}
            disabled={state.priority === 'none'}
            onChange={onCheckChange}
          />
        }
        label="Only Priority"
      />
      <Divider sx={{ my: 1 }} />

      <Typography variant="body2">Stages</Typography>
      <FormGroup>
        <FormControlLabel
          control={<Checkbox size="small" value="newWords" checked={state.newWords} onChange={onCheckChange} disabled={!synthAvailable} />}
          label="New Words"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="sentenceRead" checked={state.sentenceRead} onChange={onCheckChange} disabled={!speechAvailable} />}
          label="Translate Sentences"
        />
        <FormControlLabel
          control={<Checkbox size="small" value="sentenceWrite" checked={state.sentenceWrite} onChange={onCheckChange} />}
          label="Make Sentences"
        />
      </FormGroup>
    </Box>
  );
};

export default connector(Settings);
