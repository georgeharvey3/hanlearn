import React, { useState } from 'react';
import { Box, ButtonBase, CircularProgress } from '@mui/material';

import { copy } from '../../../copy';
import { BreakdownPart } from '../../../services/breakdownService';
import { colors, fonts, partInk } from '../../../theme';
import { useBreakdown } from './useBreakdown';

/** The size of the character drawn in place, in pixels. */
const CHAR_SIZE = 168;

/**
 * The width, in the 1024-unit stroke space, of the invisible line around each
 * stroke outline that takes the tap. A thin stroke such as a dot is 40 to 60
 * units wide, and at CHAR_SIZE that is under 10 pixels: too thin for a thumb.
 * The line adds 50 units on each side.
 */
const HIT_WIDTH = 100;

const inkOf = (index: number) => partInk[index % partInk.length];

/** Hanzi Writer draws its strokes upside down in a 1024 box, with the baseline at 900. */
const Strokes: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden="true">
    <g transform="translate(0, 900) scale(1, -1)">{children}</g>
  </svg>
);

const PartLine: React.FC<{ part: BreakdownPart }> = ({ part }) => (
  <Box
    data-testid="part-line"
    aria-live="polite"
    sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 1, fontSize: 14 }}
  >
    <Box sx={{ color: part.l ? colors.text : colors.textSecondary, fontWeight: 600 }}>
      {part.l ?? copy.test.noPartName}
    </Box>
    {part.y && (
      <Box lang="zh-Latn" sx={{ color: colors.primaryDark, fontWeight: 600 }}>
        {part.y}
      </Box>
    )}
    {part.r && (
      <Box
        sx={{
          fontSize: 12,
          px: 0.75,
          borderRadius: 0.5,
          border: `1px solid ${colors.borderStrong}`,
          color: colors.textSecondary,
        }}
      >
        {part.r === 'meaning' ? copy.test.meaningClue : copy.test.soundClue}
      </Box>
    )}
  </Box>
);

/**
 * One missed character, drawn large and in place, split into its parts in up
 * to 4 inks (#529). A tap on a part, on the character or on its chip, shows
 * one line under it: the label, the pinyin, and the clue. Only the line of
 * the last part tapped shows.
 */
const CharacterBreakdown: React.FC<{ char: string }> = ({ char }) => {
  const [load, retry] = useBreakdown(char);
  const [selected, setSelected] = useState<number | null>(null);
  const note = { fontSize: 13, color: colors.textSecondary };

  if (load.status === 'loading') {
    return <CircularProgress size={14} aria-label={copy.test.componentsLoading(char)} />;
  }
  if (load.status === 'failed') {
    return (
      <Box sx={{ ...note, display: 'flex', alignItems: 'center', gap: 1 }}>
        {copy.test.componentsFailed}
        <ButtonBase
          onClick={retry}
          sx={{ fontFamily: fonts.body, fontSize: 13, fontWeight: 600, color: colors.primaryDark }}
        >
          {copy.test.retry}
        </ButtonBase>
      </Box>
    );
  }

  const parts = load.breakdown.p;
  if (!parts || parts.length === 0) return <Box sx={note}>{copy.test.noComponents}</Box>;

  const { strokes } = load;
  const partOfStroke = new Map<number, number>();
  parts.forEach((part, index) => part.s.forEach((stroke) => partOfStroke.set(stroke, index)));
  const inkOfStroke = (stroke: number) => {
    const part = partOfStroke.get(stroke);
    return part === undefined ? colors.text : inkOf(part);
  };

  return (
    <Box
      data-testid={`breakdown-${char}`}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}
    >
      <Strokes size={CHAR_SIZE}>
        {strokes.map((d, stroke) => (
          <path key={stroke} d={d} fill={inkOfStroke(stroke)} />
        ))}
        {strokes.map((d, stroke) => {
          const part = partOfStroke.get(stroke);
          if (part === undefined) return null;
          return (
            <path
              key={`hit-${stroke}`}
              data-testid="stroke-hit"
              d={d}
              fill="transparent"
              stroke="transparent"
              strokeWidth={HIT_WIDTH}
              strokeLinejoin="round"
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(part)}
            />
          );
        })}
      </Strokes>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        {parts.map((part, index) => (
          <ButtonBase
            key={index}
            aria-label={part.c ?? copy.test.noPartName}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              border: `2px solid ${selected === index ? inkOf(index) : colors.divider}`,
              bgcolor: colors.card,
            }}
          >
            <Strokes size={32}>
              {part.s.map((stroke) => (
                <path key={stroke} d={strokes[stroke]} fill={inkOf(index)} />
              ))}
            </Strokes>
          </ButtonBase>
        ))}
      </Box>
      {selected !== null && parts[selected] && <PartLine part={parts[selected]} />}
    </Box>
  );
};

export default CharacterBreakdown;
