// PROTOTYPE (#403) headline P, "Today's plan": the headline says what the
// session holds before it starts: its reviews and its new words as one bar,
// its length, and the next three days, so the learner sees what today is
// worth. One Start. Counts only, never a word. Throwaway.
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';

import { colors, shadows } from '../../../theme';
import { DashboardVariantProps, ListMenu } from './dashboardShared';
import { WidgetStack, summarisePlan } from './headlineShared';

export const name = "Today's plan";

const VariantP: React.FC<DashboardVariantProps> = (props) => {
  const {
    words,
    forecast,
    loading,
    error,
    resumeLabel,
    onStart,
    onResume,
    onStartOver,
    onAddWords,
    onRetry,
  } = props;
  const empty = !loading && !error && words.length === 0;
  const ready = !loading && !error && !empty;
  const plan = useMemo(() => summarisePlan(words), [words]);
  const reviews = plan.words - plan.newWords;
  const ahead = [1, 2, 3].map((i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' }),
      n: forecast[i] ?? 0,
    };
  });

  const button = {
    py: 1.5,
    fontSize: 17,
    bgcolor: colors.primaryDark,
    color: colors.white,
    '&:hover': { bgcolor: colors.primaryDarkHover },
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', pb: 24, textAlign: 'left' }}>
      <Box sx={{ bgcolor: colors.card, boxShadow: shadows.card, borderRadius: 3, p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Today&apos;s session</Typography>
          <ListMenu {...props} />
        </Box>

        {loading && <Skeleton variant="rounded" height={130} sx={{ mt: 1 }} />}
        {error && (
          <Box sx={{ py: 2 }}>
            <Typography sx={{ color: colors.error }}>Could not load</Typography>
            <Button onClick={onRetry} sx={{ color: colors.primaryDark, px: 0 }}>
              Try again
            </Button>
          </Box>
        )}
        {empty && (
          <Button onClick={onAddWords} variant="contained" fullWidth sx={{ ...button, mt: 2 }}>
            Add words
          </Button>
        )}

        {ready && resumeLabel && (
          <>
            <Typography sx={{ fontSize: 32, fontWeight: 700, mt: 1 }}>{resumeLabel}</Typography>
            <Typography color="text.secondary">Unfinished</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button onClick={onResume} variant="contained" sx={{ ...button, flex: 1 }}>
                Resume
              </Button>
              <Button onClick={onStartOver} sx={{ color: colors.textSecondary }}>
                Start over
              </Button>
            </Box>
          </>
        )}

        {ready && !resumeLabel && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
              <Typography sx={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1 }}>
                {plan.questions ? plan.time : '—'}
              </Typography>
              <Typography color="text.secondary">
                {plan.questions ? `${plan.questions} questions` : 'Nothing due today'}
              </Typography>
            </Box>

            {plan.questions > 0 && (
              <>
                {/* What the session is made of. */}
                <Box
                  sx={{
                    display: 'flex',
                    height: 12,
                    borderRadius: 6,
                    overflow: 'hidden',
                    mt: 2,
                    gap: '2px',
                  }}
                >
                  <Box sx={{ flex: `${reviews} 0 0`, bgcolor: colors.primaryDark }} />
                  {plan.newWords > 0 && (
                    <Box sx={{ flex: `${plan.newWords} 0 0`, bgcolor: colors.primaryLight }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
                  <Legend color={colors.primaryDark} label={`${reviews} to review`} />
                  {plan.newWords > 0 && (
                    <Legend color={colors.primaryLight} label={`${plan.newWords} new`} />
                  )}
                </Box>
              </>
            )}

            <Button onClick={onStart} variant="contained" fullWidth sx={{ ...button, mt: 2.5 }}>
              {plan.questions ? 'Start' : 'Practise anyway'}
            </Button>

            {/* The next three days, as plain counts. */}
            <Box sx={{ display: 'flex', mt: 2, pt: 1.5, borderTop: `1px solid ${colors.divider}` }}>
              {ahead.map((a) => (
                <Box key={a.label} sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {a.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{a.n} due</Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      <WidgetStack {...props} />
    </Box>
  );
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
    <Typography variant="body2">{label}</Typography>
  </Box>
);

export default VariantP;
