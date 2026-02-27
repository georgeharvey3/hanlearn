import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import Settings from '../../components/Settings/Settings';

const SettingsPage: React.FC = () => {
  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, pb: 6 }}>
      <Typography
        variant="h5"
        sx={{ mt: 4, mb: 3, fontWeight: 700, color: 'text.primary' }}
      >
        Settings
      </Typography>
      <Settings />
    </Box>
  );
};

export default SettingsPage;
