import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { copy } from '../../../copy';
import { colors, levelInk } from '../../../theme';
import { BANKS, BANK_LABELS } from '../../../utils/scheduling';
import { type HskLevelCoverage } from '../../../utils/hskCoverage';
import { Card } from './parts';

const text = copy.dashboard.hsk;

/** The ink of the words of an HSK level that are not in the collection. */
const NOT_ADDED = colors.blankDay;

export interface HskCoverageCardProps {
  coverage: HskLevelCoverage[];
  onOpen: (listId: string) => void;
}

/**
 * How the words of each HSK level split across the collection: one stacked
 * bar for each HSK level, not added first, then levels 1 to 5. Each bar spans
 * the words of its own HSK level, so all bars are the same length. It shows counts only, never
 * a word: a word seen here just before the test asks it primes the answer.
 */
const HskCoverageCard: React.FC<HskCoverageCardProps> = ({ coverage, onOpen }) => (
  <Card sx={{ p: 2 }}>
    <Box aria-hidden sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
      {[
        { key: 0, label: text.notAdded, ink: NOT_ADDED },
        ...BANKS.map((b) => ({ key: b, label: BANK_LABELS[b], ink: levelInk[b - 1] })),
      ].map((item) => (
        <Box
          key={item.key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '2px',
              bgcolor: item.ink,
              border: item.key === 0 ? `1px solid ${colors.divider}` : 'none',
            }}
          />
          {item.label}
        </Box>
      ))}
    </Box>
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column' }}>
      {coverage.map((row) => {
        const added = row.total - row.notAdded;
        const parts = [
          ...BANKS.map((b) => text.part(BANK_LABELS[b], row.levels[b] ?? 0)),
          text.part(text.notAdded, row.notAdded),
        ].join(', ');
        return (
          <ButtonBase
            key={row.listId}
            aria-label={text.row(row.name, added, row.total, parts)}
            onClick={() => onOpen(row.listId)}
            sx={{
              display: 'block',
              textAlign: 'left',
              py: 1,
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{row.name}</Typography>
              <Typography sx={{ fontSize: 13, color: colors.textSecondary }}>
                {text.count(added, row.total)}
              </Typography>
            </Box>
            <Box
              aria-hidden
              sx={{
                mt: 0.5,
                height: 10,
                borderRadius: 5,
                overflow: 'hidden',
                display: 'flex',
                gap: '2px',
              }}
            >
              {row.notAdded > 0 && <Box sx={{ flex: `${row.notAdded} 0 0`, bgcolor: NOT_ADDED }} />}
              {BANKS.filter((b) => (row.levels[b] ?? 0) > 0).map((b) => (
                <Box key={b} sx={{ flex: `${row.levels[b]} 0 0`, bgcolor: levelInk[b - 1] }} />
              ))}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  </Card>
);

export default HskCoverageCard;
