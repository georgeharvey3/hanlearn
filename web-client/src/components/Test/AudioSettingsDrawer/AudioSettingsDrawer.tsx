import React, { useCallback, useMemo, useState } from 'react';
import { Box, Checkbox, Drawer, FormControlLabel, FormGroup, Typography } from '@mui/material';
import {
  AudioSettings,
  getAudioSettings,
  getAudioSettingItems,
  setAudioSetting,
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
    (key: keyof AudioSettings) => (_e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      const updated = setAudioSetting(key, checked);
      setSettings(updated);
    },
    [],
  );

  const handleClose = useCallback(() => {
    onClose(settings);
  }, [onClose, settings]);

  const items = useMemo(
    () => getAudioSettingItems(speechAvailable, synthAvailable),
    [speechAvailable, synthAvailable],
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
        Audio & Voice Settings
      </Typography>
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
