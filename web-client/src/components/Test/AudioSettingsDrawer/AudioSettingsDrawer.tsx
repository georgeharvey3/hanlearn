import React, { useCallback, useState } from 'react';
import { Box, Drawer } from '@mui/material';
import {
  AudioSettings,
  AudioSettingKey,
  QuizCategory,
  QuizType,
  getAudioSettings,
  setAudioSetting,
  setQuizType,
} from '../../../utils/audioSettings';
import { PlainGroup, SegmentedRow, SwitchRow } from '../../Settings/controls';
import { autoRecordBlock, ttsBlock } from '../../Settings/rules';
import { copy } from '../../../copy';
import { colors, fonts, scrim } from '../../../theme';

interface AudioSettingsDrawerProps {
  open: boolean;
  onClose: (settings: AudioSettings) => void;
  speechAvailable: boolean;
  synthAvailable: boolean;
}

const quizOptions: { value: QuizType; label: string }[] = [
  { value: 'input', label: copy.settings.input },
  { value: 'flashcard', label: copy.settings.flashcard },
];

/** The session's settings sheet: the Answers and Sound rows of the Settings page. */
const AudioSettingsDrawer: React.FC<AudioSettingsDrawerProps> = ({
  open,
  onClose,
  speechAvailable,
  synthAvailable,
}) => {
  const [settings, setSettings] = useState<AudioSettings>(getAudioSettings);

  const handleChange = useCallback(
    (key: AudioSettingKey) => (checked: boolean) => setSettings(setAudioSetting(key, checked)),
    [],
  );

  const handleClose = useCallback(() => {
    onClose(settings);
  }, [onClose, settings]);

  const handleQuizTypeChange = useCallback(
    (category: QuizCategory) => (value: QuizType) => {
      setQuizType(category, value);
      setSettings(getAudioSettings());
    },
    [],
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      slotProps={{ backdrop: { sx: { bgcolor: scrim } } }}
      PaperProps={{
        role: 'dialog',
        'aria-label': copy.study.settings,
        sx: {
          borderRadius: '4px 4px 0 0',
          bgcolor: colors.paper,
          boxShadow: '0 -12px 32px -16px rgba(70,50,30,0.45)',
          px: 2,
          pt: 1.5,
          pb: 'calc(28px + env(safe-area-inset-bottom))',
          maxWidth: 440,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
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
          borderRadius: '2px',
          bgcolor: colors.borderStrong,
        }}
      />
      <Box component="h2" sx={{ m: 0, fontSize: 18, fontWeight: 600 }}>
        {copy.study.settings}
      </Box>
      <PlainGroup title={copy.settings.answers}>
        <SegmentedRow
          label={copy.settings.meaning}
          value={settings.meaningQuizType}
          options={quizOptions}
          onChange={handleQuizTypeChange('meaning')}
        />
        <SegmentedRow
          label={copy.settings.pinyin}
          value={settings.pinyinQuizType}
          options={quizOptions}
          onChange={handleQuizTypeChange('pinyin')}
        />
        <SwitchRow
          label={copy.settings.useAutoRecord}
          checked={settings.useAutoRecord}
          block={autoRecordBlock(
            speechAvailable,
            settings.meaningQuizType,
            settings.pinyinQuizType,
          )}
          onChange={handleChange('useAutoRecord')}
        />
      </PlainGroup>
      <PlainGroup title={copy.settings.sound}>
        <SwitchRow
          label={copy.settings.useSound}
          checked={settings.useSound}
          block={ttsBlock(synthAvailable)}
          onChange={handleChange('useSound')}
        />
        <SwitchRow
          label={copy.settings.useSoundEffects}
          checked={settings.useSoundEffects}
          onChange={handleChange('useSoundEffects')}
        />
      </PlainGroup>
    </Drawer>
  );
};

export default React.memo(AudioSettingsDrawer);
