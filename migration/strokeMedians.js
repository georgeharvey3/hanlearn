/**
 * The median lines of the strokes of hanzi-writer-data, as the repository
 * commits them in components/source/stroke-medians.json (#476).
 *
 * The raw medians are 6.5 MB. The commit keeps each median simplified with
 * the Douglas-Peucker rule: a point that lies near the line between its
 * neighbours goes. The first and the last point of a stroke always stay, so
 * the stroke ends of the breakdown build (#528) do not change.
 */

/** The tolerance of the simplification, in units of the 1024 box of the data. */
const MEDIAN_TOLERANCE = 16;

const distanceToLine = ([x, y], [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(x - ax, y - ay);
  return Math.abs(dy * (x - ax) - dx * (y - ay)) / length;
};

const simplify = (points, tolerance) => {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let far = 0;
  let farDistance = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToLine(points[i], first, last);
    if (distance > farDistance) {
      far = i;
      farDistance = distance;
    }
  }
  if (farDistance <= tolerance) return [first, last];
  return [...simplify(points.slice(0, far + 1), tolerance).slice(0, -1), ...simplify(points.slice(far), tolerance)];
};

/**
 * One median, given as a list of [x, y] points, simplified and flattened to
 * [x0, y0, x1, y1, ...].
 */
const simplifyMedian = (points, tolerance = MEDIAN_TOLERANCE) => simplify(points, tolerance).flat();

/**
 * The first and the last point of each flat median: [x0, y0, xN, yN]. This is
 * the shape that the breakdown build reads.
 */
const endsOf = (medians) =>
  medians.map((median) => [median[0], median[1], median[median.length - 2], median[median.length - 1]]);

module.exports = { MEDIAN_TOLERANCE, endsOf, simplifyMedian };
