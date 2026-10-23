import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { DirectionResult } from '../../../types/models';
import { StudyCard } from '../Study/parts';
import { resultFill, resultInk, resultSurface } from './resultColors';
import { Tally } from './summary';

const RESULTS: DirectionResult[] = ['pass', 'lapse', 'fail'];

interface ScoreCardProps {
  tally: Tally;
  practiceMode: boolean;
  /** The result the tiles are filtered to, or null for all of them. */
  filter: DirectionResult | null;
  onFilter: (filter: DirectionResult | null) => void;
}

/** The score of the session: the known questions, a bar of the three results, and their counts. */
const ScoreCard: React.FC<ScoreCardProps> = ({ tally, practiceMode, filter, onFilter }) => (
  <StudyCard seal={false} sx={{ mt: 3, py: 3.5 }}>
    <Box data-testid="summary-score" sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
      <Box sx={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: colors.primaryDark }}>
        {tally.pass}
      </Box>
      <Box sx={{ fontSize: 24, color: colors.textSecondary }}>
        {copy.summary.outOf(tally.total)}
      </Box>
    </Box>
    <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
      {practiceMode
        ? copy.summary.practiceNote
        : copy.summary.questionsWords(tally.total, tally.words)}
    </Box>
    <Box
      aria-hidden="true"
      sx={{
        width: '100%',
        height: 10,
        mt: 1,
        borderRadius: 1,
        overflow: 'hidden',
        display: 'flex',
        bgcolor: colors.divider,
      }}
    >
      {RESULTS.map((r) =>
        tally[r] > 0 ? <Box key={r} sx={{ flex: tally[r], bgcolor: resultFill[r] }} /> : null,
      )}
    </Box>
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
      {RESULTS.map((r) => {
        const on = filter === r;
        return (
          <ButtonBase
            key={r}
            onClick={() => onFilter(on ? null : r)}
            aria-pressed={on}
            disabled={tally[r] === 0}
            sx={{
              height: 32,
              px: 1,
              mx: -1,
              borderRadius: 1,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              color: resultInk[r],
              bgcolor: on ? resultSurface[r] : 'transparent',
              border: `1px solid ${on ? resultFill[r] : 'transparent'}`,
              '&.Mui-disabled': { color: resultInk[r], opacity: 0.5 },
            }}
          >
            {copy.summary.count(tally[r], copy.summary.results[r])}
          </ButtonBase>
        );
      })}
    </Box>
  </StudyCard>
);

export default ScoreCard;
