// PROTOTYPE (#403): what every Dashboard variant receives, the preview states
// the switcher forces, and the two small controls they share (the list menu
// and the session strip). Throwaway; lives on prototype/dashboard-403 only.
//
// The rule every variant keeps: no word of the learner's appears on the
// Dashboard. A word seen here just before the test asks it primes the answer,
// and in five directions every part of a word is some direction's answer.
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { DashboardStats } from '../../../services/dashboardService';
import { DIRECTIONS, Direction, Word, WordList } from '../../../types/models';
import { ListStats } from '../../../types/store';
import { BankCounts } from '../../../utils/directions';
import { colors } from '../../../theme';

/** One day of the learner's history, from `reviewStats`. */
export interface HistoryDay {
  /** YYYY-MM-DD, local. */
  date: string;
  /** Graded questions that day. */
  reviews: number;
  /** Questions that moved a direction up a level. */
  promoted: number;
  /** Per direction: reviews and first-try passes, for retention. */
  byDirection: Record<Direction, { reviews: number; passes: number }>;
}

export interface DashboardVariantProps {
  stats: DashboardStats | null;
  loading: boolean;
  error: boolean;
  /** "12 questions left", or null when there is nothing to resume. */
  resumeLabel: string | null;
  /** Counted only: the variants never show a word. */
  words: Word[];
  /** The last 120 days, oldest first. Days without a session are absent. */
  history: HistoryDay[];
  /** Words due on each of the next 14 days; index 0 is today and the overdue. */
  forecast: number[];
  charSet: 'simp' | 'trad';
  lists: WordList[];
  activeListId: string;
  listStats: Record<string, ListStats>;
  activeListName: string;
  onSwitchList: (listId: string) => void;
  onStart: () => void;
  onResume: () => void;
  onStartOver: () => void;
  onAddWords: () => void;
  onRetry: () => void;
}

export const prototypeStates = [
  { key: '', name: 'Normal' },
  { key: 'empty', name: 'Empty' },
  { key: 'resume', name: 'Resume' },
  { key: 'loading', name: 'Loading' },
  { key: 'error', name: 'Error' },
];

const emptyCounts = (): Record<Direction, BankCounts> =>
  DIRECTIONS.reduce(
    (acc, d) => {
      acc[d] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      return acc;
    },
    {} as Record<Direction, BankCounts>,
  );

export const emptyStats: DashboardStats = {
  totalWords: 0,
  dueWords: 0,
  streak: 0,
  levelDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  directionDistribution: emptyCounts(),
  masteredCount: 0,
  estimatedStudyTime: null,
  weeklyStats: { sessions: 0, wordsReviewed: 0 },
};

/**
 * A believable account, used when the signed-in one has no words, so Normal
 * and Resume can still be judged.
 */
export const sampleStats: DashboardStats = {
  totalWords: 214,
  dueWords: 23,
  streak: 6,
  levelDistribution: { 1: 31, 2: 58, 3: 64, 4: 39, 5: 22 },
  directionDistribution: {
    MC: { 1: 8, 2: 30, 3: 70, 4: 56, 5: 50 },
    MP: { 1: 12, 2: 41, 3: 72, 4: 51, 5: 38 },
    PM: { 1: 25, 2: 62, 3: 66, 4: 38, 5: 23 },
    PC: { 1: 20, 2: 55, 3: 70, 4: 41, 5: 28 },
    CM: { 1: 41, 2: 68, 3: 60, 4: 30, 5: 15 },
  },
  masteredCount: 22,
  estimatedStudyTime: '~9 min',
  weeklyStats: { sessions: 5, wordsReviewed: 118 },
};

export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A deterministic 120 days: most days studied, a few gaps, a quiet week. */
export const sampleHistory = (): HistoryDay[] => {
  const out: HistoryDay[] = [];
  const today = new Date();
  for (let i = 119; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const r = seed - Math.floor(seed);
    if (i > 0 && (r < 0.22 || (i > 40 && i < 47))) continue;
    const reviews = i === 0 ? 22 : Math.round(15 + r * 50);
    const byDirection = DIRECTIONS.reduce(
      (acc, dir, j) => {
        const n = Math.round(reviews / 5);
        const rate = [0.93, 0.9, 0.84, 0.88, 0.76][j];
        acc[dir] = { reviews: n, passes: Math.round(n * rate) };
        return acc;
      },
      {} as HistoryDay['byDirection'],
    );
    out.push({
      date: dateKey(d),
      reviews,
      promoted: Math.round(reviews * (0.25 + r * 0.2)),
      byDirection,
    });
  }
  return out;
};

export const sampleForecast = [23, 14, 19, 8, 31, 12, 9, 17, 6, 22, 11, 7, 15, 10];

/** The list name with a menu of the others. */
export const ListMenu: React.FC<
  Pick<DashboardVariantProps, 'lists' | 'activeListId' | 'activeListName' | 'onSwitchList'> & {
    color?: string;
  }
> = ({ lists, activeListId, activeListName, onSwitchList, color = colors.textSecondary }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        sx={{ color, px: 1, minWidth: 0 }}
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
    </>
  );
};

/**
 * Today's session in one line: what is due, or the session to resume. The tab
 * bar's Study button also starts it, so this stays one line.
 */
export const SessionStrip: React.FC<DashboardVariantProps> = (props) => {
  const {
    stats,
    loading,
    error,
    resumeLabel,
    words,
    onStart,
    onResume,
    onStartOver,
    onAddWords,
    onRetry,
  } = props;
  const empty = !loading && !error && words.length === 0;
  const due = stats?.dueWords ?? 0;

  let label: React.ReactNode;
  let action: { text: string; onClick: () => void } | null;
  if (loading) {
    label = '…';
    action = null;
  } else if (error) {
    label = 'Could not load';
    action = { text: 'Try again', onClick: onRetry };
  } else if (empty) {
    label = 'No words yet';
    action = { text: 'Add words', onClick: onAddWords };
  } else if (resumeLabel) {
    label = `Unfinished · ${resumeLabel}`;
    action = { text: 'Resume', onClick: onResume };
  } else if (due === 0) {
    label = 'Nothing due today';
    action = null;
  } else {
    label = (
      <>
        {due} due
        <Typography component="span" sx={{ color: colors.textSecondary, ml: 1 }}>
          {stats?.estimatedStudyTime}
        </Typography>
      </>
    );
    action = { text: 'Start', onClick: onStart };
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1,
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <ListMenu {...props} />
        <Typography sx={{ fontWeight: 700, fontSize: 18, px: 1 }}>{label}</Typography>
      </Box>
      {resumeLabel && !empty && !loading && !error && (
        <Button onClick={onStartOver} sx={{ color: colors.textSecondary }}>
          Start over
        </Button>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant="contained"
          sx={{
            bgcolor: colors.primaryDark,
            color: colors.white,
            px: 2.5,
            '&:hover': { bgcolor: colors.primaryDarkHover },
          }}
        >
          {action.text}
        </Button>
      )}
    </Box>
  );
};

/** The share of a direction's words at level 3 or above: one number per skill. */
export const strengthOf = (counts: BankCounts | undefined): number => {
  if (!counts) return 0;
  const total = [1, 2, 3, 4, 5].reduce((s, b) => s + (counts[b] ?? 0), 0);
  if (!total) return 0;
  return ((counts[3] ?? 0) + (counts[4] ?? 0) + (counts[5] ?? 0)) / total;
};
