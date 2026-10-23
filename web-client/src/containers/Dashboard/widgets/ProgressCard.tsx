import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { copy } from '../../../copy';
import { colors, levelLine } from '../../../theme';
import { BANK_LABELS } from '../../../utils/scheduling';
import { PROGRESS_WEEKS, progressWeeks } from '../../../utils/dashboard';
import { type ReviewStatsDay } from '../../../utils/retention';
import { Card } from './parts';

const text = copy.dashboard.progress;

/** The chart draws the levels a word reaches by study; New only grows by adding words. */
const LEVELS = [2, 3, 4, 5];

const W = 1100;
const H = 200;
/** The weeks back the change of a level is measured against: about a month. */
const CHANGE_WEEKS = 4;

/** The smallest of 1, 2, 5, 10, 20, 50… at or above `n`: a tidy step for the axis. */
function niceStep(n: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(n, 1)));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= n) ?? 10 * power;
}

export interface ProgressCardProps {
  loading: boolean;
  empty: boolean;
  history: ReviewStatsDay[];
}

/** The words at each level over 12 weeks: one line a level, one point a week. */
const ProgressCard: React.FC<ProgressCardProps> = ({ loading, empty, history }) => {
  const weeks = useMemo(() => progressWeeks(empty ? [] : history, new Date()), [empty, history]);
  const [picked, setPicked] = useState(PROGRESS_WEEKS - 1);
  const hasHistory = weeks.some((w) => w.levels);

  const max = Math.max(1, ...weeks.flatMap((w) => LEVELS.map((l) => w.levels?.[l] ?? 0)));
  const step = niceStep(max / 4);
  const top = step * 4;
  const x = (i: number) => ((i + 0.5) * W) / PROGRESS_WEEKS;
  const y = (v: number) => H - (v / top) * H;

  // A level's line starts at the first week with a snapshot.
  const lines = LEVELS.map((level) => ({
    level,
    points: weeks
      .map((w, i) => (w.levels ? `${x(i).toFixed(1)},${y(w.levels[level] ?? 0).toFixed(1)}` : null))
      .filter(Boolean)
      .join(' '),
  }));

  const countsOf = (i: number) =>
    LEVELS.map((l) => ({ level: BANK_LABELS[l], n: weeks[i].levels?.[l] ?? 0 }));

  const sel = weeks[picked];
  const before = picked >= CHANGE_WEEKS ? weeks[picked - CHANGE_WEEKS] : null;

  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {LEVELS.map((l) => (
          <Box
            key={l}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            <Box sx={{ width: 14, height: 3, borderRadius: 1, bgcolor: levelLine[l] }} />
            {BANK_LABELS[l]}
          </Box>
        ))}
      </Box>

      {loading ? (
        <Skeleton
          variant="rounded"
          height={220}
          sx={{ mt: 1.5, bgcolor: colors.skeleton }}
          aria-hidden
        />
      ) : (
        <>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75 }}>
            <Box
              aria-hidden
              sx={{
                width: 22,
                height: H,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                fontSize: 11,
                lineHeight: 1,
                color: colors.textSecondary,
              }}
            >
              {[4, 3, 2, 1, 0].map((k) => (
                <span key={k}>{k * step}</span>
              ))}
            </Box>
            <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: H }}>
              <svg
                width="100%"
                height={H}
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                role="img"
                aria-label={hasHistory ? text.chart(countsOf(PROGRESS_WEEKS - 1)) : text.noHistory}
                style={{ position: 'absolute', inset: 0, display: 'block' }}
              >
                {[0, 50, 100, 150].map((gy) => (
                  <line
                    key={gy}
                    x1={0}
                    y1={gy}
                    x2={W}
                    y2={gy}
                    stroke={colors.skeleton}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line
                  x1={0}
                  y1={H}
                  x2={W}
                  y2={H}
                  stroke={colors.borderStrong}
                  vectorEffect="non-scaling-stroke"
                />
                {hasHistory && (
                  <line
                    x1={x(picked)}
                    y1={0}
                    x2={x(picked)}
                    y2={H}
                    stroke={colors.text}
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {lines.map((line) => (
                  <polyline
                    key={line.level}
                    points={line.points}
                    fill="none"
                    stroke={levelLine[line.level]}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <Box
                role="group"
                aria-label={text.weeks}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${PROGRESS_WEEKS}, minmax(0, 1fr))`,
                }}
              >
                {weeks.map((w, i) => (
                  <ButtonBase
                    key={w.date}
                    aria-pressed={i === picked}
                    aria-label={text.weekAria(copy.dashboard.longDate(w.date), countsOf(i))}
                    onClick={() => setPicked(i)}
                  />
                ))}
              </Box>
            </Box>
          </Box>
          <Box
            aria-hidden
            sx={{
              mt: 0.5,
              ml: '28px',
              display: 'grid',
              gridTemplateColumns: `repeat(${PROGRESS_WEEKS}, minmax(0, 1fr))`,
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            {weeks.map((w, i) => (
              <span key={w.date} style={{ whiteSpace: 'nowrap' }}>
                {i % 4 === 0 || i === PROGRESS_WEEKS - 1 ? copy.dashboard.shortDate(w.date) : ''}
              </span>
            ))}
          </Box>

          {empty || !hasHistory ? (
            <Typography sx={{ mt: 1.5, fontSize: 15, color: colors.textSecondary }}>
              {empty ? text.noWords : text.noHistory}
            </Typography>
          ) : (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${colors.divider}` }}>
              <Box
                sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
                  {picked === PROGRESS_WEEKS - 1 ? text.today : copy.dashboard.longDate(sel.date)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: colors.textSecondary }}>
                  {text.pastMonth}
                </Typography>
              </Box>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {LEVELS.map((l) => {
                  const n = sel.levels?.[l] ?? 0;
                  const change = sel.levels && before?.levels ? n - (before.levels[l] ?? 0) : null;
                  return (
                    <Box
                      key={l}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}
                    >
                      <Box
                        sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: levelLine[l] }}
                      />
                      <Box component="span" sx={{ flex: 1, color: colors.textSecondary }}>
                        {BANK_LABELS[l]}
                      </Box>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {sel.levels ? n : copy.dashboard.none}
                      </Box>
                      <Box
                        component="span"
                        sx={{ width: 72, textAlign: 'right', color: colors.primaryDark }}
                      >
                        {change === null ? copy.dashboard.none : text.change(change)}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}
    </Card>
  );
};

export default ProgressCard;
