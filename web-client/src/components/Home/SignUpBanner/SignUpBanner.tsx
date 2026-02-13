import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiButton from '@mui/material/Button';

interface SignUpBannerProps {
  tryOutClicked?: () => void;
  signUpClicked?: () => void;
}

const SignUpBanner: React.FC<SignUpBannerProps> = (props) => (
  <Box
    sx={{
      bgcolor: 'primary.dark',
      py: { xs: 5, sm: 6 },
      px: 3,
      textAlign: 'center',
      borderRadius: 2
    }}
  >
    <Typography variant="h4" sx={{ color: 'common.white', fontWeight: 600 }}>
      Ready to build your vocabulary?
    </Typography>
    <Typography
      variant="body1"
      sx={{ color: 'common.white', mt: 1.5, opacity: 0.85, maxWidth: 520, mx: 'auto' }}
    >
      Sign up for free and start mastering Mandarin today.
    </Typography>
    <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 3 }}>
      <MuiButton
        variant="outlined"
        onClick={props.tryOutClicked}
        sx={{
          color: 'common.white',
          borderColor: 'rgba(255,255,255,0.5)',
          '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' },
          px: 3,
        }}
      >
        Try it out
      </MuiButton>
      <MuiButton
        variant="contained"
        onClick={props.signUpClicked}
        sx={{
          bgcolor: 'common.white',
          color: 'primary.dark',
          '&:hover': { bgcolor: 'grey.100' },
          px: 3,
          fontWeight: 600,
        }}
      >
        Sign Up
      </MuiButton>
    </Stack>
  </Box>
);

export default SignUpBanner;
