import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { hanziSx } from '../Study/parts';
import { resultFill } from './resultColors';
import { SummaryRow } from './summary';

interface WordTileProps {
  row: SummaryRow;
  /** Turned to its back: the pinyin, the meaning and the direction asked. */
  turned: boolean;
  onClick: () => void;
}

/** One question of the session. The edge on top is its result; a tap turns it over. */
const WordTile: React.FC<WordTileProps> = ({ row, turned, onClick }) => {
  const result = copy.summary.results[row.result];
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={turned}
      aria-label={
        turned
          ? copy.summary.turnedTile(row.char, result, row.pinyin, row.meaning)
          : copy.summary.tile(row.char, result)
      }
      sx={{
        height: 84,
        minWidth: 0,
        boxSizing: 'border-box',
        px: 1,
        borderRadius: 1,
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderTop: `4px solid ${resultFill[row.result]}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        overflow: 'hidden',
        textAlign: 'center',
        color: colors.text,
      }}
    >
      {turned ? (
        <>
          <Box lang="zh-Latn" sx={{ fontSize: 14 }}>
            {row.pinyin}
          </Box>
          <Box
            sx={{
              fontSize: 12,
              lineHeight: 1.2,
              color: colors.textSecondary,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {row.meaning}
          </Box>
          <Box sx={{ fontSize: 10, color: colors.textSecondary }}>
            {DIRECTION_LABELS[row.direction]}
          </Box>
        </>
      ) : (
        <Box lang="zh" sx={hanziSx(row.char.length > 2 ? 22 : 30)}>
          {row.char}
        </Box>
      )}
    </ButtonBase>
  );
};

export default WordTile;
