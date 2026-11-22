import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { hanziSx } from '../Study/parts';
import { resultFill } from './resultColors';
import { SummaryRow } from './summary';

interface WordTileProps {
  row: SummaryRow;
  /** Turned to its back: the pinyin, the meaning and the direction asked. */
  turned: boolean;
  onClick: () => void;
  /** Opens the word page of the tile's word. Without it the back has no Details link. */
  onOpenWord?: (wordId: number) => void;
}

const DETAILS_HEIGHT = 26;

/**
 * One question of the session. The edge on top is its result; a tap turns it
 * over. The back links to the word page, below the button that turns it, so
 * the two controls are siblings and not one inside the other.
 */
const WordTile: React.FC<WordTileProps> = ({ row, turned, onClick, onOpenWord }) => {
  const result = copy.summary.results[row.result];
  const details = turned && onOpenWord && row.wordId !== undefined;
  return (
    <Box
      sx={{
        position: 'relative',
        height: 84,
        minWidth: 0,
        boxSizing: 'border-box',
        borderRadius: 1,
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderTop: `4px solid ${resultFill[row.result]}`,
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        onClick={onClick}
        aria-pressed={turned}
        aria-label={
          turned
            ? copy.summary.turnedTile(row.char, result, row.pinyin, row.meaning)
            : copy.summary.tile(row.char, result)
        }
        sx={{
          position: 'absolute',
          inset: 0,
          bottom: details ? DETAILS_HEIGHT : 0,
          px: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: details ? 0.25 : 0.5,
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
                WebkitLineClamp: details ? 1 : 2,
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
      {details && (
        <ButtonBase
          onClick={() => onOpenWord(row.wordId as number)}
          aria-label={copy.summary.details(row.char)}
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: DETAILS_HEIGHT,
            borderTop: `1px solid ${colors.divider}`,
            fontFamily: fonts.body,
            fontSize: 12,
            fontWeight: 600,
            color: colors.primaryDark,
          }}
        >
          {copy.summary.detailsLabel}
        </ButtonBase>
      )}
    </Box>
  );
};

export default WordTile;
