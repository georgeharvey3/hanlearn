import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import GitHubIcon from '@mui/icons-material/GitHub';
import IconButton from '@mui/material/IconButton';

const Footer: React.FC = () => (
  <Box
    component="footer"
    sx={{
      backgroundColor: 'primary.main',
      color: 'primary.dark',
      textAlign: 'center',
      py: 3,
      px: 2,
      mt: 2,
      borderRadius: '.5rem .5rem 0 0',
    }}
  >
    <Typography variant="body2" sx={{ mb: 1 }}>
      HanLearn is a free, open source Chinese learning app.
    </Typography>
    <IconButton
      component="a"
      href="https://github.com/georgeharvey3/hanlearn"
      target="_blank"
      rel="noopener noreferrer"
      sx={{ color: 'primary.dark', mb: 1 }}
      aria-label="GitHub repository"
    >
      <GitHubIcon />
    </IconButton>
    <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
      &copy; {new Date().getFullYear()}{' '}
      <Link
        href="https://github.com/georgeharvey3"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: 'inherit', textDecoration: 'underline' }}
      >
        George Harvey
      </Link>
    </Typography>
  </Box>
);

export default Footer;
