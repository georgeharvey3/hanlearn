/**
 * The order of the candidates of the handwriting pad (#476).
 *
 * The matcher distance comes first. But two shapes that the matcher scores
 * almost the same are a tie in practice, and then the common character is the
 * better guess. So the candidates go in bands: a band starts at the best
 * candidate left and holds each candidate within CANDIDATE_BAND of it. Inside
 * a band, a character with an HSK rank `q` goes first, a lower rank before a
 * higher one, and the rest keep the matcher order.
 */

/**
 * The width of a band, in matcher distance. A close match of a well drawn
 * character is near 0.05, and a wrong shape is past 0.15.
 */
export const CANDIDATE_BAND = 0.02;

/** The candidates that the strip shows. */
export const CANDIDATE_COUNT = 8;

interface Ranked {
  char: string;
  distance: number;
  rank: number | null;
}

/** The characters of `matches` (best first) in the order of the strip. */
export function orderCandidates(
  matches: Ranked[],
  count: number = CANDIDATE_COUNT,
  band: number = CANDIDATE_BAND,
): string[] {
  const left = [...matches].sort((a, b) => a.distance - b.distance);
  const out: string[] = [];
  let at = 0;
  while (at < left.length && out.length < count) {
    let end = at;
    while (end < left.length && left[end].distance - left[at].distance <= band) end++;
    const inBand = left
      .slice(at, end)
      .map((match, i) => ({ match, i }))
      .sort((a, b) => (a.match.rank ?? Infinity) - (b.match.rank ?? Infinity) || a.i - b.i);
    out.push(...inBand.map(({ match }) => match.char));
    at = end;
  }
  return out.slice(0, count);
}
