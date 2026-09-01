import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import { Box, Button as MuiButton, Chip, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

import { DirectionResult, WordScore } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';

const resultConfig: Record<
  DirectionResult,
  { color: 'success' | 'warning' | 'error'; label: string }
> = {
  pass: { color: 'success', label: 'Known' },
  lapse: { color: 'warning', label: 'Nearly' },
  fail: { color: 'error', label: 'Not known' },
};

interface TestSummaryProps extends RouteComponentProps {
  scores?: WordScore[];
}

const TestSummary: React.FC<TestSummaryProps> = ({ history, scores }) => {
  const homePressed = (): void => {
    history.push('/');
  };

  // One row is one question, so the counts are per direction, not per word.
  // A lapse is not counted correct: it did not succeed on the attempt that
  // carries the grade. See docs/adr/0007-grade-the-first-attempt.md.
  const total = scores?.length ?? 0;
  const correct = scores?.filter((s) => s.result === 'pass').length ?? 0;
  const wordCount = new Set(scores?.map((s) => s.char)).size;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const accuracyColor = pct >= 70 ? 'success.main' : pct >= 40 ? 'warning.main' : 'error.main';

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h5" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
        Session Summary
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {total} question{total !== 1 ? 's' : ''} across {wordCount} word
        {wordCount !== 1 ? 's' : ''}
      </Typography>
      {total > 0 && (
        <Typography
          variant="subtitle1"
          data-testid="session-accuracy"
          sx={{ fontWeight: 600, color: accuracyColor, mb: 2.5 }}
        >
          {correct} / {total} correct ({pct}%)
        </Typography>
      )}

      <Box
        sx={{
          maxHeight: { xs: 'calc(100vh - 280px)', sm: 'calc(100vh - 320px)' },
          overflowY: 'auto',
          mx: { xs: 0, sm: 2 },
          mb: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
        }}
      >
        {scores?.map((row, index) => {
          const config = resultConfig[row.result];
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                <Typography lang="zh" sx={{ fontSize: '1.1rem', fontWeight: 500 }}>
                  {row.char}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {DIRECTION_LABELS[row.direction]}
                </Typography>
              </Box>
              <Chip
                label={config.label}
                color={config.color}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, minWidth: 90, flexShrink: 0 }}
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
