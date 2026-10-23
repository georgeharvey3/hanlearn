// PROTOTYPE (#403): what every Dashboard variant receives, and the preview
// states the switcher forces. Throwaway; lives on prototype/dashboard-403 only.
import React from 'react';
import Box from '@mui/material/Box';

import { DashboardStats } from '../../../services/dashboardService';
import { WordList } from '../../../types/models';
import { ListStats } from '../../../types/store';
import { DIRECTIONS, Direction } from '../../../types/models';
import { BankCounts } from '../../../utils/directions';
import { colors } from '../../../theme';

export interface DashboardVariantProps {
  stats: DashboardStats | null;
  loading: boolean;
  error: boolean;
  /** "12 questions left", or null when there is nothing to resume. */
  resumeLabel: string | null;
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
    CM: { 1: 31, 2: 58, 3: 64, 4: 39, 5: 22 },
  },
  masteredCount: 22,
  estimatedStudyTime: '~9 min',
  weeklyStats: { sessions: 5, wordsReviewed: 118 },
};

/** Short names for a direction, where the full "Character → Meaning" is too long. */
export const DIRECTION_SHORT: Record<Direction, { from: string; to: string }> = {
  MC: { from: '字', to: 'meaning' },
  MP: { from: 'pīn', to: 'meaning' },
  PM: { from: 'meaning', to: 'pīn' },
  PC: { from: '字', to: 'pīn' },
  CM: { from: 'meaning', to: '字' },
};

/** The share of a direction's words at level 3 or above: one number per skill. */
export const strengthOf = (counts: BankCounts | undefined): number => {
  if (!counts) return 0;
  const total = [1, 2, 3, 4, 5].reduce((s, b) => s + (counts[b] ?? 0), 0);
  if (!total) return 0;
  return ((counts[3] ?? 0) + (counts[4] ?? 0) + (counts[5] ?? 0)) / total;
};

const bankOpacity: Record<number, number> = { 1: 0.14, 2: 0.32, 3: 0.52, 4: 0.75, 5: 1 };

/** A thin stacked bar of the five banks, pale (new) to full ink (mastered). */
export const BankBar: React.FC<{
  counts: BankCounts | undefined;
  height?: number;
  color?: string;
}> = ({ counts, height = 8, color = colors.primaryDark }) => {
  const total = [1, 2, 3, 4, 5].reduce((s, b) => s + (counts?.[b] ?? 0), 0);
  return (
    <Box
      sx={{
        display: 'flex',
        height,
        borderRadius: height,
        overflow: 'hidden',
        bgcolor: colors.outline,
      }}
    >
      {total > 0 &&
        [1, 2, 3, 4, 5].map((b) => (
          <Box
            key={b}
            sx={{
              flex: `${counts?.[b] ?? 0} 0 0`,
              bgcolor: color,
              opacity: bankOpacity[b],
            }}
          />
        ))}
    </Box>
  );
};
