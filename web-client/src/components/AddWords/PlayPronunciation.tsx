import React, { useCallback, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import * as ttsService from '../../services/ttsService';

interface PlayPronunciationProps {
  text: string;
}

const PlayPronunciation: React.FC<PlayPronunciationProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = useCallback(() => {
    setIsPlaying(true);
    ttsService.speak(text, {
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }, [text]);

  return (
    <IconButton
      size="small"
      onClick={handleSpeak}
      disabled={isPlaying}
      aria-label={isPlaying ? 'Playing pronunciation' : 'Play pronunciation'}
      sx={{ color: isPlaying ? 'primary.main' : 'text.secondary' }}
    >
      <VolumeUpIcon fontSize="small" />
    </IconButton>
  );
};

export default PlayPronunciation;
