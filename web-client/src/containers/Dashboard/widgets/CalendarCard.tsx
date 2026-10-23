import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { copy } from '../../../copy';
import { colors, fonts, levelInk } from '../../../theme';
import { CalendarDay, HISTORY_DAYS, calendarMonth } from '../../../utils/dashboard';
import { dayKey, type ReviewStatsDay } from '../../../utils/retention';
import { Card, Figure } from './parts';

const text = copy.dashboard.calendar;

/**
 * The ink of a studied day, darker for more questions, after Anki's review
 * heatmap. The steps are counts of questions, so a day reads the same in every
 * month.
 */
function ink(reviewed: number): { bg: string; fg: string } {
  if (reviewed === 0) return { bg: colors.blankDay, fg: colors.textSecondary };
  if (reviewed < 30) return { bg: '#d5e4da', fg: colors.primaryDark };
  if (reviewed < 40) return { bg: levelInk[1], fg: '#10301f' };
  if (reviewed < 50) return { bg: levelInk[3], fg: colors.white };
  return { bg: colors.primaryDark, fg: colors.white };
}

/** What one day did, or what it holds ahead, in a line. */
function dayLine(cell: CalendarDay): string {
  if (cell.isToday) return text.reviewedAndDue(cell.reviewed, cell.due ?? 0);
  if (cell.future) return cell.due === null ? '' : text.due(cell.due);
  return cell.reviewed ? text.reviewedAndUp(cell.reviewed, cell.promoted) : text.noStudy;
}

/** The months back the history covers, so the arrows stop where it ends. */
const MONTHS_BACK = Math.floor(HISTORY_DAYS / 31);

export interface CalendarCardProps {
  loading: boolean;
  history: ReviewStatsDay[];
  forecast: number[];
}

/** One month: the past inked by the reviews done, and the days ahead with the questions due. */
const CalendarCard: React.FC<CalendarCardProps> = ({ loading, history, forecast }) => {
  const now = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(dayKey(now));

  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  // A month picks today when it holds it, else its 1st, so the line below the
  // grid always reads a day on screen.
  const showMonth = (next: number) => {
    setOffset(next);
    const first = new Date(now.getFullYear(), now.getMonth() + next, 1);
    setPicked(next === 0 ? dayKey(now) : dayKey(first));
  };
  const month = useMemo(
    () => calendarMonth(shown, history, forecast, now),
    // `shown` is derived from `offset`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offset, history, forecast, now],
  );
  const pickedCell = month.cells.find((c) => c.date === picked);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton
            aria-label={text.previous}
            disabled={offset <= -MONTHS_BACK}
            onClick={() => showMonth(offset - 1)}
            sx={{ width: 44, height: 44, color: colors.textSecondary }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography
            component="h3"
            lang="zh"
            sx={{ m: 0, fontFamily: fonts.hanzi, fontSize: 24, fontWeight: 500 }}
          >
            {text.month(shown.getFullYear(), shown.getMonth())}
          </Typography>
          <IconButton
            aria-label={text.next}
            disabled={offset >= 1}
            onClick={() => showMonth(offset + 1)}
            sx={{ width: 44, height: 44, color: colors.textSecondary }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box
          lang="zh"
          aria-hidden
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '6px',
            textAlign: 'center',
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {text.weekdays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </Box>

        <Box
          sx={{
            mt: '6px',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '6px',
          }}
        >
          {Array.from({ length: month.lead }, (_, i) => (
            <Box key={`lead-${i}`} />
          ))}
          {month.cells.map((cell) => {
            const shade = loading || cell.future ? ink(0) : ink(cell.reviewed);
            const outline = loading
              ? 'none'
              : cell.isToday
                ? `2px solid ${colors.primaryLight}`
                : cell.date === picked
                  ? `2px solid ${colors.text}`
                  : 'none';
            return (
              <ButtonBase
                key={cell.date}
                aria-pressed={cell.date === picked}
                aria-label={text.dayAria(copy.dashboard.weekdayDate(cell.date), dayLine(cell))}
                onClick={() => setPicked(cell.date)}
                sx={{
                  height: { xs: 44, md: 52 },
                  borderRadius: 1,
                  flexDirection: 'column',
                  gap: '1px',
                  fontFamily: 'inherit',
                  bgcolor: loading ? colors.skeleton : shade.bg,
                  color: loading ? 'transparent' : shade.fg,
                  outline,
                  outlineOffset: -2,
                }}
              >
                <Typography component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
                  {cell.day}
                </Typography>
                {!loading && cell.future && cell.due !== null && cell.due > 0 && (
                  <Typography component="span" sx={{ fontSize: 10, lineHeight: 1 }}>
                    {cell.due}
                  </Typography>
                )}
              </ButtonBase>
            );
          })}
        </Box>

        <Box
          sx={{
            mt: 2,
            pt: 1.5,
            borderTop: `1px solid ${colors.divider}`,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
            {pickedCell?.isToday ? text.today : copy.dashboard.weekdayDate(picked)}
          </Typography>
          <Typography sx={{ fontSize: 15, color: colors.textSecondary }}>
            {loading || !pickedCell ? '' : dayLine(pickedCell)}
          </Typography>
        </Box>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
        <Figure value={loading ? copy.dashboard.none : month.reviews} label={text.monthReviews} />
        <Figure value={loading ? copy.dashboard.none : month.promoted} label={text.monthPromoted} />
      </Box>
    </Box>
  );
};

export default CalendarCard;
