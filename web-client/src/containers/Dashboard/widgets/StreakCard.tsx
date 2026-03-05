import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { colors } from '../../../theme';

interface StreakCardProps {
  streak: number;
}

const StreakCard: React.FC<StreakCardProps> = ({ streak }) => (
  <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
    <LocalFireDepartmentIcon
      sx={{ fontSize: 40, color: streak > 0 ? colors.primaryLight : colors.divider }}
    />
    <Typography variant="h3" sx={{ fontWeight: 'bold', color: colors.primaryDark }}>
      {streak}
    </Typography>
    <Typography variant="body1" color="text.secondary">
      Day Streak
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {streak === 0 ? 'Complete a test to start!' : 'Keep it up!'}
    </Typography>
  </Paper>
);

export default React.memo(StreakCard);
