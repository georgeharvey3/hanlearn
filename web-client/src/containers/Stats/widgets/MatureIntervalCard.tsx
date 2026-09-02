import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { colors } from '../../../theme';
import { MATURE_INTERVAL_DAYS } from '../../../utils/retention';

interface MatureIntervalCardProps {
  medianInterval: number | null;
  matureCount: number;
}

const MatureIntervalCard: React.FC<MatureIntervalCardProps> = ({ medianInterval, matureCount }) => (
  <Paper
    elevation={2}
    sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}
    role="region"
    aria-label="Median interval of mature words"
  >
    <TrendingUpIcon
      aria-hidden="true"
      sx={{ fontSize: 40, color: matureCount > 0 ? colors.primaryLight : colors.divider }}
    />
    <Typography variant="h3" sx={{ fontWeight: 'bold', color: colors.primaryDark }}>
      {medianInterval === null ? '—' : Math.round(medianInterval)}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      median days between reviews
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
      Across {matureCount} mature {matureCount === 1 ? 'question' : 'questions'} — those already at{' '}
      {MATURE_INTERVAL_DAYS} days or more.
    </Typography>
  </Paper>
);

export default React.memo(MatureIntervalCard);
