import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import { colors } from '../../../theme';
import { ReviewLoad } from '../../../utils/retention';

interface ReviewLoadCardProps {
  load: ReviewLoad;
}

/** The label of a day of the forecast: today, tomorrow, then the day count. */
function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return `In ${offset} days`;
}

const ReviewLoadCard: React.FC<ReviewLoadCardProps> = ({ load }) => {
  const max = Math.max(...load.days.map((day) => day.due), 1);

  return (
    <Paper
      elevation={2}
      sx={{ p: 2, borderRadius: 2, height: '100%' }}
      role="region"
      aria-label="Review load ahead"
    >
      <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
        Review load ahead
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Questions coming due over the next {load.days.length} days, from the words you have now —{' '}
        {Math.round(load.perDay)} a day on average.
        {load.overdue > 0 ? ` ${load.overdue} already overdue.` : ''}
      </Typography>

      {load.days.map((day) => (
        <Box key={day.offset} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ width: 76, flexShrink: 0 }}
            id={`load-label-${day.offset}`}
          >
            {dayLabel(day.offset)}
          </Typography>
          <Box sx={{ flexGrow: 1, mr: 1 }}>
            <Box
              role="meter"
              aria-labelledby={`load-label-${day.offset}`}
              aria-valuenow={day.due}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuetext={`${day.due} questions`}
              sx={{
                height: 12,
                borderRadius: 1,
                backgroundColor: colors.primaryDark,
                opacity: 0.85,
                width: `${(day.due / max) * 100}%`,
                minWidth: day.due > 0 ? 4 : 0,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 28, textAlign: 'right' }} aria-hidden="true">
            {day.due}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default React.memo(ReviewLoadCard);
