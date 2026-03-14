import React from 'react';
import Box from '@mui/material/Box';
import { colors } from '../../theme';

const SkipLink: React.FC = () => (
  <Box
    component="a"
    href="#main-content"
    sx={{
      position: 'absolute',
      left: '-9999px',
      top: 'auto',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      zIndex: 9999,
      '&:focus': {
        position: 'fixed',
        top: 8,
        left: 8,
        width: 'auto',
        height: 'auto',
        overflow: 'visible',
        bgcolor: colors.primaryDark,
        color: colors.white,
        px: 2,
        py: 1,
        borderRadius: 1,
        fontSize: '0.875rem',
        fontWeight: 600,
        textDecoration: 'none',
        boxShadow: 3,
      },
    }}
  >
    Skip to main content
  </Box>
);

export default SkipLink;
