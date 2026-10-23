// PROTOTYPE (#403) variant K, "Mountain": after Duolingo's path, the learner's
// progress as a climb. The five levels are terraces up an ink-wash mountain,
// New at the foot and Mastered at the summit under a red sun. Each word is a
// dot on its terrace (a dot, never the word). The week's climbing is one
// number beside it. Throwaway.
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

import { colors, fonts } from '../../../theme';
import { BANK_LABELS } from '../../../utils/scheduling';
import { DashboardVariantProps, SessionStrip, dateKey } from './dashboardShared';

export const name = 'Mountain';

const TERRACE_H = 84;
const MAX_DOTS = 48;

const VariantK: React.FC<DashboardVariantProps> = (props) => {
  const { stats, loading, error, words, history } = props;
  const empty = !loading && !error && words.length === 0;
  const dist = stats?.levelDistribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const weekClimb = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const from = dateKey(since);
    return history.filter((h) => h.date >= from).reduce((s, h) => s + h.promoted, 0);
  }, [history]);

  const levels = [5, 4, 3, 2, 1];
  const height = TERRACE_H * levels.length + 40;

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pb: 24,
        textAlign: 'left',
      }}
    >
      <SessionStrip {...props} />

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 28, fontWeight: 700 }}>
          {loading ? '–' : (stats?.totalWords ?? 0)}
          <Typography
            component="span"
            sx={{ fontSize: 15, fontWeight: 400, color: colors.textSecondary, ml: 1 }}
          >
            words
          </Typography>
        </Typography>
        {!empty && !loading && !error && (
          <Typography sx={{ color: colors.primaryDark, fontWeight: 700 }}>
            ↑ {weekClimb}{' '}
            <Typography component="span" sx={{ color: colors.textSecondary, fontWeight: 400 }}>
              steps up this week
            </Typography>
          </Typography>
        )}
      </Box>

      <Box sx={{ position: 'relative', height }}>
        {/* The mountain: two washes and a sun. */}
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 400 ${height}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          <path
            d={`M -20 ${height} L 120 ${height * 0.35} L 170 ${height * 0.42} L 230 ${height * 0.05} L 300 ${height * 0.3} L 420 ${height} Z`}
            fill={colors.outline}
            opacity={0.55}
          />
          <path
            d={`M -20 ${height} L 90 ${height * 0.6} L 200 ${height * 0.2} L 330 ${height * 0.65} L 420 ${height} Z`}
            fill={colors.divider}
            opacity={0.7}
          />
          <circle cx={318} cy={44} r={22} fill={colors.primaryLight} opacity={0.85} />
        </svg>

        {levels.map((level, i) => {
          const count = dist[level] ?? 0;
          // Terraces widen toward the foot of the mountain.
          const width = 46 + i * 13.5;
          return (
            <Box
              key={level}
              sx={{
                position: 'absolute',
                top: 20 + i * TERRACE_H,
                left: `${(100 - width) / 2}%`,
                width: `${width}%`,
                height: TERRACE_H - 10,
                borderBottom: `3px solid ${level === 5 ? colors.primaryDark : colors.text}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                pb: 0.75,
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap-reverse', gap: '3px', mb: 0.75 }}>
                {loading ? (
                  <Skeleton width="60%" height={12} />
                ) : (
                  Array.from({ length: Math.min(count, MAX_DOTS) }, (_, j) => (
                    <Box
                      key={j}
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: level === 5 ? colors.primaryDark : colors.text,
                        opacity: 0.35 + level * 0.13,
                      }}
                    />
                  ))
                )}
                {count > MAX_DOTS && (
                  <Typography sx={{ fontSize: 10, lineHeight: '7px', color: colors.textSecondary }}>
                    +{count - MAX_DOTS}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{BANK_LABELS[level]}</Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                  {loading ? '' : count}
                </Typography>
              </Box>
            </Box>
          );
        })}

        {empty && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 64, color: colors.borderStrong }}>
              山
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VariantK;
