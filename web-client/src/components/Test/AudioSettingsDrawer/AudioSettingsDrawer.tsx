import React, { useCallback, useMemo, useState } from 'react';
import { Box, ButtonBase, Drawer } from '@mui/material';
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
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';

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
    (key: AudioSettingKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const updated = setAudioSetting(key, e.target.checked);
      setSettings(updated);
    },
    [],
  );

  const handleClose = useCallback(() => {
    onClose(settings);
  }, [onClose, settings]);

  const handleQuizTypeChange = useCallback((category: QuizCategory, value: QuizType) => {
    setQuizType(category, value);
    setSettings(getAudioSettings());
  }, []);

  const items = useMemo(
    () => getAudioSettingItems(speechAvailable, synthAvailable),
    [speechAvailable, synthAvailable],
  );

  const quizTypeRow = (label: string, category: QuizCategory, value: QuizType) => (
    <Box
      sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Box component="span" id={`quiz-type-${category}-label`} sx={{ fontSize: 16 }}>
        {label}
      </Box>
      <Box
        role="radiogroup"
        aria-labelledby={`quiz-type-${category}-label`}
        sx={{
          display: 'flex',
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {(['input', 'flashcard'] as QuizType[]).map((type) => {
          const checked = value === type;
          return (
            <ButtonBase
              key={type}
              role="radio"
              aria-checked={checked}
              onClick={() => handleQuizTypeChange(category, type)}
              sx={{
                height: 40,
                px: 2,
                fontFamily: fonts.body,
                fontSize: 14,
                fontWeight: 600,
                bgcolor: checked ? colors.primaryDark : colors.card,
                color: checked ? colors.white : colors.text,
              }}
            >
              {type === 'input' ? copy.settings.input : copy.settings.flashcard}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      PaperProps={{
        role: 'dialog',
        'aria-label': copy.study.settings,
        sx: {
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          px: 2.5,
          pt: 1.5,
          pb: 3.5,
          maxWidth: 440,
          mx: 'auto',
          fontFamily: fonts.body,
          color: colors.text,
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          bgcolor: colors.borderStrong,
          mb: 1.75,
        }}
      />
      <Box sx={{ fontSize: 18, fontWeight: 600, mb: 0.75 }}>{copy.study.settings}</Box>
      {quizTypeRow(copy.settings.meaning, 'meaning', settings.meaningQuizType)}
      {quizTypeRow(copy.settings.pinyin, 'pinyin', settings.pinyinQuizType)}
      {items.map(({ key, disabled }) => {
        const checked = disabled ? false : settings[key];
        const label = copy.settings[key];
        return (
          <Box
            component="label"
            key={key}
            sx={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 16,
              borderTop: `1px solid ${colors.divider}`,
              color: disabled ? colors.textSecondary : colors.text,
              cursor: disabled ? 'default' : 'pointer',
              // The switch is drawn; the checkbox under it keeps it a control.
              '&:has(input:focus-visible) .switch': {
                outline: `2px solid ${colors.primaryDark}`,
                outlineOffset: '2px',
              },
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={handleChange(key)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
            {disabled ? copy.settings.unsupported(label) : label}
            <Box
              aria-hidden="true"
              className="switch"
              sx={{
                position: 'relative',
                flex: 'none',
                width: 36,
                height: 20,
                borderRadius: '10px',
                bgcolor: checked ? colors.primaryDark : colors.borderStrong,
                transition: 'background-color 150ms ease',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: checked ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '8px',
                  bgcolor: colors.white,
                  transition: 'left 150ms ease',
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Drawer>
  );
};

export default React.memo(AudioSettingsDrawer);
