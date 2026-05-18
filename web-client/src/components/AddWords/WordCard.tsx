import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import MeaningEditor from '../UI/MeaningEditor/MeaningEditor';
import Remove from '../UI/Table/TableRow/Remove/Remove';
import MoveToListDialog from './MoveToListDialog';
import { Word, WordList } from '../../types/models';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';
import * as ttsService from '../../services/ttsService';

interface WordCardProps {
  word: Word;
  charSet: 'simp' | 'trad';
  lists: WordList[];
  onDeleteWord: (id: number) => void;
  onPostMeaningUpdate: (id: number, meaning: string) => void;
  onMoveWord: (id: number, newListId: string, label: string) => void;
}

const WordCard: React.FC<WordCardProps> = ({
  word,
  charSet,
  lists = [],
  onDeleteWord,
  onPostMeaningUpdate,
  onMoveWord,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const handleSpeak = useCallback(() => {
    setIsPlaying(true);
    ttsService.speak(word[charSet], {
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }, [word, charSet]);

  const openMoveDialog = useCallback(() => setMoveDialogOpen(true), []);
  const closeMoveDialog = useCallback(() => setMoveDialogOpen(false), []);

  const handleSelectList = useCallback(
    (newListId: string) => {
      onMoveWord(word.id, newListId, word[charSet]);
      setMoveDialogOpen(false);
    },
    [onMoveWord, word, charSet],
  );

  // Only show the move button if there is somewhere to move the word to.
  const canMove = lists.filter((l) => l.id !== word.listId).length > 0;

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
              disabled={isPlaying}
              aria-label="Play pronunciation"
              sx={{ ml: 0.5, p: 0.25, color: isPlaying ? 'primary.main' : 'text.secondary' }}
            >
              <VolumeUpIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {canMove && (
            <IconButton
              onClick={openMoveDialog}
              aria-label="Move word to list"
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <DriveFileMoveOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          <Remove clicked={() => onDeleteWord(word.id)} />
        </Box>
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
      <MoveToListDialog
        open={moveDialogOpen}
        lists={lists}
        currentListId={word.listId}
        wordLabel={word[charSet]}
        onClose={closeMoveDialog}
        onSelect={handleSelectList}
      />
    </Box>
  );
};

export default WordCard;
