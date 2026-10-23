import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { copy } from '../../../copy';
import { colors, levelInk } from '../../../theme';
import { DIRECTIONS, Direction } from '../../../types/models';
import { BankCounts, DIRECTION_LABELS } from '../../../utils/directions';
import { BANKS, BANK_LABELS } from '../../../utils/scheduling';
import { recallByDirection, strengthOf } from '../../../utils/dashboard';
import { type ReviewStatsDay } from '../../../utils/retention';
import { Card, Figure } from './parts';

const text = copy.dashboard.skills;

const SIZE = 340;
const C = SIZE / 2;
/** The radius of the outer ring, and of the corner labels around it. */
const R = 100;
const LABEL_R = 138;

const corner = (i: number, r: number): [number, number] => {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const polygon = (radius: (d: Direction) => number) =>
  DIRECTIONS.map((d, i) =>
    corner(i, radius(d))
      .map((v) => v.toFixed(1))
      .join(','),
  ).join(' ');

const percent = (share: number | null) => (share === null ? null : Math.round(share * 100));

export interface SkillsCardProps {
  loading: boolean;
  empty: boolean;
  distribution: Record<Direction, BankCounts> | null;
  history: ReviewStatsDay[];
}

/**
 * The five directions as one pentagon. Each corner reaches as far as the share
 * of that direction's words at Familiar or above. The weakest corner starts
 * selected, and a tap on a corner shows its levels and its recall.
 */
const SkillsCard: React.FC<SkillsCardProps> = ({ loading, empty, distribution, history }) => {
  const strength = useMemo(
    () =>
      DIRECTIONS.reduce(
        (acc, d) => {
          acc[d] = empty || !distribution ? 0 : strengthOf(distribution[d]);
          return acc;
        },
        {} as Record<Direction, number>,
      ),
    [empty, distribution],
  );
  const recall = useMemo(() => recallByDirection(history, new Date()), [history]);
  const weakest = DIRECTIONS.reduce((w, d) => (strength[d] < strength[w] ? d : w), DIRECTIONS[0]);
  const [picked, setPicked] = useState<Direction | null>(null);
  const sel = picked ?? weakest;
  const counts = distribution?.[sel];
  const total = counts ? BANKS.reduce((sum, b) => sum + (counts[b] ?? 0), 0) : 0;

  if (loading) {
    return (
      <Box
        aria-hidden
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}
      >
        <Skeleton variant="circular" width={240} height={240} sx={{ bgcolor: colors.skeleton }} />
        <Skeleton
          variant="rounded"
          height={132}
          sx={{ alignSelf: 'stretch', bgcolor: colors.skeleton }}
        />
      </Box>
    );
  }

  const summary = DIRECTIONS.map((d) => `${text.names[d]} ${percent(strength[d])}%`).join(', ');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ position: 'relative', width: SIZE, height: SIZE, maxWidth: '100%', mx: 'auto' }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={text.chart(summary)}
          style={{ display: 'block' }}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={polygon(() => R * f)}
              fill="none"
              stroke={colors.divider}
              strokeWidth={1}
            />
          ))}
          {DIRECTIONS.map((d, i) => {
            const [x, y] = corner(i, R);
            return <line key={d} x1={C} y1={C} x2={x} y2={y} stroke={colors.divider} />;
          })}
          <polygon
            points={polygon((d) => R * Math.max(0.04, strength[d]))}
            fill="rgba(26, 92, 64, 0.18)"
            stroke={colors.primaryDark}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {DIRECTIONS.map((d, i) => {
            const [x, y] = corner(i, R * Math.max(0.04, strength[d]));
            const on = d === sel;
            return (
              <circle
                key={d}
                cx={x}
                cy={y}
                r={on ? 6 : 3.5}
                fill={on ? colors.primaryLight : colors.primaryDark}
              />
            );
          })}
        </svg>
        {DIRECTIONS.map((d, i) => {
          const [x, y] = corner(i, LABEL_R);
          const on = d === sel;
          return (
            <Tooltip key={d} title={DIRECTION_LABELS[d]} placement="top">
              <ButtonBase
                aria-pressed={on}
                aria-label={`${text.names[d]}, ${DIRECTION_LABELS[d]}`}
                onClick={() => setPicked(d)}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                  width: 92,
                  minHeight: 44,
                  p: '2px',
                  borderRadius: 1,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  lineHeight: 1.25,
                  color: on ? colors.primaryLight : colors.text,
                  fontWeight: on ? 700 : 400,
                }}
              >
                {text.names[d]}
              </ButtonBase>
            </Tooltip>
          );
        })}
      </Box>

      <Card sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Typography component="h3" sx={{ m: 0, fontSize: 17, fontWeight: 700 }}>
            {text.names[sel]}
          </Typography>
          <Typography sx={{ fontSize: 13, color: colors.textSecondary }}>
            {DIRECTION_LABELS[sel]}
          </Typography>
        </Box>
        {empty || !counts ? (
          <Typography sx={{ mt: 1, fontSize: 15, color: colors.textSecondary }}>
            {text.noWords}
          </Typography>
        ) : (
          <>
            <Box sx={{ mt: 1, display: 'flex', gap: 3 }}>
              <Figure value={text.percent(percent(strength[sel]))} label={text.strong} />
              <Figure value={text.percent(percent(recall[sel]))} label={text.recall} />
            </Box>
            <Box
              aria-hidden
              sx={{
                mt: 2,
                height: 10,
                borderRadius: 5,
                overflow: 'hidden',
                display: 'flex',
                gap: '2px',
              }}
            >
              {total > 0 &&
                BANKS.map((b) => (
                  <Box key={b} sx={{ flex: `${counts[b] ?? 0} 0 0`, bgcolor: levelInk[b - 1] }} />
                ))}
            </Box>
            <Box
              sx={{
                mt: 0.75,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 0.5,
                flexWrap: 'wrap',
              }}
            >
              {BANKS.map((b) => (
                <Typography key={b} sx={{ fontSize: 12, color: colors.textSecondary }}>
                  {BANK_LABELS[b]} {counts[b] ?? 0}
                </Typography>
              ))}
            </Box>
          </>
        )}
      </Card>
    </Box>
  );
};

export default SkillsCard;
