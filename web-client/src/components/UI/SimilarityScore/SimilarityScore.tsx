import React from 'react';
import { Box, LinearProgress } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';

interface SimilarityScoreProps {
  score: number;
  loading?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 70) return colors.success;
  if (score >= 40) return colors.warningText;
  return colors.primaryLight;
}

/** How close a translation came to the answer, as a word, a percent and a bar. */
const SimilarityScore: React.FC<SimilarityScoreProps> = ({ score, loading = false }) => {
  const color = loading ? colors.textSecondary : scoreColor(score);

  return (
    <Box
      role="meter"
      aria-label={copy.sentence.similarity}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={loading ? undefined : score}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Box component="span" sx={{ fontSize: 15, fontWeight: 600, color }}>
          {loading ? copy.sentence.scoring : copy.sentence.scoreLabel(score)}
        </Box>
        {!loading && (
          <Box
            component="span"
            sx={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}
          >
            {`${score}%`}
          </Box>
        )}
      </Box>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={score}
        aria-hidden="true"
        sx={{
          height: 8,
          borderRadius: 1,
          bgcolor: colors.divider,
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
    </Box>
  );
};

export default SimilarityScore;
