/**
 * The matcher of the handwriting pad (#476). It runs on the device, with no
 * network call, against the template file that `build:dict` writes from the
 * Make Me a Hanzi stroke medians (migration/handwritingTemplates.js).
 */

/** One point of a stroke: x and y, with y down, in any unit. */
export type Point = [number, number];
export type Stroke = Point[];

/** The template file as the build writes it. */
export interface TemplateFile {
  version: number;
  chars: string;
  ranks: Record<string, number>;
  strokes: string;
}

/** One character of the template file. */
export interface Template {
  char: string;
  /** The HSK rank `q` of the character, null outside HSK. */
  rank: number | null;
  /** The median line of each stroke, in a box of 256 with y down. */
  strokes: Stroke[];
}

/** Read the template file back into one template for each character. */
export function parseTemplates(file: TemplateFile): Template[] {
  const binary = atob(file.strokes);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  let at = 0;
  return Array.from(file.chars).map((char) => {
    const strokes: Stroke[] = [];
    const strokeCount = bytes[at++];
    for (let s = 0; s < strokeCount; s++) {
      const pointCount = bytes[at++];
      const stroke: Stroke = [];
      for (let p = 0; p < pointCount; p++) {
        stroke.push([bytes[at], bytes[at + 1]]);
        at += 2;
      }
      strokes.push(stroke);
    }
    return { char, rank: file.ranks[char] ?? null, strokes };
  });
}

/**
 * The points of each stroke after the resample. A stroke of any length gives
 * this many points, evenly spaced along its line.
 */
const POINTS = 8;

/**
 * The cost of a drawn stroke that matches no stroke of the template, or of a
 * template stroke that the learner did not draw. The unit is the side of the
 * box: a stroke that matches well costs under 0.1.
 */
const GAP_COST = 0.45;

/** The cost added to a stroke drawn from its last point to its first. */
const REVERSE_COST = 0.08;

/** A template whose stroke count differs from the drawing by more is skipped. */
const MAX_STROKE_GAP = 3;

/** A character, ready to match: its strokes resampled into one unit box. */
export interface PreparedTemplate {
  char: string;
  rank: number | null;
  strokeCount: number;
  /** x, y of each point of each stroke, POINTS points to a stroke. */
  points: Float64Array;
}

/** One candidate of the matcher. A lower distance is a better match. */
export interface Match {
  char: string;
  rank: number | null;
  distance: number;
}

/** The points of one stroke, POINTS of them, evenly spaced along its line. */
function resample(stroke: Stroke): Point[] {
  const lengths = [0];
  for (let i = 1; i < stroke.length; i++) {
    const [ax, ay] = stroke[i - 1];
    const [bx, by] = stroke[i];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0)
    return Array.from({ length: POINTS }, () => [stroke[0][0], stroke[0][1]] as Point);
  const out: Point[] = [];
  let segment = 1;
  for (let p = 0; p < POINTS; p++) {
    const at = (total * p) / (POINTS - 1);
    while (segment < stroke.length - 1 && lengths[segment] < at) segment++;
    const span = lengths[segment] - lengths[segment - 1];
    const t = span === 0 ? 0 : (at - lengths[segment - 1]) / span;
    const [ax, ay] = stroke[segment - 1];
    const [bx, by] = stroke[segment];
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

/**
 * The strokes of one character, resampled, then moved and scaled so that the
 * character fills a unit box at its centre. The longer side of the character
 * sets the scale, so a flat character such as 一 keeps its shape.
 */
function normalise(strokes: Stroke[]): Float64Array {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const [x, y] of stroke) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const points = new Float64Array(strokes.length * POINTS * 2);
  let at = 0;
  for (const stroke of strokes) {
    for (const [x, y] of resample(stroke)) {
      points[at++] = (x - cx) / size + 0.5;
      points[at++] = (y - cy) / size + 0.5;
    }
  }
  return points;
}

/** Make the templates ready to match. The pad does this once, after the load. */
export function prepareTemplates(templates: Template[]): PreparedTemplate[] {
  return templates
    .filter((t) => t.strokes.length > 0)
    .map((t) => ({
      char: t.char,
      rank: t.rank,
      strokeCount: t.strokes.length,
      points: normalise(t.strokes),
    }));
}

/**
 * The mean distance between stroke `i` of `a` and stroke `j` of `b`, point by
 * point. A stroke drawn the other way also matches, at a small extra cost.
 */
function strokeCost(a: Float64Array, i: number, b: Float64Array, j: number): number {
  const ai = i * POINTS * 2;
  const bj = j * POINTS * 2;
  let forward = 0;
  let backward = 0;
  // Math.sqrt, not Math.hypot: this loop is the hot path, and hypot is slow.
  for (let p = 0; p < POINTS; p++) {
    const ax = a[ai + p * 2];
    const ay = a[ai + p * 2 + 1];
    const fx = ax - b[bj + p * 2];
    const fy = ay - b[bj + p * 2 + 1];
    forward += Math.sqrt(fx * fx + fy * fy);
    const q = POINTS - 1 - p;
    const bx = ax - b[bj + q * 2];
    const by = ay - b[bj + q * 2 + 1];
    backward += Math.sqrt(bx * bx + by * by);
  }
  return Math.min(forward, backward + REVERSE_COST * POINTS) / POINTS;
}

/**
 * The distance between a drawing and a template: the cheapest alignment of
 * the two stroke orders, where a stroke can also go unmatched at GAP_COST.
 * The total is divided by the larger stroke count.
 *
 * No cost is negative, so the best cost of a row never falls in a later row.
 * When it passes `cutoff`, the template cannot make the list, and the
 * function stops with Infinity.
 */
function distance(
  drawn: Float64Array,
  n: number,
  template: PreparedTemplate,
  row: Float64Array,
  cutoff: number,
): number {
  const m = template.strokeCount;
  const limit = cutoff * Math.max(n, m);
  // One row of the alignment table at a time: row[j] is the best cost of the
  // first i drawn strokes against the first j template strokes.
  for (let j = 0; j <= m; j++) row[j] = j * GAP_COST;
  for (let i = 1; i <= n; i++) {
    let diagonal = row[0];
    row[0] = i * GAP_COST;
    let best = row[0];
    for (let j = 1; j <= m; j++) {
      const above = row[j];
      row[j] = Math.min(
        diagonal + strokeCost(drawn, i - 1, template.points, j - 1),
        above + GAP_COST,
        row[j - 1] + GAP_COST,
      );
      diagonal = above;
      if (row[j] < best) best = row[j];
    }
    if (best > limit) return Infinity;
  }
  return row[m] / Math.max(n, m);
}

/**
 * The `limit` best candidates for the drawn strokes, best first. The strokes
 * are in any unit with y down, as the pad gives them.
 */
export function match(strokes: Stroke[], templates: PreparedTemplate[], limit: number): Match[] {
  const drawnStrokes = strokes.filter((s) => s.length > 0);
  const n = drawnStrokes.length;
  if (n === 0) return [];
  const drawn = normalise(drawnStrokes);
  const row = new Float64Array(n + MAX_STROKE_GAP + 2);
  // The best `limit` so far, best first. A template that cannot beat the last
  // one stops early.
  const found: Match[] = [];
  for (const template of templates) {
    if (Math.abs(template.strokeCount - n) > MAX_STROKE_GAP) continue;
    const cutoff = found.length < limit ? Infinity : found[found.length - 1].distance;
    const d = distance(drawn, n, template, row, cutoff);
    if (d >= cutoff) continue;
    let at = found.length;
    while (at > 0 && found[at - 1].distance > d) at--;
    found.splice(at, 0, { char: template.char, rank: template.rank, distance: d });
    if (found.length > limit) found.pop();
  }
  return found;
}
