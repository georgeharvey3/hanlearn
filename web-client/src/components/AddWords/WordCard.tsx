import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MeaningEditor from '../UI/MeaningEditor/MeaningEditor';
import Remove from '../UI/Table/TableRow/Remove/Remove';
import { Word } from '../../types/models';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';

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
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, lineHeight: 1.2 }}>
            {word[charSet]}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.25 }}>
            {word.pinyin}
          </Typography>
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
