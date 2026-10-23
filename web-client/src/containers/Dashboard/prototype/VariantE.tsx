// PROTOTYPE (#403) variant E, "Almanac": the Dashboard is about time. Today is
// a tear-off calendar page (a 黄历) with the chengyu down its edge; below it,
// the review load of the next seven days, so the learner sees why today
// matters. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';

import { colors, fonts, shadows } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { DashboardVariantProps } from './dashboardShared';
import { loadAhead } from './dashboardWords';

export const name = 'Almanac';

const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const VariantE: React.FC<DashboardVariantProps> = ({
  words,
  charSet,
  stats,
  loading,
  error,
  resumeLabel,
  lists,
  activeListId,
  onSwitchList,
  onStart,
  onResume,
  onStartOver,
  onAddWords,
  onRetry,
}) => {
  const [chengyuOpen, setChengyuOpen] = useState(false);
  const daily = useMemo(() => getDailyChengyu(), []);
  const today = new Date();
  const empty = !loading && !error && words.length === 0;
  const load = useMemo(() => loadAhead(words, 7), [words]);
  const max = Math.max(1, ...load);
  const dueToday = load[0];
  const streak = stats?.streak ?? 0;
  const chengyu = (charSet === 'simp' ? daily.chengyu : daily.tradChengyu).replace(/[，,]/g, '');

  const primary = empty
    ? { label: 'Add words', onClick: onAddWords }
    : resumeLabel
      ? { label: 'Resume', onClick: onResume }
      : { label: dueToday ? 'Start' : 'Practise anyway', onClick: onStart };

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pb: 24,
        textAlign: 'left',
      }}
    >
      {/* Lists, as small tabs above the page. */}
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[{ id: '__all__', name: 'All' }, ...lists].map((l) => (
          <ButtonBase
            key={l.id}
            onClick={() => onSwitchList(l.id)}
            sx={{
              flex: '0 0 auto',
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              fontFamily: 'inherit',
              fontSize: 14,
              bgcolor: l.id === activeListId ? colors.text : 'transparent',
              color: l.id === activeListId ? colors.white : colors.textSecondary,
            }}
          >
            {l.name}
          </ButtonBase>
        ))}
      </Box>

      {/* Today's page. */}
      <Box
        sx={{
          bgcolor: colors.card,
          boxShadow: shadows.card,
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
        {/* The red band and its binding holes. */}
        <Box
          sx={{
            bgcolor: colors.primaryLight,
            color: colors.white,
            px: 2.5,
            py: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 18 }}>
            {MONTHS[today.getMonth()]}月
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            {[0, 1].map((i) => (
              <Box
                key={i}
                sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors.paper }}
              />
            ))}
          </Box>
          <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 18 }}>
            星期{WEEKDAYS[today.getDay()]}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', px: 2.5, pt: 2, pb: 2.5, gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{ fontSize: 112, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em' }}
            >
              {today.getDate()}
            </Typography>

            <Box sx={{ mt: 2, minHeight: 56 }}>
              {loading && <Skeleton width="70%" height={40} />}
              {error && (
                <Button onClick={onRetry} sx={{ color: colors.error, px: 0 }}>
                  Could not load · Try again
                </Button>
              )}
              {!loading && !error && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    {/* 宜, "suitable today", as an almanac says it. */}
                    <Box
                      sx={{
                        fontFamily: fonts.hanzi,
                        color: colors.white,
                        bgcolor: colors.primaryDark,
                        px: 0.75,
                        borderRadius: 0.5,
                        fontSize: 18,
                      }}
                    >
                      宜
                    </Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                      {empty
                        ? 'Add words'
                        : resumeLabel
                          ? resumeLabel
                          : dueToday
                            ? `${dueToday} reviews`
                            : 'Rest'}
                    </Typography>
                  </Box>
                  {!empty && !resumeLabel && dueToday > 0 && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {stats?.estimatedStudyTime}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* The chengyu, down the page's edge. */}
          <ButtonBase
            onClick={() => setChengyuOpen(true)}
            sx={{
              flex: '0 0 auto',
              borderLeft: `1px solid ${colors.divider}`,
              pl: 2,
              display: 'flex',
              gap: 0.5,
              alignItems: 'flex-start',
            }}
          >
            <Typography
              sx={{
                writingMode: 'vertical-rl',
                fontFamily: fonts.hanzi,
                fontSize: 34,
                letterSpacing: '0.15em',
                lineHeight: 1,
              }}
            >
              {chengyu}
            </Typography>
            <Typography
              sx={{
                writingMode: 'vertical-rl',
                fontSize: 11,
                color: colors.textSecondary,
                letterSpacing: '0.05em',
              }}
            >
              {daily.pinyin}
            </Typography>
          </ButtonBase>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, px: 2.5, pb: 2.5 }}>
          <Button
            onClick={primary.onClick}
            disabled={loading || error}
            variant="contained"
            size="large"
            sx={{
              flex: 1,
              py: 1.25,
              bgcolor: colors.primaryDark,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            {primary.label}
          </Button>
          {resumeLabel && !empty && (
            <Button onClick={onStartOver} sx={{ color: colors.textSecondary }}>
              Start over
            </Button>
          )}
        </Box>
      </Box>

      {/* The week ahead. */}
      <Box>
        <Typography variant="caption" sx={{ color: colors.textSecondary, letterSpacing: '0.08em' }}>
          NEXT 7 DAYS
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120, mt: 1 }}>
          {load.map((n, i) => {
            const day = new Date(today.getTime() + i * 86400000);
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: i === 0 ? colors.primaryLight : colors.text }}
                >
                  {loading ? '' : n}
                </Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: loading ? 8 : Math.max(3, (n / max) * 72),
                    bgcolor: i === 0 ? colors.primaryLight : colors.text,
                    opacity: i === 0 ? 1 : 0.18 + 0.5 * (n / max),
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.4s',
                  }}
                />
                <Typography
                  sx={{ fontFamily: fonts.hanzi, fontSize: 15, color: colors.textSecondary }}
                >
                  {i === 0 ? '今' : WEEKDAYS[day.getDay()]}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* The last 7 days, stamped where a session happened. */}
      {!empty && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const lit = 6 - i < streak;
            return (
              <Box
                key={i}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 0.5,
                  border: `1.5px solid ${lit ? colors.primaryLight : colors.borderStrong}`,
                  bgcolor: lit ? colors.primaryLight : 'transparent',
                  color: colors.white,
                  fontFamily: fonts.hanzi,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: lit ? `rotate(${(i % 3) - 1}deg)` : 'none',
                }}
              >
                {lit ? '学' : ''}
              </Box>
            );
          })}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {streak} day streak
          </Typography>
        </Box>
      )}

      <Dialog open={chengyuOpen} onClose={() => setChengyuOpen(false)} fullWidth maxWidth="sm">
        <ErrorBoundary>
          <Chengyu />
        </ErrorBoundary>
      </Dialog>
    </Box>
  );
};

export default VariantE;
