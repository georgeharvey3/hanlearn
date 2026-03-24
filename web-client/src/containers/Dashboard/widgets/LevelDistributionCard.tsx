import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { colors } from '../../../theme';

interface LevelDistributionCardProps {
  distribution: Record<number, number>;
}

const levelLabels: Record<number, string> = {
  1: 'New',
  2: 'Learning',
  3: 'Familiar',
  4: 'Known',
  5: 'Mastered',
};

const LevelDistributionCard: React.FC<LevelDistributionCardProps> = ({ distribution }) => {
  const max = Math.max(...Object.values(distribution), 1);

  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
        Word Levels
      </Typography>
      {[1, 2, 3, 4, 5].map((level) => (
        <Box key={level} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ width: 60, flexShrink: 0 }}
            id={`level-label-${level}`}
          >
            {levelLabels[level]}
          </Typography>
          <Box sx={{ flexGrow: 1, mr: 1 }}>
            <Box
              role="meter"
              aria-labelledby={`level-label-${level}`}
              aria-valuenow={distribution[level] ?? 0}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuetext={`${distribution[level] ?? 0} words`}
              sx={{
                height: 12,
                borderRadius: 1,
                backgroundColor: colors.primaryDark,
                opacity: 0.3 + (level / 5) * 0.7,
                width: `${((distribution[level] ?? 0) / max) * 100}%`,
                minWidth: distribution[level] > 0 ? 4 : 0,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 20, textAlign: 'right' }} aria-hidden="true">
            {distribution[level] ?? 0}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default React.memo(LevelDistributionCard);
