// PROTOTYPE (#403) variant D, "Practice sheet": today's session as a blank
// 田字格 sheet, one square for each character the session will ask. The words
// stay hidden, so the Dashboard never reminds the learner of a word just before
// the test asks it; the sheet shows only the session's size and shape. A
// resumed session fills in the words it has asked. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { colors, fonts, shadows } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { Word } from '../../../types/models';
import { DashboardVariantProps } from './dashboardShared';
import { daysUntil, isDue } from './dashboardWords';

export const name = 'Practice sheet';

const CELL = 52;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** One 田字格 square: a frame, a dashed cross, and maybe a character. */
const Cell: React.FC<{
  char?: string;
  ink?: string;
  frame?: string;
  faded?: boolean;
  pulse?: boolean;
}> = ({ char, ink = colors.text, frame = colors.gridLine, faded, pulse }) => (
  <Box
    sx={{
      position: 'relative',
      width: CELL,
      height: CELL,
      flex: '0 0 auto',
      border: `1.5px solid ${frame}`,
      ml: '-1.5px',
      '&:first-of-type': { ml: 0 },
      ...(pulse && {
        '@keyframes pulse': { '50%': { opacity: 0.35 } },
        animation: 'pulse 1.4s ease-in-out infinite',
      }),
    }}
  >
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke={frame} strokeDasharray="3 3" />
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke={frame} strokeDasharray="3 3" />
    </svg>
    {char && (
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.hanzi,
          fontSize: CELL * 0.72,
          lineHeight: 1,
          color: ink,
          opacity: faded ? 0.28 : 1,
        }}
      >
        {char}
      </Typography>
    )}
  </Box>
);

const WordCells: React.FC<{ text: string; faded?: boolean; done?: boolean; ink?: string }> = ({
  text,
  faded,
  done,
  ink,
}) => (
  <Box sx={{ position: 'relative', display: 'flex', opacity: faded ? 0.45 : 1 }}>
    {Array.from(text).map((_, i) => (
      // The squares, never the characters: a due word must not show.
      <Box
        key={i}
        sx={{ bgcolor: done ? colors.successSurface : 'transparent', ml: i ? '-1.5px' : 0 }}
      >
        <Cell ink={ink} frame={done ? colors.primaryDark : undefined} />
      </Box>
    ))}
    {done && (
      // A small red tick stamped over a word the session already asked.
      <Box
        sx={{
          position: 'absolute',
          right: -6,
          top: -6,
          width: 20,
          height: 20,
          borderRadius: '50%',
          bgcolor: colors.primaryDark,
          color: colors.white,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
      >
        ✓
      </Box>
    )}
  </Box>
);

const VariantD: React.FC<DashboardVariantProps> = ({
  words,
  charSet,
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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [chengyuOpen, setChengyuOpen] = useState(false);
  const daily = useMemo(() => getDailyChengyu(), []);
  const today = new Date();
  const text = (w: Word) => (charSet === 'simp' ? w.simp : w.trad);

  const empty = !loading && !error && words.length === 0;
  const due = useMemo(() => words.filter((w) => isDue(w)), [words]);
  const tomorrow = useMemo(() => words.filter((w) => daysUntil(w) === 1), [words]);
  const showingTomorrow = !empty && due.length === 0;
  const sheet = (showingTomorrow ? tomorrow : due).slice(0, 18);
  const more = (showingTomorrow ? tomorrow : due).length - sheet.length;
  // Prototype: a resumed session has asked about the first third.
  const doneCount = resumeLabel ? Math.ceil(sheet.length / 3) : 0;

  let primary: { label: string; onClick: () => void };
  if (empty) primary = { label: 'Add words', onClick: onAddWords };
  else if (resumeLabel) primary = { label: 'Resume', onClick: onResume };
  else if (showingTomorrow) primary = { label: 'Practise anyway', onClick: onStart };
  else primary = { label: 'Start', onClick: onStart };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 560,
        mx: 'auto',
        pb: 24,
        textAlign: 'left',
      }}
    >
      {/* The sheet's header: the date, written as a Chinese exercise book would. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 22 }}>
          {today.getMonth() + 1}月{today.getDate()}日
          <Typography
            component="span"
            sx={{ fontFamily: fonts.hanzi, ml: 1.5, color: colors.textSecondary }}
          >
            星期{WEEKDAYS[today.getDay()]}
          </Typography>
        </Typography>
        <Button
          onClick={(e) => setAnchor(e.currentTarget)}
          endIcon={<ExpandMoreIcon />}
          sx={{ color: colors.textSecondary }}
        >
          {activeListName}
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          {[{ id: '__all__', name: 'All lists' }, ...lists].map((l) => (
            <MenuItem
              key={l.id}
              selected={l.id === activeListId}
              onClick={() => {
                onSwitchList(l.id);
                setAnchor(null);
              }}
            >
              {l.name}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* The sheet. */}
      <Box
        sx={{
          bgcolor: colors.card,
          boxShadow: shadows.card,
          borderRadius: 1,
          px: 2,
          pt: 2,
          pb: 2.5,
          position: 'relative',
        }}
      >
        <Typography
          variant="caption"
          sx={{ display: 'block', mb: 1.5, color: colors.textSecondary, letterSpacing: '0.08em' }}
        >
          {loading
            ? ' '
            : error
              ? 'Could not load'
              : empty
                ? 'No words yet'
                : showingTomorrow
                  ? `Nothing due · tomorrow, ${tomorrow.length}`
                  : resumeLabel
                    ? `Today · ${resumeLabel}`
                    : `Today · ${due.length} words · ${stats?.estimatedStudyTime ?? ''}`}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px 12px', minHeight: CELL * 2 + 14 }}>
          {(loading || empty) &&
            Array.from({ length: 12 }, (_, i) => (
              <Box key={i} sx={{ display: 'flex' }}>
                <Cell pulse={loading} />
                <Cell pulse={loading} />
              </Box>
            ))}
          {error && (
            <Button onClick={onRetry} sx={{ color: colors.primaryDark }}>
              Try again
            </Button>
          )}
          {!loading &&
            !error &&
            sheet.map((w, i) => (
              <WordCells key={w.id} text={text(w)} faded={showingTomorrow} done={i < doneCount} />
            ))}
          {!loading && !error && more > 0 && (
            <Box
              sx={{
                height: CELL,
                display: 'flex',
                alignItems: 'center',
                color: colors.textSecondary,
              }}
            >
              +{more}
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          onClick={primary.onClick}
          disabled={loading || error}
          variant="contained"
          size="large"
          sx={{
            flex: 1,
            py: 1.5,
            fontSize: 17,
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

      {/* The chengyu: four red squares. */}
      <ButtonBase
        onClick={() => setChengyuOpen(true)}
        sx={{ alignSelf: 'center', flexDirection: 'column', gap: 1, mt: 2, p: 1 }}
      >
        <Box sx={{ display: 'flex' }}>
          {Array.from(
            (charSet === 'simp' ? daily.chengyu : daily.tradChengyu).replace(/[，,]/g, ''),
          ).map((c, i) => (
            <Cell key={i} char={c} ink={colors.primaryLight} frame={colors.primaryLight} />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {daily.pinyin}
        </Typography>
      </ButtonBase>

      <Dialog open={chengyuOpen} onClose={() => setChengyuOpen(false)} fullWidth maxWidth="sm">
        <ErrorBoundary>
          <Chengyu />
        </ErrorBoundary>
      </Dialog>
    </Box>
  );
};

export default VariantD;
