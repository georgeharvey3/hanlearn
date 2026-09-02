import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { colors } from '../../../theme';

interface MasteryCardProps {
  masteredCount: number;
  totalWords: number;
}

const MasteryCard: React.FC<MasteryCardProps> = ({ masteredCount, totalWords }) => {
  const percentage = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

  return (
    <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={80}
          thickness={4}
          aria-hidden="true"
          sx={{ color: colors.divider, position: 'absolute' }}
        />
        <CircularProgress
          variant="determinate"
          value={percentage}
          size={80}
          thickness={4}
          // A gauge of a known range, not work in progress. The role also keeps
          // the ring clear of the tests that wait for the page's spinner, which
          // is the progressbar on this screen.
          role="meter"
          aria-label={`Mastery: ${percentage}%`}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          sx={{ color: colors.primaryDark }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {percentage}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="body1" color="text.secondary">
        Mastery
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {masteredCount} of {totalWords} mastered
      </Typography>
    </Paper>
  );
};

export default React.memo(MasteryCard);
