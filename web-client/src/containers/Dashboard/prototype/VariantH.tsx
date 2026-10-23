// PROTOTYPE (#403) variant H, "Ensō": one goal for the day, after Lingvist's
// single number and Skritter's daily goal. A brush circle closes as today's
// reviews are done; the closed circle reads 完. Below it, the last seven days
// as small circles: a day without study is simply an open circle, never a
// broken streak. Throwaway.
import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';

import { colors, fonts } from '../../../theme';
import { getDailyChengyu } from '../../../data/chengyus';
import { DashboardVariantProps, ListMenu, dateKey } from './dashboardShared';

export const name = 'Ensō';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** A brush circle with a gap at the top, filled to `share`. */
const Enso: React.FC<{
  size: number;
  share: number;
  width: number;
  ink?: string;
  track?: boolean;
}> = ({ size, share, width, ink = colors.text, track = true }) => {
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  // The ensō never quite closes: 4% of the ring is the brush's gap.
  const arc = c * 0.96;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-80deg)' }}
    >
      {track && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.outline}
          strokeWidth={width * 0.35}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
        />
      )}
      {share > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ink}
          strokeWidth={width}
          strokeDasharray={`${arc * Math.min(1, share)} ${c}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      )}
    </svg>
  );
};

const VariantH: React.FC<DashboardVariantProps> = (props) => {
  const {
    stats,
    loading,
    error,
    resumeLabel,
    words,
    history,
    charSet,
    onStart,
    onResume,
    onStartOver,
    onAddWords,
    onRetry,
  } = props;
  const daily = useMemo(() => getDailyChengyu(), []);
  const empty = !loading && !error && words.length === 0;
  const today = new Date();
  const byDate = useMemo(() => new Map(history.map((h) => [h.date, h])), [history]);

  const done = byDate.get(dateKey(today))?.reviews ?? 0;
  const left = stats?.dueWords ?? 0;
  const share = empty ? 0 : left === 0 ? 1 : done / (done + left);
  const finished = !empty && left === 0;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    return { d, reviews: byDate.get(dateKey(d))?.reviews ?? 0 };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.reviews));

  const onCircle = empty ? onAddWords : resumeLabel ? onResume : onStart;

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pb: 24,
      }}
    >
      <Box sx={{ alignSelf: 'flex-start' }}>
        <ListMenu {...props} />
      </Box>

      <ButtonBase
        onClick={onCircle}
        disabled={loading || error}
        aria-label={resumeLabel ? 'Resume' : 'Start'}
        sx={{ position: 'relative', borderRadius: '50%', mt: 2 }}
      >
        <Enso
          size={280}
          share={loading ? 0 : share}
          width={22}
          ink={finished ? colors.primaryDark : colors.text}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading && <CircularProgress size={28} sx={{ color: colors.textSecondary }} />}
          {error && <Typography sx={{ color: colors.error }}>Could not load</Typography>}
          {empty && (
            <>
              <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Add words</Typography>
            </>
          )}
          {!loading && !error && !empty && finished && (
            <>
              <Typography
                sx={{
                  fontFamily: fonts.hanzi,
                  fontSize: 96,
                  lineHeight: 1,
                  color: colors.primaryDark,
                }}
              >
                完
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Done for today
              </Typography>
            </>
          )}
          {!loading && !error && !empty && !finished && (
            <>
              <Typography
                sx={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}
              >
                {left}
              </Typography>
              <Typography color="text.secondary">left today</Typography>
              <Typography
                sx={{
                  mt: 1.5,
                  px: 2,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: colors.text,
                  color: colors.white,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {resumeLabel ? 'Resume' : 'Start'}
              </Typography>
            </>
          )}
        </Box>
      </ButtonBase>

      <Box sx={{ minHeight: 40, mt: 1.5, textAlign: 'center' }}>
        {error && (
          <Button onClick={onRetry} sx={{ color: colors.primaryDark }}>
            Try again
          </Button>
        )}
        {!loading && !error && !empty && (
          <Typography color="text.secondary">
            {resumeLabel ?? `${done} reviewed · ${stats?.estimatedStudyTime ?? ''}`}
          </Typography>
        )}
        {resumeLabel && !empty && (
          <Button onClick={onStartOver} size="small" sx={{ color: colors.textSecondary }}>
            Start over
          </Button>
        )}
      </Box>

      {/* The week, one small circle per day; the size of the ink is the day's reviews. */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
        {week.map(({ d, reviews }, i) => (
          <Box
            key={i}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
          >
            <Enso
              size={36}
              width={4}
              share={i === 6 ? share : reviews ? 0.35 + 0.65 * (reviews / weekMax) : 0}
              ink={i === 6 ? colors.text : colors.primaryDark}
            />
            <Typography
              sx={{
                fontFamily: fonts.hanzi,
                fontSize: 14,
                color: i === 6 ? colors.text : colors.textSecondary,
                fontWeight: i === 6 ? 700 : 400,
              }}
            >
              {i === 6 ? '今' : WEEKDAYS[d.getDay()]}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        {stats?.totalWords ?? 0} words · {stats?.masteredCount ?? 0} mastered
      </Typography>

      {/* The chengyu, quiet at the foot. */}
      <Box sx={{ mt: 5, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 26, letterSpacing: '0.2em' }}>
          {charSet === 'simp' ? daily.chengyu : daily.tradChengyu}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {daily.pinyin}
        </Typography>
      </Box>
    </Box>
  );
};

export default VariantH;
