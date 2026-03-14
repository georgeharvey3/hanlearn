import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface SimilarityScoreProps {
  score: number;
  size?: number;
  loading?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#2e7d32'; // success green
  if (score >= 60) return '#0288d1'; // info blue
  if (score >= 40) return '#ed6c02'; // warning orange
  return '#d32f2f'; // error red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Great';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Keep trying';
}

const SimilarityScore: React.FC<SimilarityScoreProps> = ({ score, size = 80, loading = false }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={size} aria-label="Calculating similarity score" />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Scoring…
        </Typography>
      </Box>
    );
  }

  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={score}
          size={size}
          sx={{ color }}
          aria-label={`Similarity score: ${score}%`}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color }}>
            {score}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" sx={{ color, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
};

export default SimilarityScore;
