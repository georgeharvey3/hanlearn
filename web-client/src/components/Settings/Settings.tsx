import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormGroup from '@mui/material/FormGroup';
import Tooltip from '@mui/material/Tooltip';

import { RootState } from '../../types/store';
import { colors } from '../../theme';
import { estimateTestTime, formatTestTime } from '../../utils/estimateTestTime';

interface SettingsState {
  charSet: string;
  numWords: number;
  useChineseSpeechRecognition: boolean;
  useEnglishSpeechRecognition: boolean;
  useHandwriting: boolean;
  useSound: boolean;
  useSoundEffects: boolean;
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

const sectionGroupSx = {
  bgcolor: '#fff',
  borderRadius: '12px',
  border: '1px solid #e5ddd6',
  overflow: 'hidden',
  mb: 3,
};

const sectionLabelSx = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: colors.primaryDark,
  mb: 0.75,
  pl: 0.5,
};

const rowSx = {
  px: 2,
  borderBottom: '1px solid #ede6e0',
  '&:last-child': { borderBottom: 'none' },
};

const SectionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={sectionLabelSx}>{label}</Typography>
    <Box sx={sectionGroupSx}>{children}</Box>
  </Box>
);

const Settings: React.FC<PropsFromRedux> = ({ speechAvailable, synthAvailable }) => {
  const [state, setState] = useState<SettingsState>(() => {
    const localCharSet = localStorage.getItem('charSet');
    const localNumWords = localStorage.getItem('numWords');
    const useChineseSpeechRecognition = localStorage.getItem('useChineseSpeechRecognition');
    const useEnglishSpeechRecognition = localStorage.getItem('useEnglishSpeechRecognition');
    const useHandwriting = localStorage.getItem('useHandwriting');
    const useSound = localStorage.getItem('useSound');
    const useSoundEffects = localStorage.getItem('useSoundEffects');
    const useAutoRecord = localStorage.getItem('useAutoRecord');
    const useFlashcards = localStorage.getItem('useFlashcards');
    const newWords = localStorage.getItem('newWords');
    const sentenceRead = localStorage.getItem('sentenceRead');
    const sentenceWrite = localStorage.getItem('sentenceWrite');
    const priority = localStorage.getItem('priority');
    const onlyPriority = localStorage.getItem('onlyPriority');

    return {
      charSet: localCharSet || 'trad',
      numWords: localNumWords ? parseInt(localNumWords) : 5,
      useChineseSpeechRecognition: useChineseSpeechRecognition === 'false' ? false : true,
      useEnglishSpeechRecognition: useEnglishSpeechRecognition === 'false' ? false : true,
      useHandwriting: useHandwriting === 'false' ? false : true,
      useSound: useSound === 'false' ? false : true,
      useSoundEffects: useSoundEffects === 'false' ? false : true,
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
        [key]: !prev[key],
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

  const checkboxItems = [
    {
      value: 'useSound',
      label: 'Text-to-speech',
      checked: state.useSound && synthAvailable,
      disabled: !synthAvailable,
      disabledTooltip: 'Speech synthesis is not available in this browser',
    },
    {
      value: 'useSoundEffects',
      label: 'Sound effects',
      checked: state.useSoundEffects,
      disabled: false,
      disabledTooltip: '',
    },
    {
      value: 'useChineseSpeechRecognition',
      label: 'Chinese speech recognition',
      checked: state.useChineseSpeechRecognition && speechAvailable,
      disabled: !speechAvailable,
      disabledTooltip: 'Speech recognition is not available in this browser',
    },
    {
      value: 'useEnglishSpeechRecognition',
      label: 'English speech recognition',
      checked: state.useEnglishSpeechRecognition && speechAvailable,
      disabled: !speechAvailable,
      disabledTooltip: 'Speech recognition is not available in this browser',
    },
    {
      value: 'useAutoRecord',
      label: 'Automatic recording',
      checked: state.useAutoRecord,
      disabled: false,
      disabledTooltip: '',
    },
    {
      value: 'useFlashcards',
      label: 'Meaning flashcards',
      checked: state.useFlashcards,
      disabled: false,
      disabledTooltip: '',
    },
    {
      value: 'useHandwriting',
      label: 'Handwriting input',
      checked: state.useHandwriting,
      disabled: false,
      disabledTooltip: '',
    },
  ];

  const priorityItems = [
    { value: 'none', label: 'None', disabled: false },
    { value: 'MP', label: 'Listening', disabled: false },
    { value: 'PM', label: 'Speaking', disabled: false },
    { value: 'MC', label: 'Reading', disabled: false },
    { value: 'CM', label: 'Writing', disabled: !state.useHandwriting },
  ];

  const stageItems = [
    {
      value: 'newWords',
      label: 'New Words',
      checked: state.newWords,
      disabled: !synthAvailable,
      disabledTooltip: 'Requires speech synthesis support in this browser',
    },
    {
      value: 'sentenceRead',
      label: 'Translate Sentences',
      checked: state.sentenceRead,
      disabled: !speechAvailable,
      disabledTooltip: 'Requires speech recognition support in this browser',
    },
    {
      value: 'sentenceWrite',
      label: 'Make Sentences',
      checked: state.sentenceWrite,
      disabled: false,
      disabledTooltip: '',
    },
  ];

  const timeEstimate = useMemo(
    () =>
      formatTestTime(
        estimateTestTime({
          numWords: state.numWords,
          useHandwriting: state.useHandwriting,
          priority: state.priority,
          onlyPriority: state.onlyPriority,
          newWordsEnabled: state.newWords,
          sentenceReadEnabled: state.sentenceRead,
          sentenceWriteEnabled: state.sentenceWrite,
        }),
      ),
    [
      state.numWords,
      state.useHandwriting,
      state.priority,
      state.onlyPriority,
      state.newWords,
      state.sentenceRead,
      state.sentenceWrite,
    ],
  );

  return (
    <Box sx={{ color: 'text.primary' }}>
      <SectionGroup label="Character Set">
        <Box sx={{ px: 2, py: 0.5 }}>
          <RadioGroup
            name="charSet"
            value={state.charSet}
            onChange={onRadioChange}
            row
            sx={{ gap: 1 }}
          >
            <FormControlLabel value="simp" control={<Radio size="small" />} label="Simplified" />
            <FormControlLabel value="trad" control={<Radio size="small" />} label="Traditional" />
          </RadioGroup>
        </Box>
      </SectionGroup>

      <SectionGroup label="Characters per Test">
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              mb: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Words per session
            </Typography>
            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{ color: colors.primaryDark, lineHeight: 1 }}
            >
              {state.numWords}
            </Typography>
          </Box>
          <Slider
            value={state.numWords}
            onChange={onSliderChange}
            min={1}
            max={20}
            size="small"
            aria-label="Characters per test"
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              1
            </Typography>
            <Typography variant="caption" color="text.secondary">
              20
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}
          >
            Estimated test time: {timeEstimate}
          </Typography>
        </Box>
      </SectionGroup>

      <SectionGroup label="Test Settings">
        <FormGroup>
          {checkboxItems.map(({ value, label, checked, disabled, disabledTooltip }) => (
            <Box key={value} sx={rowSx}>
              <Tooltip
                title={disabled ? disabledTooltip : ''}
                placement="right"
                disableHoverListener={!disabled}
                disableFocusListener={!disabled}
              >
                <span>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        value={value}
                        checked={checked}
                        onChange={onCheckChange}
                        disabled={disabled}
                      />
                    }
                    label={label}
                    sx={{ width: '100%', my: 0.25 }}
                  />
                </span>
              </Tooltip>
            </Box>
          ))}
        </FormGroup>
      </SectionGroup>

      <SectionGroup label="Priority">
        <RadioGroup name="priority" value={state.priority} onChange={onRadioChange}>
          {priorityItems.map(({ value, label, disabled }) => (
            <Box key={value} sx={rowSx}>
              <FormControlLabel
                value={value}
                control={<Radio size="small" disabled={disabled} />}
                label={label}
                sx={{ width: '100%', my: 0.25 }}
              />
            </Box>
          ))}
        </RadioGroup>
        <Box
          sx={{
            px: 2,
            pt: 0.5,
            pb: 0.25,
            borderTop: '1px solid #ede6e0',
            bgcolor: '#faf7f4',
          }}
        >
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
            sx={{ my: 0.25 }}
          />
        </Box>
      </SectionGroup>

      <SectionGroup label="Stages">
        <FormGroup>
          {stageItems.map(({ value, label, checked, disabled, disabledTooltip }) => (
            <Box key={value} sx={rowSx}>
              <Tooltip
                title={disabled ? disabledTooltip : ''}
                placement="right"
                disableHoverListener={!disabled}
                disableFocusListener={!disabled}
              >
                <span>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        value={value}
                        checked={checked}
                        onChange={onCheckChange}
                        disabled={disabled}
                      />
                    }
                    label={label}
                    sx={{ width: '100%', my: 0.25 }}
                  />
                </span>
              </Tooltip>
            </Box>
          ))}
        </FormGroup>
      </SectionGroup>
    </Box>
  );
};

export default connector(Settings);
