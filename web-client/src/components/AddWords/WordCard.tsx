import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MeaningEditor from '../UI/MeaningEditor/MeaningEditor';
import Remove from '../UI/Table/TableRow/Remove/Remove';
import { Word } from '../../types/models';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';
import * as ttsService from '../../services/ttsService';

interface WordCardProps {
  word: Word;
  charSet: 'simp' | 'trad';
  onDeleteWord: (id: number) => void;
  onPostMeaningUpdate: (id: number, meaning: string) => void;
}

const WordCard: React.FC<WordCardProps> = ({
  word,
  charSet,
  onDeleteWord,
  onPostMeaningUpdate,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = useCallback(() => {
    setIsPlaying(true);
    ttsService.speak(word[charSet], {
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }, [word, charSet]);

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography lang="zh" sx={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.2 }}>
            {word[charSet]}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.25 }}>
            <Typography lang="zh-Latn" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              {word.pinyin}
            </Typography>
            <IconButton
              size="small"
              onClick={handleSpeak}
              aria-label="Play pronunciation"
              sx={{ ml: 0.5, p: 0.25, color: isPlaying ? 'primary.main' : 'text.secondary' }}
            >
              <VolumeUpIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
        </Box>
        <Remove clicked={() => onDeleteWord(word.id)} />
      </Box>
      <Box sx={{ mt: 1 }}>
        <MeaningEditor
          value={word.meaning}
          onChange={(newMeaning) => onPostMeaningUpdate(word.id, newMeaning)}
          size="small"
        />
      </Box>
      {word.due_date && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.75 }}>
          {formatRelativeDueDate(word.due_date)}
        </Typography>
      )}
    </Box>
  );
};

export default WordCard;
