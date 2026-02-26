import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import Settings from '../../components/Settings/Settings';

const SettingsPage: React.FC = () => {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" sx={{ mt: '30px', color: 'text.primary', display: 'inline-block' }}>
        Settings
      </Typography>
      <Paper
        elevation={2}
        sx={{
          width: 300,
          display: 'block',
          mx: 'auto',
          my: '10px',
          p: '10px',
        }}
      >
        <Settings />
      </Paper>
    </Box>
  );
};

export default SettingsPage;
