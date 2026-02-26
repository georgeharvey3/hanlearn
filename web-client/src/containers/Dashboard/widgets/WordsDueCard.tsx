import React from 'react';
import { NavLink } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { colors } from '../../../theme';

interface WordsDueCardProps {
  dueWords: number;
  totalWords: number;
}

const WordsDueCard: React.FC<WordsDueCardProps> = ({ dueWords, totalWords }) => (
  <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
    <Typography variant="h3" sx={{ fontWeight: 'bold', color: colors.primaryDark }}>
      {dueWords}
    </Typography>
    <Typography variant="body1" color="text.secondary">
      Words Due
    </Typography>
    <Typography variant="caption" color="text.secondary">
      out of {totalWords} total
    </Typography>
    {dueWords > 0 && (
      <Button
        component={NavLink}
        to="/test-words"
        variant="contained"
        size="small"
        sx={{
          mt: 1,
          display: 'block',
          backgroundColor: colors.primaryDark,
          color: colors.white,
          '&:hover': { backgroundColor: colors.charcoal },
        }}
      >
        Test Now
      </Button>
    )}
  </Paper>
);

export default WordsDueCard;
