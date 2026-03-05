import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import Button from '../../UI/Buttons/Button/Button';

interface AccountSummaryProps {
  numDue?: number;
  numTot?: number;
  testClicked?: () => void;
}

const AccountSummary: React.FC<AccountSummaryProps> = (props) => (
  <Paper sx={{ width: '95%', mx: 'auto', p: 3, textAlign: 'center' }}>
    <Typography variant="h5" sx={{ color: 'text.primary' }}>
      You have {props.numDue}/{props.numTot} words due for testing...
    </Typography>
    <Button disabled={props.numTot === 0} type="primary" clicked={props.testClicked}>
      Test
    </Button>
  </Paper>
);

export default AccountSummary;
