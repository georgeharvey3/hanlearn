import React from 'react';
import { Box } from '@mui/material';

import { copy } from '../../copy';
import { BreakdownPart, Origin } from '../../services/breakdownService';
import { colors, partInk } from '../../theme';

const inkOf = (index: number) => partInk[index % partInk.length];

/**
 * One character of the origin line. A character that is a part takes the ink
 * of the top part that holds its strokes, the ink it has in the whole
 * character. A character with no strokes matches no part: plain text.
 */
const OriginChar: React.FC<{ c: string; s?: number[]; parts: BreakdownPart[] }> = ({
  c,
  s,
  parts,
}) => {
  const index = s ? parts.findIndex((part) => part.s.includes(s[0])) : -1;
  if (index === -1) return <span lang="zh">{c}</span>;
  return (
    <Box
      component="span"
      lang="zh"
      data-testid="origin-part"
      sx={{ color: inkOf(index), fontWeight: 700 }}
    >
      {c}
    </Box>
  );
};

/**
 * The origin of the character (#569), at once and with no tap: a story, or
 * the meaning part and the sound part. The texts are data, not copy.
 * `parts` holds the top parts of the drawing in their inks. With no parts,
 * the drawing is in one ink, and every character is plain text.
 */
const OriginLine: React.FC<{ origin: Origin; parts: BreakdownPart[] }> = ({ origin, parts }) => {
  const sides: React.ReactNode[] = [];
  if (origin.m) {
    sides.push(
      <span key="m">
        {copy.test.originMeaning}: <OriginChar c={origin.m.c} s={origin.m.s} parts={parts} />
        {origin.m.l && ` ${origin.m.l}`}
      </span>,
    );
  }
  if (origin.n) {
    sides.push(
      <span key="n">
        {copy.test.originSound}: <OriginChar c={origin.n.c} s={origin.n.s} parts={parts} />
        {origin.n.y && (
          <Box component="span" lang="zh-Latn" sx={{ color: colors.primaryDark, fontWeight: 600 }}>
            {` ${origin.n.y}`}
          </Box>
        )}
      </span>,
    );
  }
  return (
    <Box
      data-testid="origin"
      sx={{ maxWidth: 360, textAlign: 'center', fontSize: 14, color: colors.text }}
    >
      <Box component="span" sx={{ fontWeight: 600, color: colors.textSecondary, mr: 1 }}>
        {copy.test.origin}
      </Box>
      {origin.t
        ? origin.t.map((segment, i) =>
            typeof segment === 'string' ? (
              segment
            ) : (
              <OriginChar key={i} c={segment.c} s={segment.s} parts={parts} />
            ),
          )
        : sides.flatMap((side, i) => (i > 0 ? [' · ', side] : [side]))}
    </Box>
  );
};

export default OriginLine;
