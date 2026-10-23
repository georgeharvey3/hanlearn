// A character drawn stroke by stroke from Hanzi Writer's stroke data, at a
// progress the caller sets, so the scroll can drive it.
import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

import { colors, fonts } from '../../../theme';
import { loadCharData } from '../../../utils/charDataLoader';

export interface CharStrokes {
  strokes: string[];
  medians: [number, number][][];
}

/** Loads Hanzi Writer's stroke data for each character, in order. */
export const useStrokeData = (chars: string[]) => {
  const [data, setData] = useState<(CharStrokes | null)[]>(() => chars.map(() => null));
  const key = chars.join('');
  useEffect(() => {
    let live = true;
    chars.forEach((c, i) =>
      loadCharData(
        c,
        (d) => {
          if (!live) return;
          setData((prev) => prev.map((x, j) => (j === i ? (d as CharStrokes) : x)));
        },
        () => undefined,
      ),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data;
};

const medianLength = (pts: [number, number][]) =>
  pts.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0),
    0,
  );

/**
 * One character, drawn stroke by stroke as `progress` goes 0 to 1: each
 * stroke's outline clips a thick line along its median, and the line's dash
 * grows. The same trick Hanzi Writer animates with, driven by scroll here.
 */
export const StrokeChar: React.FC<{
  char: string;
  data: CharStrokes | null;
  progress: number;
  id: string;
  size: number | string;
  ink?: string;
  grid?: boolean;
  /** The colour of a stroke not yet drawn; null hides it. */
  outlineColor?: string | null;
  /** The practice grid's guide lines and frame. */
  gridColor?: string;
  frameColor?: string;
}> = ({
  char,
  data,
  progress,
  id,
  size,
  ink = colors.text,
  grid = true,
  outlineColor = colors.outline,
  gridColor = colors.gridLine,
  frameColor = colors.outline,
}) => {
  const lengths = React.useMemo(() => data?.medians.map(medianLength) ?? [], [data]);
  const total = lengths.reduce((a, b) => a + b, 0);
  const drawn = progress * total;
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 1024 1024" width={size} height={size} aria-label={char} role="img">
        {grid && (
          <g stroke={gridColor} strokeWidth={4} strokeDasharray="16 14" fill="none">
            <rect
              x={2}
              y={2}
              width={1020}
              height={1020}
              strokeDasharray="none"
              stroke={frameColor}
              strokeWidth={6}
            />
            <line x1={0} y1={512} x2={1024} y2={512} />
            <line x1={512} y1={0} x2={512} y2={1024} />
            <line x1={0} y1={0} x2={1024} y2={1024} opacity={0.5} />
            <line x1={1024} y1={0} x2={0} y2={1024} opacity={0.5} />
          </g>
        )}
        {data ? (
          <g transform="translate(0, 900) scale(1, -1)">
            <defs>
              {data.strokes.map((s, i) => (
                <clipPath key={i} id={`${id}-c${i}`}>
                  <path d={s} />
                </clipPath>
              ))}
            </defs>
            {data.strokes.map(
              (s, i) => outlineColor && <path key={`o${i}`} d={s} fill={outlineColor} />,
            )}
            {data.medians.map((m, i) => {
              const len = lengths[i];
              const show = Math.min(len, Math.max(0, drawn - starts[i]));
              return (
                <polyline
                  key={`m${i}`}
                  clipPath={`url(#${id}-c${i})`}
                  points={m.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={ink}
                  strokeWidth={200}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${len + 1} ${len + 400}`}
                  strokeDashoffset={len + 1 - show}
                  opacity={show > 0 ? 1 : 0}
                />
              );
            })}
          </g>
        ) : (
          <text
            x={512}
            y={800}
            textAnchor="middle"
            fontSize={820}
            fontFamily={fonts.hanzi}
            fill={progress > 0.5 ? ink : (outlineColor ?? 'transparent')}
          >
            {char}
          </text>
        )}
      </svg>
    </Box>
  );
};
