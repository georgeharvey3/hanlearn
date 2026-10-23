import React from 'react';
import { Box, CircularProgress } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';

/** The Test page while the words load: the session bar with no count, and a pale card. */
const SessionLoading: React.FC<{ onHome: () => void }> = ({ onHome }) => (
  <StudyScreen>
    <StudyTop stage={copy.study.stageTest} done={0} total={0} hideCount onEnd={onHome} />
    <Box sx={{ mt: 3, height: 236, borderRadius: 1, bgcolor: colors.skeleton }} />
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
      <CircularProgress
        size={40}
        thickness={4}
        aria-label={copy.study.loading}
        sx={{ color: colors.primaryDark }}
      />
    </Box>
  </StudyScreen>
);

export default SessionLoading;
