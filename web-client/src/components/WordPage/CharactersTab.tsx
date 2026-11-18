import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { colors } from '../../theme';
import { hanziSx } from '../Test/Study/parts';
import CharacterPanel from '../Characters/CharacterPanel';
import { ReadingsLoad } from './useCharacterReadings';
import { readingLine } from './readingLine';
import { sensesLine } from '../../utils/wordPage';

interface Props {
  chars: string[];
  index: number;
  onSelect: (index: number) => void;
  readingsAt: (index: number) => ReadingsLoad;
}

/**
 * The Characters tab: one character at a time, with its strokes and parts in
 * one panel, its reading in the word, and its other readings.
 */
const CharactersTab: React.FC<Props> = ({ chars, index, onSelect, readingsAt }) => {
  const char = chars[index];
  const load = readingsAt(index);
  const line = readingLine(load);
  const main = load && load !== 'failed' ? (load.inWord ?? load.others[0]) : undefined;
  const rest = load && load !== 'failed' ? load.others.filter((r) => r !== main) : [];

  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {chars.length > 1 && (
        <Box role="radiogroup" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
          {chars.map((c, i) => (
            <ButtonBase
              key={`${c}-${i}`}
              role="radio"
              aria-checked={i === index}
              aria-label={c}
              onClick={() => onSelect(i)}
              sx={{
                width: 52,
                height: 52,
                borderRadius: 1,
                bgcolor: colors.card,
                border: `2px solid ${i === index ? colors.primaryDark : colors.divider}`,
              }}
            >
              <Box lang="zh" sx={hanziSx(30)}>
                {c}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}
      <CharacterPanel key={`${char}-${index}`} char={char} />
      <Box sx={{ alignSelf: 'stretch', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {line.pinyin && (
          <Box lang="zh-Latn" sx={{ fontSize: 20, fontWeight: 600, color: colors.primaryDark }}>
            {line.pinyin}
          </Box>
        )}
        <Box sx={{ fontSize: 15, overflowWrap: 'anywhere' }}>
          {main ? sensesLine(main, 5) : line.senses}
        </Box>
        {rest.map((reading, i) => (
          <Box
            key={`${reading.pinyin}-${i}`}
            sx={{ fontSize: 13, color: colors.textSecondary, overflowWrap: 'anywhere' }}
          >
            <Box component="span" lang="zh-Latn" sx={{ fontWeight: 600 }}>
              {reading.pinyin}
            </Box>{' '}
            {sensesLine(reading)}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default CharactersTab;
