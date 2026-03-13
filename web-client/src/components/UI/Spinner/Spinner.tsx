import React, { CSSProperties } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

interface SpinnerProps {
  style?: CSSProperties;
}

const Spinner: React.FC<SpinnerProps> = (props) => (
  <Box
    role="status"
    aria-label="Loading"
    sx={{ display: 'flex', justifyContent: 'center', p: 2 }}
    style={props.style}
  >
    <CircularProgress color="primary" />
  </Box>
);

export default Spinner;
