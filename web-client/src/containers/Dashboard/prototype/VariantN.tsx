// PROTOTYPE (#403) headline N, "Focus": the headline turns the five-skills
// widget into an action. It names the weakest direction and starts a session
// that asks it first (the engine's priority direction), or only it. The
// skills widget moves up to sit right under it. Throwaway.
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';

import { colors } from '../../../theme';
import { DIRECTIONS, Direction } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { DashboardVariantProps, ListMenu, strengthOf } from './dashboardShared';
import { WidgetStack, summarisePlan } from './headlineShared';
import SkillsWidget from './SkillsWidget';

export const name = 'Focus';

/** A small pentagon with one corner lit. */
const Corner: React.FC<{ index: number; strength: Record<Direction, number> }> = ({
  index,
  strength,
}) => {
  const S = 72;
  const pt = (i: number, r: number) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return `${S / 2 + r * Math.cos(a)},${S / 2 + r * Math.sin(a)}`;
  };
  return (
    <svg width={S} height={S}>
      <polygon
        points={DIRECTIONS.map((_, i) => pt(i, 30)).join(' ')}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
      />
      <polygon
        points={DIRECTIONS.map((d, i) => pt(i, 30 * Math.max(0.05, strength[d]))).join(' ')}
        fill="rgba(255,255,255,0.25)"
        stroke={colors.white}
        strokeWidth={1.5}
      />
      <circle
        cx={pt(index, 30 * Math.max(0.05, strength[DIRECTIONS[index]])).split(',')[0]}
        cy={pt(index, 30 * Math.max(0.05, strength[DIRECTIONS[index]])).split(',')[1]}
        r={4.5}
        fill={colors.white}
      />
    </svg>
  );
};

const VariantN: React.FC<DashboardVariantProps> = (props) => {
  const {
    stats,
    words,
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

  const strength = useMemo(
    () =>
      DIRECTIONS.reduce(
        (acc, d) => {
          acc[d] = strengthOf(stats?.directionDistribution[d]);
          return acc;
        },
        {} as Record<Direction, number>,
      ),
    [stats],
  );
  const weakest = [...DIRECTIONS].sort((a, b) => strength[a] - strength[b])[0];
  const first = useMemo(() => summarisePlan(words, { priority: weakest }), [words, weakest]);
  const only = useMemo(
    () => summarisePlan(words, { priority: weakest, onlyPriority: true }),
    [words, weakest],
  );
  const [from, to] = DIRECTION_LABELS[weakest].split(' → ');

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', pb: 24, textAlign: 'left' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ListMenu {...props} />
      </Box>

      {loading && <Skeleton variant="rounded" height={210} sx={{ borderRadius: 3 }} />}

      {error && (
        <Box sx={{ py: 3 }}>
          <Typography sx={{ color: colors.error }}>Could not load</Typography>
          <Button onClick={onRetry} sx={{ color: colors.primaryDark, px: 0 }}>
            Try again
          </Button>
        </Box>
      )}

      {empty && (
        <Box sx={{ py: 3 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 2 }}>No words yet</Typography>
          <Button
            onClick={onAddWords}
            variant="contained"
            size="large"
            sx={{
              bgcolor: colors.primaryDark,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            Add words
          </Button>
        </Box>
      )}

      {ready && (
        <Box sx={{ bgcolor: colors.primaryDark, color: colors.white, borderRadius: 3, p: 2.5 }}>
          {resumeLabel ? (
            <>
              <Typography sx={{ opacity: 0.8, fontSize: 14 }}>Unfinished</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 700, mb: 2 }}>{resumeLabel}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={onResume}
                  variant="contained"
                  sx={{
                    flex: 1,
                    py: 1.25,
                    bgcolor: colors.white,
                    color: colors.primaryDark,
                    '&:hover': { bgcolor: colors.paper },
                  }}
                >
                  Resume
                </Button>
                <Button onClick={onStartOver} sx={{ color: colors.white, opacity: 0.85 }}>
                  Start over
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography sx={{ opacity: 0.8, fontSize: 14 }}>Today&apos;s focus</Typography>
                  <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                    {from}
                    <br />→ {to}
                  </Typography>
                  <Typography sx={{ opacity: 0.8, mt: 1, fontSize: 14 }}>
                    {Math.round(strength[weakest] * 100)}% Familiar or better
                  </Typography>
                </Box>
                <Corner index={DIRECTIONS.indexOf(weakest)} strength={strength} />
              </Box>

              <Button
                onClick={onStart}
                variant="contained"
                fullWidth
                sx={{
                  mt: 2.5,
                  py: 1.4,
                  fontSize: 16,
                  bgcolor: colors.white,
                  color: colors.primaryDark,
                  '&:hover': { bgcolor: colors.paper },
                }}
              >
                {first.questions
                  ? `Start · ${first.questions} questions · ${first.time}`
                  : 'Practise anyway'}
              </Button>
              {only.questions > 0 && (
                <Button
                  onClick={onStart}
                  fullWidth
                  sx={{ mt: 0.5, color: colors.white, opacity: 0.85 }}
                >
                  Only this skill · {only.questions} questions
                </Button>
              )}
            </>
          )}
        </Box>
      )}

      {ready && (
        <Box sx={{ mt: 4 }}>
          <SkillsWidget {...props} bare />
        </Box>
      )}
      <WidgetStack {...props} omit={['skills']} />
    </Box>
  );
};

export default VariantN;
