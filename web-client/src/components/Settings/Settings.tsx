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
import { QuizCategory, QuizType, getQuizType, setQuizType } from '../../utils/audioSettings';

interface SettingsState {
  charSet: string;
  numWords: number;
  useHandwriting: boolean;
  useSound: boolean;
  useSoundEffects: boolean;
  useAutoRecord: boolean;
  meaningQuizType: QuizType;
  pinyinQuizType: QuizType;
  newWords: boolean;
  sentenceRead: boolean;
  sentenceWrite: boolean;
  sentenceStagesForAllWords: boolean;
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

interface CheckboxItem {
  value: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  disabledTooltip: string;
}

const CheckboxRows: React.FC<{
  items: CheckboxItem[];
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}> = ({ items, onChange }) => (
  <FormGroup>
    {items.map(({ value, label, checked, disabled, disabledTooltip }) => (
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
                  onChange={onChange}
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
);

const Settings: React.FC<PropsFromRedux> = ({ speechAvailable, synthAvailable }) => {
  const [state, setState] = useState<SettingsState>(() => {
    const localCharSet = localStorage.getItem('charSet');
    const localNumWords = localStorage.getItem('numWords');
    const useHandwriting = localStorage.getItem('useHandwriting');
    const useSound = localStorage.getItem('useSound');
    const useSoundEffects = localStorage.getItem('useSoundEffects');
    const useAutoRecord = localStorage.getItem('useAutoRecord');
    const newWords = localStorage.getItem('newWords');
    const sentenceRead = localStorage.getItem('sentenceRead');
    const sentenceWrite = localStorage.getItem('sentenceWrite');
    const sentenceStagesForAllWords = localStorage.getItem('sentenceStagesForAllWords');
    const priority = localStorage.getItem('priority');
    const onlyPriority = localStorage.getItem('onlyPriority');

    return {
      charSet: localCharSet || 'trad',
      numWords: localNumWords ? parseInt(localNumWords) : 5,
      useHandwriting: useHandwriting === 'false' ? false : true,
      useSound: useSound === 'false' ? false : true,
      useSoundEffects: useSoundEffects === 'false' ? false : true,
      useAutoRecord: useAutoRecord === 'false' ? false : true,
      meaningQuizType: getQuizType('meaning'),
      pinyinQuizType: getQuizType('pinyin'),
      newWords: newWords === 'false' ? false : true,
      sentenceRead: sentenceRead === 'false' ? false : true,
      sentenceWrite: sentenceWrite === 'false' ? false : true,
      sentenceStagesForAllWords: sentenceStagesForAllWords === 'true' ? true : false,
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

  const onQuizTypeChange = useCallback(
    (category: QuizCategory) =>
      (e: ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.value as QuizType;
        setState((prev) => ({
          ...prev,
          [category === 'meaning' ? 'meaningQuizType' : 'pinyinQuizType']: value,
        }));
        setQuizType(category, value);
      },
    [],
  );

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

      if (key === 'useHandwriting' && !checked) {
        nextState.priority = 'none';
        nextState.onlyPriority = false;
      }

      return nextState;
    });

    localStorage.setItem(e.target.value, String(checked));

    if (e.target.value === 'useHandwriting' && !checked) {
      localStorage.setItem('priority', 'none');
      localStorage.setItem('onlyPriority', 'false');
    }
  }, []);

  const inputQuizSelected = state.meaningQuizType === 'input' || state.pinyinQuizType === 'input';

  const quizCheckboxItems: CheckboxItem[] = [
    {
      value: 'useHandwriting',
      label: 'Handwriting questions',
      checked: state.useHandwriting,
      disabled: false,
      disabledTooltip: '',
    },
    {
      value: 'useAutoRecord',
      label: 'Auto-start microphone',
      checked: state.useAutoRecord && inputQuizSelected && speechAvailable,
      disabled: !inputQuizSelected || !speechAvailable,
      disabledTooltip: !speechAvailable
        ? 'Speech recognition is not available in this browser'
        : 'Only used when Meaning or Pinyin is set to Input',
    },
  ];

  const audioItems: CheckboxItem[] = [
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
  ];

  const priorityItems = [
    { value: 'none', label: 'None', disabled: false },
    { value: 'MP', label: 'Listening', disabled: false },
    { value: 'PM', label: 'Speaking', disabled: false },
    { value: 'MC', label: 'Reading', disabled: false },
    { value: 'CM', label: 'Writing', disabled: !state.useHandwriting },
  ];

  const stageItems: CheckboxItem[] = [
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
    {
      value: 'sentenceStagesForAllWords',
      label: 'Sentence stages for all words',
      checked: state.sentenceStagesForAllWords && (state.sentenceRead || state.sentenceWrite),
      disabled: !state.sentenceRead && !state.sentenceWrite,
      disabledTooltip: 'Enable at least one sentence stage first',
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
          sentenceStagesForAllWords: state.sentenceStagesForAllWords,
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
      state.sentenceStagesForAllWords,
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

      <SectionGroup label="Session">
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

      <SectionGroup label="Vocabulary Quiz">
        {(
          [
            { category: 'meaning' as QuizCategory, label: 'Meaning', value: state.meaningQuizType },
            { category: 'pinyin' as QuizCategory, label: 'Pinyin', value: state.pinyinQuizType },
          ] as const
        ).map(({ category, label, value }) => (
          <Box key={category} sx={{ ...rowSx, py: 0.5, display: 'flex', alignItems: 'center' }}>
            <Typography
              variant="body2"
              id={`quiz-type-${category}-label`}
              sx={{ width: 72, color: 'text.secondary' }}
            >
              {label}
            </Typography>
            <RadioGroup
              aria-labelledby={`quiz-type-${category}-label`}
              value={value}
              onChange={onQuizTypeChange(category)}
              row
            >
              <FormControlLabel value="input" control={<Radio size="small" />} label="Input" />
              <FormControlLabel
                value="flashcard"
                control={<Radio size="small" />}
                label="Flashcard"
              />
            </RadioGroup>
          </Box>
        ))}
        <CheckboxRows items={quizCheckboxItems} onChange={onCheckChange} />
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
        <CheckboxRows items={stageItems} onChange={onCheckChange} />
      </SectionGroup>

      <SectionGroup label="Audio">
        <CheckboxRows items={audioItems} onChange={onCheckChange} />
      </SectionGroup>
    </Box>
  );
};

export default connector(Settings);
