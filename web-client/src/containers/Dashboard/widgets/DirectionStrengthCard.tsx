import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import { colors } from '../../../theme';
import { DIRECTIONS, Direction } from '../../../types/models';
import { BankCounts, DIRECTION_LABELS } from '../../../utils/directions';
import { BANKS, BANK_LABELS } from '../../../utils/scheduling';

interface DirectionStrengthCardProps {
  /** Partial so the dashboard can render before the stats have loaded. */
  distribution: Partial<Record<Direction, BankCounts>>;
  totalWords: number;
}

/**
 * How dark each bank is drawn. A word the learner has not recalled yet is the
 * palest, and a mastered one is the full colour, so a bar that is mostly pale
 * reads as a weak skill without having to be counted.
 */
const bankOpacity: Record<number, number> = { 1: 0.18, 2: 0.36, 3: 0.55, 4: 0.75, 5: 1 };

/** "12 New, 31 Learning, …", the numbers a sighted learner reads off the bar. */
function describeCounts(counts: BankCounts): string {
  return BANKS.map((bank) => `${counts[bank] ?? 0} ${BANK_LABELS[bank]}`).join(', ');
}

/**
 * The strength of each of the five directions, as one stacked bar per direction.
 *
 * The word's own level is the lowest bank across its directions, so a single
 * level per word hides which skill is weak: a word can be strong for
 * recognition and weak for handwriting and still show as level 1. Every bar
 * covers every word, so the bars are the same length and the shapes compare
 * directly.
 */
const DirectionStrengthCard: React.FC<DirectionStrengthCardProps> = ({
  distribution,
  totalWords,
}) => (
  <Paper
    elevation={2}
    sx={{ p: 2, borderRadius: 2, height: '100%' }}
    role="region"
    aria-label="Strength by question type"
  >
    <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
      Strength by question type
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
      Every word is scheduled separately in each of the five question types. A short dark stretch is
      a skill that needs the work.
    </Typography>

    {totalWords === 0 ? (
      <Typography variant="body2" color="text.secondary">
        Add some words and their strength will show up here.
      </Typography>
    ) : (
      <>
        {DIRECTIONS.map((direction) => {
          const counts = distribution[direction] ?? {};
          return (
            <Box
              key={direction}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                gap: { xs: 0.25, sm: 1.5 },
                mb: 1.25,
              }}
            >
              <Typography variant="body2" sx={{ flex: { sm: '0 0 150px' }, fontWeight: 600 }}>
                {DIRECTION_LABELS[direction]}
              </Typography>
              <Box
                role="img"
                aria-label={`${DIRECTION_LABELS[direction]}: ${describeCounts(counts)}`}
                sx={{
                  display: 'flex',
                  flexGrow: 1,
                  width: '100%',
                  height: 16,
                  borderRadius: 1,
                  overflow: 'hidden',
                  backgroundColor: colors.divider,
                }}
              >
                {BANKS.map((bank) => {
                  const count = counts[bank] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Tooltip
                      key={bank}
                      title={`${BANK_LABELS[bank]}: ${count} ${count === 1 ? 'word' : 'words'}`}
                    >
                      <Box
                        // The width is inline rather than in `sx` because it is
                        // a different value for every learner, and a style rule
                        // per value is a class per value.
                        style={{ width: `${(count / totalWords) * 100}%` }}
                        sx={{
                          backgroundColor: colors.primaryDark,
                          opacity: bankOpacity[bank],
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}

        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}
          aria-hidden="true"
          data-testid="direction-strength-legend"
        >
          {BANKS.map((bank) => (
            <Box key={bank} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  backgroundColor: colors.primaryDark,
                  opacity: bankOpacity[bank],
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {BANK_LABELS[bank]}
              </Typography>
            </Box>
          ))}
        </Box>
      </>
    )}
  </Paper>
);

export default React.memo(DirectionStrengthCard);
