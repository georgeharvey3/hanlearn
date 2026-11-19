/**
 * The timing of the stroke animation of the character panel (#562). Each
 * stroke is brushed along its median, the line through its middle, in the
 * 1024-unit box of the Hanzi Writer data. A longer stroke takes longer.
 */

/** A point of a median, in the 1024-unit box. */
export type Point = [number, number];

const MS_PER_UNIT = 0.9;
const MIN_STROKE_MS = 250;
const GAP_MS = 120;

export interface StrokeTiming {
  /** The length of the median, in units of the box. */
  length: number;
  /** When the stroke starts, from the start of the animation. */
  delay: number;
  duration: number;
}

export const medianLength = (median: Point[]): number =>
  median
    .slice(1)
    .reduce((sum, [x, y], i) => sum + Math.hypot(x - median[i][0], y - median[i][1]), 0);

/** The timing of each stroke, in stroke order, with a gap between strokes. */
export function strokeTimings(medians: Point[][]): StrokeTiming[] {
  let at = 0;
  return medians.map((median) => {
    const length = medianLength(median);
    const duration = Math.max(MIN_STROKE_MS, length * MS_PER_UNIT);
    const timing = { length, delay: at, duration };
    at += duration + GAP_MS;
    return timing;
  });
}

/** When the last stroke ends. Zero for a character with no strokes. */
export function animationLength(medians: Point[][]): number {
  const timings = strokeTimings(medians);
  const last = timings[timings.length - 1];
  return last ? last.delay + last.duration : 0;
}
