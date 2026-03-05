import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

import Button from '../../UI/Buttons/Button/Button';

interface AccountSummaryProps {
  numDue?: number;
  numTot?: number;
  testClicked?: () => void;
  loading?: boolean;
}

const AccountSummary: React.FC<AccountSummaryProps> = (props) => (
  <Paper sx={{ width: '95%', mx: 'auto', p: 3, textAlign: 'center' }}>
    {props.loading ? (
      <Skeleton variant="text" width="60%" sx={{ mx: 'auto', fontSize: '1.5rem', mb: 1 }} />
    ) : (
      <Typography variant="h5" sx={{ color: 'text.primary' }}>
        You have {props.numDue}/{props.numTot} words due for testing...
      </Typography>
    )}
    <Button
      disabled={props.loading || props.numTot === 0}
      type="primary"
      clicked={props.testClicked}
    >
      Test
    </Button>
  </Paper>
);

export default AccountSummary;
