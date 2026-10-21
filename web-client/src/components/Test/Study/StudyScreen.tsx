import React from 'react';
import { Box } from '@mui/material';

import { colors, fonts } from '../../../theme';

/**
 * The column a study screen fills: a phone's width, the height of the window,
 * with the main action at the foot. A session hides the app's navigation, so
 * this is the whole screen.
 */
const StudyScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      width: '100%',
      maxWidth: 440,
      mx: 'auto',
      minHeight: '100dvh',
      boxSizing: 'border-box',
      px: 2,
      pb: 3,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: fonts.body,
      color: colors.text,
    }}
  >
    {children}
  </Box>
);

export default StudyScreen;
