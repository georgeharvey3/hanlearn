// PROTOTYPE (#403) variant L, "Five skills": what no other app has, the five
// directions, drawn as one pentagon. Each corner is a direction; the ink
// reaches as far as the share of words at Familiar or above. Tap a corner for
// its levels and its retention. The weakest corner starts selected. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { colors, shadows } from '../../../theme';
import { DIRECTIONS, Direction } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { BANK_LABELS } from '../../../utils/scheduling';
import { DashboardVariantProps, SessionStrip, strengthOf } from './dashboardShared';

export const name = 'Five skills';

const SIZE = 320;
const C = SIZE / 2;
const R = 112;

const corner = (i: number, r: number): [number, number] => {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const VariantL: React.FC<DashboardVariantProps> = (props) => {
  const { stats, loading, error, words, history } = props;
  const empty = !loading && !error && words.length === 0;
  const ready = !loading && !error && !empty;

  const strength = useMemo(
    () =>
      DIRECTIONS.reduce(
        (acc, d) => {
          acc[d] = ready ? strengthOf(stats?.directionDistribution[d]) : 0;
          return acc;
        },
        {} as Record<Direction, number>,
      ),
    [stats, ready],
  );
  const retention = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recent = history.filter((h) => new Date(`${h.date}T00:00:00`) >= since);
    return DIRECTIONS.reduce(
      (acc, d) => {
        const r = recent.reduce((s, h) => s + h.byDirection[d].reviews, 0);
        const p = recent.reduce((s, h) => s + h.byDirection[d].passes, 0);
        acc[d] = r ? p / r : null;
        return acc;
      },
      {} as Record<Direction, number | null>,
    );
  }, [history]);

  const weakest = [...DIRECTIONS].sort((a, b) => strength[a] - strength[b])[0];
  const [picked, setPicked] = useState<Direction | null>(null);
  const sel = picked ?? weakest;
  const counts = stats?.directionDistribution[sel] ?? {};

  const shape = DIRECTIONS.map((d, i) => corner(i, R * Math.max(0.04, strength[d])).join(',')).join(
    ' ',
  );

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pb: props.bare ? 0 : 24,
        textAlign: 'left',
      }}
    >
      {!props.bare && <SessionStrip {...props} />}

      <Box sx={{ position: 'relative', width: SIZE, height: SIZE, mx: 'auto', mt: 1 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Guide rings at 25, 50, 75 and 100%. */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={DIRECTIONS.map((_, i) => corner(i, R * f).join(',')).join(' ')}
              fill="none"
              stroke={f === 1 ? colors.borderStrong : colors.outline}
              strokeWidth={f === 1 ? 1.5 : 1}
            />
          ))}
          {DIRECTIONS.map((_, i) => {
            const [x, y] = corner(i, R);
            return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={colors.outline} />;
          })}
          {ready && (
            <polygon
              points={shape}
              fill={colors.primaryDark}
              fillOpacity={0.22}
              stroke={colors.primaryDark}
              strokeWidth={2.5}
              strokeLinejoin="round"
              style={{ transition: 'all 0.5s' }}
            />
          )}
          {ready &&
            DIRECTIONS.map((d, i) => {
              const [x, y] = corner(i, R * Math.max(0.04, strength[d]));
              return (
                <circle
                  key={d}
                  cx={x}
                  cy={y}
                  r={d === sel ? 6 : 4}
                  fill={d === sel ? colors.primaryLight : colors.primaryDark}
                />
              );
            })}
        </svg>

        {/* Corner labels, tappable. */}
        {DIRECTIONS.map((d, i) => {
          const [x, y] = corner(i, R + 34);
          const [from, to] = DIRECTION_LABELS[d].split(' → ');
          return (
            <Box
              key={d}
              component="button"
              onClick={() => setPicked(d)}
              sx={{
                position: 'absolute',
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'center',
                lineHeight: 1.15,
                fontSize: 12,
                color: d === sel ? colors.primaryLight : colors.text,
                fontWeight: d === sel ? 700 : 500,
                p: 0.5,
              }}
            >
              {from}
              <br />→ {to}
            </Box>
          );
        })}
      </Box>

      {/* The picked corner. */}
      <Box sx={{ bgcolor: colors.card, boxShadow: shadows.card, borderRadius: 2, p: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{DIRECTION_LABELS[sel]}</Typography>
        {ready ? (
          <>
            <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                  {Math.round(strength[sel] * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Familiar or better
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                  {retention[sel] === null
                    ? '—'
                    : `${Math.round((retention[sel] as number) * 100)}%`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recalled, 30 days
                </Typography>
              </Box>
            </Box>
            {/* The words of this direction at each level, as one bar. */}
            <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', mt: 2 }}>
              {[1, 2, 3, 4, 5].map((b) => (
                <Box
                  key={b}
                  sx={{
                    flex: `${counts[b] ?? 0} 0 0`,
                    bgcolor: colors.primaryDark,
                    opacity: 0.15 + b * 0.17,
                  }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              {[1, 2, 3, 4, 5].map((b) => (
                <Typography key={b} variant="caption" color="text.secondary">
                  {BANK_LABELS[b]} {counts[b] ?? 0}
                </Typography>
              ))}
            </Box>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {empty ? 'No words yet' : '—'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default VariantL;
