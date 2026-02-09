import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';

const Footer: React.FC = () => (
  <Box sx={{ textAlign: 'center', py: 3, color: '#E6E0AE' }}>
    <Typography variant="body2">
      HanLearn is a free, open source application. Please send any
      feedback/suggestions to hanlearnapp AT gmail.com
    </Typography>
    <Divider sx={{ my: 1, borderColor: '#E6E0AE' }} />
    <Typography variant="body2">
      &copy; <Link href="https://github.com/georgeharvey3" sx={{ color: '#E6E0AE' }}>George Harvey</Link> 2020
    </Typography>
  </Box>
);

export default Footer;
