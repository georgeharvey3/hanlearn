import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { colors } from '../../../theme';

interface WeeklyStatsCardProps {
  sessions: number;
  wordsReviewed: number;
}

const WeeklyStatsCard: React.FC<WeeklyStatsCardProps> = ({ sessions, wordsReviewed }) => (
  <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
    <CalendarMonthIcon
      aria-hidden="true"
      sx={{ fontSize: 40, color: sessions > 0 ? colors.primaryLight : colors.divider }}
    />
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 'bold', color: colors.primaryDark }}>
          {sessions}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {sessions === 1 ? 'session' : 'sessions'}
        </Typography>
      </Box>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 'bold', color: colors.primaryDark }}>
          {wordsReviewed}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          words reviewed
        </Typography>
      </Box>
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
      Last 7 days
    </Typography>
  </Paper>
);

export default React.memo(WeeklyStatsCard);
