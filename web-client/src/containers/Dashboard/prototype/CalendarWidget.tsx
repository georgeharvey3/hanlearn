// PROTOTYPE (#403) variant I, "Ink calendar": after Anki's review heatmap,
// past and future on one month grid. A studied day is inked green, darker for
// more reviews; today is ringed in seal red; the days ahead are grey with the
// count that will come due. Tap a day for its numbers. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { colors, fonts, shadows } from '../../../theme';
import { getDailyChengyu } from '../../../data/chengyus';
import { DashboardVariantProps, SessionStrip, dateKey } from './dashboardShared';

export const name = 'Ink calendar';

const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const HEAD = ['一', '二', '三', '四', '五', '六', '日'];

const VariantI: React.FC<DashboardVariantProps> = (props) => {
  const { loading, error, words, history, forecast, charSet } = props;
  const daily = useMemo(() => getDailyChengyu(), []);
  const empty = !loading && !error && words.length === 0;
  const today = new Date();
  const todayKey = dateKey(today);
  const [monthOffset, setMonthOffset] = useState(0);
  const [picked, setPicked] = useState<string>(todayKey);

  const byDate = useMemo(() => new Map(history.map((h) => [h.date, h])), [history]);
  const max = Math.max(1, ...history.map((h) => h.reviews));

  const month = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const lead = (month.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from(
      { length: daysIn },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
    ),
  ];

  const ahead = (d: Date) =>
    Math.round(
      (d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        86400000,
    );

  const monthDays = history.filter((h) => h.date.startsWith(dateKey(month).slice(0, 7)));
  const monthReviews = monthDays.reduce((s, h) => s + h.reviews, 0);
  const monthPromoted = monthDays.reduce((s, h) => s + h.promoted, 0);

  const pickedDate = new Date(`${picked}T00:00:00`);
  const pickedAhead = ahead(pickedDate);
  const pickedHistory = byDate.get(picked);
  let pickedLine = '';
  if (pickedAhead > 0) {
    pickedLine =
      pickedAhead < forecast.length ? `${forecast[pickedAhead]} due` : 'Not forecast yet';
  } else if (pickedAhead === 0) {
    pickedLine = `${pickedHistory?.reviews ?? 0} reviewed · ${forecast[0] ?? 0} due`;
  } else {
    pickedLine = pickedHistory
      ? `${pickedHistory.reviews} reviewed · ${pickedHistory.promoted} moved up`
      : 'No study';
  }

  return (
    <Box
      sx={{
        maxWidth: 520,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        pb: props.bare ? 0 : 24,
        textAlign: 'left',
      }}
    >
      {!props.bare && <SessionStrip {...props} />}

      <Box sx={{ bgcolor: colors.card, boxShadow: shadows.card, borderRadius: 2, p: 2 }}>
        {/* Month header. */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <IconButton
            size="small"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="Previous month"
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 22 }}>
            {month.getFullYear()}年 {MONTHS[month.getMonth()]}月
          </Typography>
          <IconButton
            size="small"
            onClick={() => setMonthOffset((m) => Math.min(1, m + 1))}
            aria-label="Next month"
            disabled={monthOffset >= 1}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {HEAD.map((h) => (
            <Typography
              key={h}
              sx={{
                fontFamily: fonts.hanzi,
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              {h}
            </Typography>
          ))}
          {cells.map((d, i) => {
            if (!d) return <Box key={i} />;
            const key = dateKey(d);
            const n = ahead(d);
            const h = byDate.get(key);
            const isToday = n === 0;
            const future = n > 0;
            const due = future && n < forecast.length ? forecast[n] : null;
            const strength = h ? 0.2 + 0.8 * (h.reviews / max) : 0;
            return (
              <ButtonBase
                key={i}
                onClick={() => setPicked(key)}
                sx={{
                  aspectRatio: { xs: '1', md: '1.4' },
                  borderRadius: 1,
                  position: 'relative',
                  flexDirection: 'column',
                  fontFamily: 'inherit',
                  bgcolor: future ? colors.paper : h ? colors.primaryDark : colors.paper,
                  // The ink: one green at the day's strength.
                  ...(h && !future && { bgcolor: `rgba(26, 92, 64, ${strength})` }),
                  outline: isToday
                    ? `2px solid ${colors.primaryLight}`
                    : picked === key
                      ? `2px solid ${colors.text}`
                      : 'none',
                  outlineOffset: 1,
                }}
              >
                {loading ? (
                  <Skeleton variant="rounded" width="100%" height="100%" />
                ) : (
                  <>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 400,
                        color:
                          h && !future && strength > 0.5
                            ? colors.white
                            : future
                              ? colors.placeholder
                              : colors.text,
                      }}
                    >
                      {d.getDate()}
                    </Typography>
                    {due !== null && !empty && (
                      <Typography sx={{ fontSize: 10, color: colors.textSecondary, lineHeight: 1 }}>
                        {due}
                      </Typography>
                    )}
                  </>
                )}
              </ButtonBase>
            );
          })}
        </Box>

        {/* The picked day. */}
        <Box
          sx={{
            mt: 2,
            pt: 1.5,
            borderTop: `1px solid ${colors.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            {pickedAhead === 0
              ? 'Today'
              : pickedDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
          </Typography>
          <Typography color="text.secondary">{empty ? '—' : pickedLine}</Typography>
        </Box>
      </Box>

      {/* The month in two numbers. */}
      {!empty && !loading && !error && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          {[
            [monthReviews, 'reviews this month'],
            [monthPromoted, 'moved up a level'],
          ].map(([n, label]) => (
            <Box key={label} sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{n}</Typography>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Under a headline the chengyu has its own widget. */}
      {!props.bare && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderTop: `1px solid ${colors.divider}`,
            pt: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.1em' }}>
            今日成语
          </Typography>
          <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 24, letterSpacing: '0.1em' }}>
            {charSet === 'simp' ? daily.chengyu : daily.tradChengyu}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default VariantI;
