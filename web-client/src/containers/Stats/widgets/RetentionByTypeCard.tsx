import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import { colors } from '../../../theme';
import { DIRECTION_LABELS } from '../../../utils/directions';
import {
  DirectionMetrics,
  MIN_REVIEWS_FOR_RETENTION,
  TARGET_RETENTION_RANGE,
} from '../../../utils/retention';
import { percent, days } from './format';

interface RetentionByTypeCardProps {
  metrics: DirectionMetrics[];
  windowDays: number;
}

/**
 * The colour of a retention figure against the target band.
 *
 * Below the band the schedule is asking too late and the learner is forgetting;
 * above it the schedule is asking too early and spending reviews it did not
 * need. Both are worth seeing, so neither reads as neutral.
 */
function retentionColor(value: number | null): string {
  if (value === null) return colors.charcoal;
  if (value < TARGET_RETENTION_RANGE.min) return colors.error;
  if (value > TARGET_RETENTION_RANGE.max) return colors.warning;
  return colors.success;
}

const columnSx = { flex: 1, minWidth: 62, textAlign: 'right' as const };

const RetentionByTypeCard: React.FC<RetentionByTypeCardProps> = ({ metrics, windowDays }) => (
  <Paper
    elevation={2}
    sx={{ p: 2, borderRadius: 2, height: '100%' }}
    role="region"
    aria-label="Retention by question type"
  >
    <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
      By question type
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
      Retention and promotion over the last {windowDays} days. Median interval is of the words that
      are mature now.
    </Typography>

    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 340 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: '0 0 132px' }}>
            Question
          </Typography>
          <Tooltip title="Correct first attempts, of reviews of a word already learned">
            <Typography variant="caption" color="text.secondary" sx={columnSx}>
              Retention
            </Typography>
          </Tooltip>
          <Tooltip title="Reviews that moved the word up a level">
            <Typography variant="caption" color="text.secondary" sx={columnSx}>
              Promoted
            </Typography>
          </Tooltip>
          <Tooltip title="Reviews that left the word at the level it held">
            <Typography variant="caption" color="text.secondary" sx={columnSx}>
              Stalled
            </Typography>
          </Tooltip>
          <Tooltip title="Median interval of this question type's mature words">
            <Typography variant="caption" color="text.secondary" sx={columnSx}>
              Median
            </Typography>
          </Tooltip>
        </Box>

        {metrics.map((metric) => (
          <Box
            key={metric.direction}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 0.75,
              borderTop: `1px solid ${colors.divider}`,
            }}
          >
            <Box sx={{ flex: '0 0 132px' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {DIRECTION_LABELS[metric.direction]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {metric.reviews} {metric.reviews === 1 ? 'review' : 'reviews'}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{ ...columnSx, fontWeight: 700, color: retentionColor(metric.trueRetention) }}
            >
              {percent(metric.trueRetention)}
            </Typography>
            <Typography variant="body2" sx={columnSx}>
              {percent(metric.promotionRate)}
            </Typography>
            <Typography variant="body2" sx={columnSx}>
              {percent(metric.stallRate)}
            </Typography>
            <Typography variant="body2" sx={columnSx}>
              {days(metric.medianMatureInterval)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>

    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
      Target retention is {percent(TARGET_RETENTION_RANGE.min)} to{' '}
      {percent(TARGET_RETENTION_RANGE.max)}. A dash means fewer than {MIN_REVIEWS_FOR_RETENTION}{' '}
      reviews, which is too few to read.
    </Typography>
  </Paper>
);

export default React.memo(RetentionByTypeCard);
