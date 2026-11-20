import React, { useState } from 'react';
import { Box, ButtonBase, CircularProgress } from '@mui/material';

import { copy } from '../../copy';
import { BreakdownPart, Origin } from '../../services/breakdownService';
import { colors, fonts, partInk } from '../../theme';
import { useBreakdown } from './useBreakdown';
import ReportPartButton from './ReportPartButton';

import { CHAR_SIZE } from './size';

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

/**
 * The line of the tapped part. `char` is the top character, whose strokes
 * `part.s` counts in, and `parent` the character directly above the part.
 */
const PartLine: React.FC<{ char: string; parent: string; part: BreakdownPart }> = ({
  char,
  parent,
  part,
}) => (
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
    {!part.p && <Box sx={{ color: colors.textSecondary }}>{copy.test.smallestPart}</Box>}
    <ReportPartButton report={{ char, parent, part: part.c, strokes: part.s, label: part.l }} />
  </Box>
);

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

/**
 * Where the learner is in the breakdown: the indices of the parts tapped on
 * the way down from the top character. An empty path is the whole character.
 */
type Path = number[];

/** The part at the end of `path`, or the top character for an empty path. */
const nodeAt = (top: BreakdownPart, path: Path): BreakdownPart =>
  path.reduce((node, index) => node.p![index], top);

/**
 * The path a tap on `stroke` leads to. The tap goes to the part that holds the
 * stroke at the first step where it leaves `path`: on a faded part, that is a
 * jump to it. A tap inside the focus goes one step down. Null for a stroke in
 * no part, and for a tap on the focus when it does not split.
 */
const pathOfStroke = (top: BreakdownPart, path: Path, stroke: number): Path | null => {
  for (let depth = 0; depth <= path.length; depth++) {
    const node = nodeAt(top, path.slice(0, depth));
    const index = node.p?.findIndex((part) => part.s.includes(stroke)) ?? -1;
    if (index === -1) return null;
    if (depth === path.length || index !== path[depth]) return [...path.slice(0, depth), index];
  }
  return null;
};

/**
 * One missed character, drawn large and in place, split into its parts in up
 * to 4 inks (#529). A tap on a part, on the character or on its chip, shows
 * one line under it: the label and the pinyin. Only the line of the last
 * part tapped shows. The origin line sits under the chips (#569).
 *
 * A tapped part that splits shows its own parts in the inks, and the rest of
 * the character fades (#530). A tap on a faded part jumps to it. A part that
 * does not split stays in its ink among the faded rest of the character.
 */
const CharacterBreakdown: React.FC<{ char: string }> = ({ char }) => {
  const [load, retry] = useBreakdown(char);
  const [path, setPath] = useState<Path>([]);
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

  if (!load.breakdown.p || load.breakdown.p.length === 0) {
    return <Box sx={note}>{copy.test.noComponents}</Box>;
  }

  const { strokes } = load;
  const top: BreakdownPart = { c: char, s: strokes.map((_, i) => i), l: null, p: load.breakdown.p };
  const focus = nodeAt(top, path);
  // The level whose parts the chips show: the focus when it splits, or else
  // the part above it, so the chips of its siblings stay.
  const levelPath = focus.p ? path : path.slice(0, -1);
  const level = nodeAt(top, levelPath);
  const parts = level.p!;
  // The index of the focus among the chips, when the focus does not split.
  const leaf = focus.p ? null : path[path.length - 1];
  const lit = (index: number) => leaf === null || leaf === index;

  const partOfStroke = new Map<number, number>();
  parts.forEach((part, index) => part.s.forEach((stroke) => partOfStroke.set(stroke, index)));
  /** The ink of a stroke, or null when it fades. */
  const inkOfStroke = (stroke: number): string | null => {
    const part = partOfStroke.get(stroke);
    if (part !== undefined && lit(part)) return inkOf(part);
    return path.length > 0 ? null : colors.text;
  };
  const tapStroke = (stroke: number) => {
    const next = pathOfStroke(top, path, stroke);
    if (next) setPath(next);
  };

  const link = { fontFamily: fonts.body, fontSize: 13, fontWeight: 600, color: colors.primaryDark };
  const parent = path.length > 0 ? nodeAt(top, path.slice(0, -1)) : null;

  return (
    <Box
      data-testid={`breakdown-${char}`}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}
    >
      <Strokes size={CHAR_SIZE}>
        {strokes.map((d, stroke) => (
          <path
            key={stroke}
            data-testid={inkOfStroke(stroke) === null ? 'stroke-faded' : undefined}
            d={d}
            fill={inkOfStroke(stroke) ?? colors.divider}
          />
        ))}
        {/* Two tap layers. The wide halos lie under the exact outlines, so a
            tap on a stroke itself always selects its own part, and a halo
            only takes a tap in the gap between strokes. */}
        {(['halo', 'core'] as const).map((layer) =>
          strokes.map((d, stroke) => {
            if (!pathOfStroke(top, path, stroke) && !partOfStroke.has(stroke)) return null;
            return (
              <path
                key={`${layer}-${stroke}`}
                data-testid={layer === 'halo' ? 'stroke-hit' : undefined}
                d={d}
                fill="transparent"
                stroke={layer === 'halo' ? 'transparent' : 'none'}
                strokeWidth={layer === 'halo' ? HIT_WIDTH : undefined}
                strokeLinejoin="round"
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
                onClick={() => tapStroke(stroke)}
              />
            );
          }),
        )}
      </Strokes>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        {parts.map((part, index) => (
          <ButtonBase
            key={`${levelPath.join('.')}-${index}`}
            aria-label={part.c ?? copy.test.noPartName}
            aria-pressed={leaf === index}
            onClick={() => setPath([...levelPath, index])}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              border: `2px solid ${leaf === index ? inkOf(index) : colors.divider}`,
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
      {load.breakdown.o && <OriginLine origin={load.breakdown.o} parts={top.p!} />}
      {/* The key starts the report of each part unsent. */}
      {parent && (
        <PartLine key={path.join('.')} char={char} parent={parent.c ?? char} part={focus} />
      )}
      {parent && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <ButtonBase onClick={() => setPath(path.slice(0, -1))} sx={link}>
            {copy.test.backTo(parent.c ?? copy.test.noPartName)}
          </ButtonBase>
          {path.length > 1 && (
            <ButtonBase onClick={() => setPath([])} sx={link}>
              {copy.test.startAgain}
            </ButtonBase>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CharacterBreakdown;
