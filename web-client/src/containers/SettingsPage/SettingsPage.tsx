import React from 'react';
import Box from '@mui/material/Box';

import Settings from '../../components/Settings/Settings';
import { colors, fonts } from '../../theme';
import { copy } from '../../copy';

const SettingsPage: React.FC = () => {
  return (
    <Box sx={{ width: '100%', maxWidth: { xs: 560, md: 640 }, mx: 'auto', pb: 4 }}>
      <Box
        component="h1"
        sx={{
          m: 0,
          mb: 2.5,
          textAlign: 'left',
          fontFamily: fonts.body,
          fontSize: 32,
          fontWeight: 600,
          color: colors.text,
        }}
      >
        {copy.settings.title}
      </Box>
      <Settings />
    </Box>
  );
};

export default SettingsPage;
