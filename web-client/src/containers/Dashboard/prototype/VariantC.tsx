// PROTOTYPE (#403) variant C, "Seal": a red seal in the centre is the Start
// button, ringed by five arcs, one per direction, that fill with strength.
// Lists swipe left and right around it; the chengyu waits in a bottom sheet.
// Throwaway.
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { colors, fonts, shadows } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { DIRECTIONS, Direction } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { DashboardVariantProps, strengthOf } from './dashboardShared';

export const name = 'Seal';

const SIZE = 300;
const R = 132;
const STROKE = 14;
const GAP_DEG = 8;

const polar = (deg: number, r = R) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [SIZE / 2 + r * Math.cos(rad), SIZE / 2 + r * Math.sin(rad)];
};

const arc = (start: number, end: number) => {
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
};

const VariantC: React.FC<DashboardVariantProps> = ({
  stats,
  loading,
  error,
  resumeLabel,
  lists,
  activeListId,
  activeListName,
  onSwitchList,
  onStart,
  onResume,
  onStartOver,
  onAddWords,
  onRetry,
}) => {
  const [selected, setSelected] = useState<Direction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const daily = getDailyChengyu();
  const empty = !loading && !error && (stats?.totalWords ?? 0) === 0;
  const due = stats?.dueWords ?? 0;

  const ids = ['__all__', ...lists.map((l) => l.id)];
  const at = Math.max(0, ids.indexOf(activeListId));
  const stepList = (delta: number) => onSwitchList(ids[(at + delta + ids.length) % ids.length]);

  const seg = 360 / DIRECTIONS.length;

  let seal: { top: string; bottom: string; onClick: () => void } | null = null;
  if (empty) seal = { top: '+', bottom: 'Add words', onClick: onAddWords };
  else if (resumeLabel) seal = { top: '续', bottom: 'Resume', onClick: onResume };
  else if (!loading && !error)
    seal = { top: String(due), bottom: due ? 'Start' : 'Practise', onClick: onStart };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 6 }}>
      {/* Two quiet facts in the corners. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 420 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Streak
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>
            {loading || empty ? '–' : `${stats?.streak} days`}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">
            Words
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>{loading ? '–' : stats?.totalWords}</Typography>
        </Box>
      </Box>

      {/* The list, swiped by arrows. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <IconButton onClick={() => stepList(-1)} aria-label="Previous list" size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
          {activeListName}
        </Typography>
        <IconButton onClick={() => stepList(1)} aria-label="Next list" size="small">
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
        {ids.map((id, i) => (
          <Box
            key={id}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: i === at ? colors.text : colors.borderStrong,
            }}
          />
        ))}
      </Box>

      {/* The dial. */}
      <Box sx={{ position: 'relative', width: SIZE, height: SIZE, mt: 2 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {DIRECTIONS.map((d, i) => {
            const start = i * seg + GAP_DEG / 2;
            const end = (i + 1) * seg - GAP_DEG / 2;
            const s = loading || empty || error ? 0 : strengthOf(stats?.directionDistribution[d]);
            const fillEnd = start + (end - start) * Math.max(s, 0.001);
            const dim = selected && selected !== d;
            return (
              <g
                key={d}
                onClick={() => setSelected(selected === d ? null : d)}
                style={{ cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity 0.2s' }}
              >
                <path
                  d={arc(start, end)}
                  stroke={colors.outline}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeLinecap="round"
                />
                {s > 0 && (
                  <path
                    d={arc(start, fillEnd)}
                    stroke={colors.primaryDark}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeLinecap="round"
                  />
                )}
                {/* A wide invisible hit area. */}
                <path
                  d={arc(start, end)}
                  stroke="transparent"
                  strokeWidth={STROKE * 3}
                  fill="none"
                />
              </g>
            );
          })}
        </svg>

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading && <CircularProgress sx={{ color: colors.primaryLight }} />}
          {error && (
            <Box sx={{ textAlign: 'center' }} role="alert">
              <Typography sx={{ color: 'error.main' }}>Could not load</Typography>
              <Button onClick={onRetry} color="inherit">
                Try again
              </Button>
            </Box>
          )}
          {seal && (
            <ButtonBase
              onClick={seal.onClick}
              sx={{
                width: 150,
                height: 150,
                borderRadius: 4,
                bgcolor: empty ? colors.primaryDark : colors.primaryLight,
                color: colors.white,
                boxShadow: shadows.dialog,
                display: 'flex',
                flexDirection: 'column',
                transform: 'rotate(-3deg)',
                transition: 'transform 0.15s',
                '&:active': { transform: 'rotate(-3deg) scale(0.96)' },
              }}
            >
              <Typography
                sx={{
                  fontSize: seal.top.length > 2 ? 48 : 64,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: resumeLabel && !empty ? fonts.hanzi : undefined,
                }}
              >
                {seal.top}
              </Typography>
              <Typography sx={{ mt: 1, fontWeight: 600, letterSpacing: '0.06em' }}>
                {seal.bottom}
              </Typography>
            </ButtonBase>
          )}
        </Box>
      </Box>

      {/* What the ring or seal means right now. */}
      <Box sx={{ minHeight: 48, textAlign: 'center', mt: 1 }}>
        {selected && stats ? (
          <Typography>
            {DIRECTION_LABELS[selected]} ·{' '}
            <b>{Math.round(strengthOf(stats.directionDistribution[selected]) * 100)}%</b>
          </Typography>
        ) : resumeLabel && !empty ? (
          <>
            <Typography color="text.secondary">{resumeLabel}</Typography>
            <Button onClick={onStartOver} size="small" sx={{ color: colors.textSecondary }}>
              Start over
            </Button>
          </>
        ) : (
          !loading &&
          !empty &&
          due > 0 && <Typography color="text.secondary">{stats?.estimatedStudyTime}</Typography>
        )}
      </Box>

      {/* The chengyu, one tap away. */}
      <ButtonBase
        onClick={() => setSheetOpen(true)}
        sx={{
          mt: 3,
          px: 2.5,
          py: 1.25,
          borderRadius: 999,
          border: `1px solid ${colors.borderStrong}`,
          bgcolor: colors.card,
          gap: 1.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          今日成语
        </Typography>
        <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 22, letterSpacing: '0.1em' }}>
          {localStorage.getItem('charSet') === 'simp' ? daily.chengyu : daily.tradChengyu}
        </Typography>
        <ChevronRightIcon fontSize="small" />
      </ButtonBase>

      <Drawer
        anchor="bottom"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        PaperProps={{
          sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh' },
        }}
      >
        <Box sx={{ p: 1 }}>
          <ErrorBoundary>
            <Chengyu />
          </ErrorBoundary>
        </Box>
      </Drawer>
    </Box>
  );
};

export default VariantC;
