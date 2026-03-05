import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import { Box, Button as MuiButton, Chip, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

import { WordScore } from '../../../types/models';

const scoreConfig: Record<
  WordScore['score'],
  { color: 'success' | 'info' | 'warning' | 'error'; label: string }
> = {
  'Very Strong': { color: 'success', label: 'Very Strong' },
  Strong: { color: 'success', label: 'Strong' },
  Average: { color: 'info', label: 'Average' },
  Weak: { color: 'warning', label: 'Weak' },
  'Very Weak': { color: 'error', label: 'Very Weak' },
};

interface TestSummaryProps extends RouteComponentProps {
  scores?: WordScore[];
}

const TestSummary: React.FC<TestSummaryProps> = ({ history, scores }) => {
  const homePressed = (): void => {
    history.push('/');
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
        Session Summary
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {scores?.length} word{scores && scores.length !== 1 ? 's' : ''} tested
      </Typography>

      <Box
        sx={{
          maxHeight: { xs: 220, sm: 280 },
          overflowY: 'auto',
          mx: { xs: 0, sm: 2 },
          mb: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
        }}
      >
        {scores?.map((row, index) => {
          const config = scoreConfig[row.score];
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1,
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 500 }}>{row.char}</Typography>
              <Chip
                label={config.label}
                color={config.color}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, minWidth: 90 }}
              />
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <MuiButton
          variant="outlined"
          onClick={homePressed}
          startIcon={<HomeIcon />}
          sx={{
            borderColor: 'grey.300',
            color: 'text.primary',
            '&:hover': { borderColor: 'grey.400', bgcolor: 'grey.50' },
          }}
        >
          Home
        </MuiButton>
      </Box>
    </Box>
  );
};

export default withRouter(TestSummary);
