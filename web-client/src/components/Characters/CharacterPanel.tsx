import React, { useEffect, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import { copy } from '../../copy';
import { colors, fonts, partInk } from '../../theme';
import { loadCharData } from '../../utils/charDataLoader';
import { Point, animationLength, strokeTimings } from '../../utils/strokeAnimation';
import { reportError } from '../../services/errorReporting';
import { hanziSx } from '../Test/Study/parts';
import CharacterBreakdown from './CharacterBreakdown';
import OriginLine from './OriginLine';
import { CHAR_SIZE } from './size';
import { useBreakdown } from './useBreakdown';

/** The outlines and the medians of the strokes, from the Hanzi Writer data. */
interface StrokeData {
  strokes: string[];
  medians: Point[][];
}

const strokeDataOf = (char: string) =>
  new Promise<StrokeData>((resolve, reject) =>
    loadCharData(char, (data) => resolve(data as StrokeData), reject),
  );

/** The width of the brush that the animation draws each median with. */
const BRUSH = 200;

/**
 * The character in plain SVG, each stroke in its ink. With `play`, each
 * stroke is brushed in order along its median, clipped to its outline, the
 * way Hanzi Writer draws. Both views of the panel use this one animation, so
 * the strokes animate in the inks of the view.
 */
const InkCharacter: React.FC<{
  id: string;
  data: StrokeData;
  inkOf: (stroke: number) => string;
  play: number;
}> = ({ id, data, inkOf, play }) => {
  const timings = strokeTimings(data.medians);
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={CHAR_SIZE}
      height={CHAR_SIZE}
      aria-hidden="true"
      data-testid="ink-character"
    >
      <style>{`@keyframes ${id}-brush { to { stroke-dashoffset: 0; } }`}</style>
      {/* Hanzi Writer draws its strokes upside down in a 1024 box, with the baseline at 900. */}
      <g transform="translate(0, 900) scale(1, -1)">
        {play === 0
          ? data.strokes.map((d, i) => <path key={i} d={d} fill={inkOf(i)} />)
          : data.strokes.map((d, i) => (
              <g key={`${play}-${i}`}>
                <path d={d} fill={colors.outline} />
                <clipPath id={`${id}-clip-${i}`}>
                  <path d={d} />
                </clipPath>
                <polyline
                  clipPath={`url(#${id}-clip-${i})`}
                  points={data.medians[i].map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke={inkOf(i)}
                  strokeWidth={BRUSH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={timings[i].length + BRUSH}
                  strokeDashoffset={timings[i].length + BRUSH}
                  style={{
                    animation: `${id}-brush ${timings[i].duration}ms linear ${timings[i].delay}ms forwards`,
                  }}
                />
              </g>
            ))}
      </g>
    </svg>
  );
};

/** A labelled on/off switch. */
const ViewSwitch: React.FC<{ label: string; on: boolean; onChange: (on: boolean) => void }> = ({
  label,
  on,
  onChange,
}) => (
  <ButtonBase
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    sx={{
      height: 44,
      px: 1,
      gap: 1,
      borderRadius: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: 600,
      color: colors.text,
    }}
  >
    {label}
    <Box
      component="span"
      sx={{
        width: 34,
        height: 20,
        boxSizing: 'border-box',
        p: '2px',
        borderRadius: '10px',
        bgcolor: on ? colors.primaryDark : colors.borderStrong,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        component="span"
        sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: colors.white }}
      />
    </Box>
  </ButtonBase>
);

/**
 * The strokes and the parts of one character in one panel (#562).
 *
 * "Composition" picks the view: the parts in their inks, which take a tap as
 * in the reveal after a CM lapse, or the character in one ink. "Animate" draws
 * the strokes in order in the inks of that view, then shows the view at rest
 * again. The parts take no tap while the strokes draw. A character with no
 * breakdown has no switch: it is always in one ink. The origin shows in both
 * views (#569): under the parts, or in plain text under the one ink.
 */
const CharacterPanel: React.FC<{ char: string }> = ({ char }) => {
  const [load] = useBreakdown(char);
  const parts =
    load.status === 'done' && load.breakdown.p && load.breakdown.p.length > 0
      ? load.breakdown.p
      : null;
  const [composition, setComposition] = useState(true);
  const [data, setData] = useState<StrokeData | null>(null);
  const [play, setPlay] = useState(0);
  const [animating, setAnimating] = useState(false);
  const id = `panel-${char.codePointAt(0)!.toString(16)}`;

  useEffect(() => {
    // The panel takes a key by its character, so a new character starts with no data.
    let cancelled = false;
    strokeDataOf(char)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((error) => reportError(error, { feature: 'hanzi-writer', context: { char } }));
    return () => {
      cancelled = true;
    };
  }, [char]);

  useEffect(() => {
    if (!animating || !data) return undefined;
    const timer = setTimeout(() => setAnimating(false), animationLength(data.medians));
    return () => clearTimeout(timer);
  }, [animating, data, play]);

  const showParts = composition && parts !== null;
  const partOf = new Map<number, number>();
  parts?.forEach((part, index) => part.s.forEach((stroke) => partOf.set(stroke, index)));
  const inkOf = (stroke: number) =>
    showParts ? partInk[(partOf.get(stroke) ?? 0) % partInk.length] : colors.text;

  const animate = () => {
    setPlay((n) => n + 1);
    setAnimating(true);
  };

  // The ink view, and the animation in either view, draw over the place of
  // the breakdown character, which is the first thing in its column.
  const inkShown = data !== null && (animating || !showParts);

  return (
    <Box
      data-testid={`character-panel-${char}`}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
    >
      <Box sx={{ position: 'relative', minWidth: CHAR_SIZE, minHeight: CHAR_SIZE }}>
        {showParts && (
          <Box sx={{ pointerEvents: animating ? 'none' : 'auto' }} aria-disabled={animating}>
            <CharacterBreakdown char={char} />
          </Box>
        )}
        {inkShown && (
          <Box
            sx={{
              position: showParts ? 'absolute' : 'static',
              top: 0,
              left: '50%',
              transform: showParts ? 'translateX(-50%)' : 'none',
              width: CHAR_SIZE,
              height: CHAR_SIZE,
              bgcolor: colors.paper,
            }}
          >
            <InkCharacter id={id} data={data} inkOf={inkOf} play={animating ? play : 0} />
          </Box>
        )}
        {/* The stroke data did not load, and there are no parts to show. */}
        {!showParts && data === null && load.status !== 'loading' && (
          <Box
            lang="zh"
            sx={hanziSx(CHAR_SIZE * 0.8, {
              width: CHAR_SIZE,
              height: CHAR_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {char}
          </Box>
        )}
      </Box>
      {!showParts && load.status === 'done' && load.breakdown.o && (
        <OriginLine origin={load.breakdown.o} parts={[]} />
      )}
      {parts && (
        <ViewSwitch label={copy.wordPage.composition} on={composition} onChange={setComposition} />
      )}
      <ButtonBase
        onClick={animate}
        disabled={animating || data === null}
        sx={{
          height: 44,
          px: 2,
          gap: 0.75,
          borderRadius: '22px',
          border: `1px solid ${colors.borderStrong}`,
          bgcolor: colors.card,
          fontFamily: fonts.body,
          fontSize: 14,
          fontWeight: 600,
          color: colors.text,
          '&.Mui-disabled': { color: colors.disabledText },
        }}
      >
        <PlayArrowRoundedIcon aria-hidden sx={{ fontSize: 18 }} />
        {copy.wordPage.animate}
      </ButtonBase>
    </Box>
  );
};

export default CharacterPanel;
