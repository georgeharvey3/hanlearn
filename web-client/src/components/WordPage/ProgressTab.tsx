import React from 'react';
import { Box } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import { copy } from '../../copy';
import { colors, levelInk } from '../../theme';
import { DIRECTIONS, Word, WordList } from '../../types/models';
import { BANK_LABELS, isLeech } from '../../utils/scheduling';
import { DIRECTION_LABELS } from '../../utils/directions';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';
import { listIdsOf } from '../../utils/wordBank';
import { Overline } from '../Test/Study/parts';

const LeechFlag: React.FC = () => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      fontSize: 12,
      fontWeight: 600,
      color: colors.warningText,
    }}
  >
    <WarningAmberRoundedIcon aria-hidden sx={{ fontSize: 14 }} />
    {copy.wordBank.leech}
  </Box>
);

/** Five segments, filled to the level in the level's ink. */
const LevelBar: React.FC<{ level: number }> = ({ level }) => (
  <Box role="img" aria-label={BANK_LABELS[level] ?? BANK_LABELS[1]} sx={{ display: 'flex', gap: '3px' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Box
        key={i}
        sx={{
          flex: 1,
          height: 10,
          borderRadius: '2px',
          bgcolor: i <= level ? levelInk[level - 1] : colors.blankDay,
        }}
      />
    ))}
  </Box>
);

/**
 * The Progress tab of the learner's word: its level and next due date, one
 * row for each direction, and the lists that hold it. All of it comes from
 * the word, with no read.
 */
const ProgressTab: React.FC<{ word: Word; lists: WordList[] }> = ({ word, lists }) => {
  const level = word.level ?? 1;
  const listIds = listIdsOf(word);
  const listNames = lists.filter((list) => listIds.includes(list.id)).map((list) => list.name);

  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5 }}>
        <Box sx={{ fontSize: 28, fontWeight: 700 }}>{BANK_LABELS[level] ?? BANK_LABELS[1]}</Box>
        {word.due_date && (
          <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
            {copy.wordPage.next(formatRelativeDueDate(word.due_date))}
          </Box>
        )}
      </Box>
      {DIRECTIONS.map((direction) => {
        const state = word.directions?.[direction];
        const dirLevel = state?.level ?? 1;
        const lapses = state?.lapses ?? 0;
        return (
          <Box
            key={direction}
            data-testid={`direction-${direction}`}
            sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{DIRECTION_LABELS[direction]}</Box>
              {isLeech(state?.lapses) && <LeechFlag />}
            </Box>
            <LevelBar level={dirLevel} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, fontSize: 13, color: colors.textSecondary }}>
              <span>{BANK_LABELS[dirLevel]}</span>
              {state?.dueDate && <span>{formatRelativeDueDate(state.dueDate)}</span>}
              {lapses > 0 && <span>{copy.wordPage.lapses(lapses)}</span>}
            </Box>
          </Box>
        );
      })}
      {listNames.length > 0 && (
        <Box sx={{ pt: 1.5, borderTop: `1px solid ${colors.divider}` }}>
          <Overline sx={{ mb: 0.5 }}>{copy.wordPage.lists}</Overline>
          <Box sx={{ fontSize: 14 }}>{listNames.join(', ')}</Box>
        </Box>
      )}
    </Box>
  );
};

export default ProgressTab;
