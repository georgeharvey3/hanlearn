import React from 'react';

import { LinearProgress, Box } from '@mui/material';

import { copy } from '../../../copy';

interface ProgressBarProps {
  progress?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = (props) => (
  <Box sx={{ width: '100%' }}>
    <LinearProgress
      variant="determinate"
      value={100 - (props.progress || 0)}
      aria-label={copy.test.progressLabel(100 - (props.progress || 0))}
      sx={{
        height: 4,
        borderRadius: 2,
        bgcolor: 'divider',
        '& .MuiLinearProgress-bar': {
          bgcolor: 'primary.dark',
          borderRadius: 2,
        },
      }}
    />
  </Box>
);

export default React.memo(ProgressBar);
