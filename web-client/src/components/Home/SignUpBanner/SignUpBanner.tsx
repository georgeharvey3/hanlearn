import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';

import Button from '../../UI/Buttons/Button/Button';

interface SignUpBannerProps {
  tryOutClicked?: () => void;
  signUpClicked?: () => void;
}

const SignUpBanner: React.FC<SignUpBannerProps> = (props) => (
  <Paper sx={{ width: '95%', mx: 'auto', p: 3, textAlign: 'center' }}>
    <Typography variant="h5" sx={{ color: '#AA381E' }}>Join HanLearn!</Typography>
    <Typography sx={{ color: '#AA381E', mt: 1 }}>
      Create a free account to edit translations, add your own words and
      practise with spaced repitition.
    </Typography>
    <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
      <Button colour="red" clicked={props.tryOutClicked}>
        Try it out
      </Button>
      <Button colour="red" clicked={props.signUpClicked}>
        Sign Up
      </Button>
    </Stack>
  </Paper>
);

export default SignUpBanner;
