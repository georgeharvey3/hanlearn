import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Drawer,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AudioSettings,
  AudioSettingKey,
  QuizCategory,
  QuizType,
  getAudioSettings,
  getAudioSettingItems,
  setAudioSetting,
  setQuizType,
} from '../../../utils/audioSettings';

interface AudioSettingsDrawerProps {
  open: boolean;
  onClose: (settings: AudioSettings) => void;
  speechAvailable: boolean;
  synthAvailable: boolean;
}

const AudioSettingsDrawer: React.FC<AudioSettingsDrawerProps> = ({
  open,
  onClose,
  speechAvailable,
  synthAvailable,
}) => {
  const [settings, setSettings] = useState<AudioSettings>(getAudioSettings);

  const handleChange = useCallback(
    (key: AudioSettingKey) => (_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      const updated = setAudioSetting(key, checked);
      setSettings(updated);
    },
    [],
  );

  const handleClose = useCallback(() => {
    onClose(settings);
  }, [onClose, settings]);

  const handleQuizTypeChange = useCallback(
    (category: QuizCategory) => (_e: React.ChangeEvent<HTMLInputElement>, value: string) => {
      setQuizType(category, value as QuizType);
      setSettings(getAudioSettings());
    },
    [],
  );

  const items = useMemo(
    () => getAudioSettingItems(speechAvailable, synthAvailable),
    [speechAvailable, synthAvailable],
  );

  const quizTypeRow = (label: string, category: QuizCategory, value: QuizType) => (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
      <Typography variant="body2" id={`quiz-type-${category}-label`} sx={{ width: 72 }}>
        {label}
      </Typography>
      <RadioGroup
        row
        aria-labelledby={`quiz-type-${category}-label`}
        value={value}
        onChange={handleQuizTypeChange(category)}
      >
        <FormControlLabel value="text" control={<Radio size="small" />} label="Text" />
        <Tooltip
          title={speechAvailable ? '' : 'Speech recognition is not available in this browser'}
        >
          <span>
            <FormControlLabel
              value="speech"
              control={<Radio size="small" />}
              label="Speech"
              disabled={!speechAvailable}
            />
          </span>
        </Tooltip>
        <FormControlLabel value="flashcard" control={<Radio size="small" />} label="Flashcard" />
      </RadioGroup>
    </Box>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          px: 3,
          py: 2,
          maxWidth: 400,
          mx: 'auto',
        },
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Test Settings
      </Typography>
      <Box sx={{ mb: 1 }}>
        {quizTypeRow('Meaning', 'meaning', settings.meaningQuizType)}
        {quizTypeRow('Pinyin', 'pinyin', settings.pinyinQuizType)}
      </Box>
      <FormGroup>
        {items.map(({ key, label, disabled }) => (
          <FormControlLabel
            key={key}
            control={
              <Checkbox
                size="small"
                checked={disabled ? false : settings[key]}
                onChange={handleChange(key)}
                disabled={disabled}
              />
            }
            label={disabled ? `${label} (not supported by your browser)` : label}
            sx={{ my: 0.25 }}
          />
        ))}
      </FormGroup>
    </Drawer>
  );
};

export default React.memo(AudioSettingsDrawer);
