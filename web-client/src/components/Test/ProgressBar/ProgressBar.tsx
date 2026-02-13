import React from 'react';

import { LinearProgress, Box } from '@mui/material';

interface ProgressBarProps {
  progress?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = (props) => (
  <Box sx={{ width: '90%', mx: 'auto' }}>
    <LinearProgress
      variant="determinate"
      value={100 - (props.progress || 0)}
      sx={{
        height: 10,
        borderRadius: 5,
        bgcolor: 'divider',
        '& .MuiLinearProgress-bar': {
          bgcolor: 'primary.main',
          borderRadius: 5,
        },
      }}
    />
  </Box>
);

export default ProgressBar;
