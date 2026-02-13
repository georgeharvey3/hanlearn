import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import { IconButton, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

import Table from '../../UI/Table/Table';
import TableRow from '../../UI/Table/TableRow/TableRow';
import Button from '../../UI/Buttons/Button/Button';

import { WordScore } from '../../../types/models';

interface TestSummaryProps extends RouteComponentProps {
  scores?: WordScore[];
  continueAvailable?: boolean;
  continueClicked?: () => void;
}

const TestSummary: React.FC<TestSummaryProps> = ({
  history,
  scores,
  continueAvailable,
  continueClicked,
}) => {
  const homePressed = (): void => {
    history.push('/');
  };

  const scoreRows = scores?.map((row, index) => {
    return <TableRow key={index}>{[row.char, row.score]}</TableRow>;
  });

  let continueButton: React.ReactNode = null;

  if (continueAvailable) {
    continueButton = (
      <Button
        clicked={continueClicked}
        style={{ width: '180px', height: 'auto', margin: '0 0 20px 0' }}
      >
        Continue To Sentence Stage
      </Button>
    );
  }

  return (
    <>
      <IconButton
        onClick={homePressed}
        sx={{
          position: 'absolute',
          right: 10,
          bgcolor: 'secondary.main',
          borderRadius: 1,
          p: '5px',
          boxShadow: (theme) => `0px 2px 0px ${theme.palette.grey[600]}`,
          '&:active': {
            boxShadow: '0px 0px',
            transform: 'translateY(3px)',
          },
          '&:hover': {
            bgcolor: 'primary.light',
          },
        }}
      >
        <HomeIcon sx={{ fontSize: 24 }} />
      </IconButton>
      <Typography variant="h6" component="h3">Test Summary</Typography>
      <Table headings={['Word', 'Score']}>{scoreRows}</Table>
      {continueButton}
    </>
  );
};

export default withRouter(TestSummary);
