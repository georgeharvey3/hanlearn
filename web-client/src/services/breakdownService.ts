/**
 * The component breakdown of a character: its parts, the strokes of each
 * part, a label, and a meaning or sound clue (#527).
 *
 * `npm run build:dict` writes one file for each HSK character to
 * `/breakdowns/` on Hosting (#528). The file name is the hex code point of
 * the character. A breakdown costs one fetch and no Cloud Function call.
 */

/** One part, as the build writes it. See migration/README.md. */
export interface BreakdownPart {
  /** The character of the part; null for a piece with no name of its own. */
  c: string | null;
  /** The indices of the strokes of the part, in the strokes of the top character. */
  s: number[];
  /** The label of the part; null when no source has one. */
  l: string | null;
  /** The pinyin. */
  y?: string;
  /** The role of the part in its parent: a meaning clue or a sound clue. */
  r?: 'meaning' | 'sound';
  /** The parts of the part. */
  p?: BreakdownPart[];
}

/** The breakdown of one character. `p` is null when the character does not split. */
export interface Breakdown {
  c: string;
  p: BreakdownPart[] | null;
}

/**
 * The files fetched in this session. A failed fetch leaves the map, so the
 * next call tries again.
 */
const files = new Map<string, Promise<Breakdown>>();

// The 404 and Content-Type rules are the ones of fetchFile in sentenceService.ts.
// A change to the SPA rewrite on Hosting changes both.
async function fetchBreakdown(char: string): Promise<Breakdown> {
  const name = char.codePointAt(0)!.toString(16);
  const response = await fetch(`/breakdowns/${name}.json`);
  // A character with no file gets the app page of the SPA rewrite on Hosting,
  // and a 404 from the dev server. Neither one is an error: the character
  // has no breakdown.
  const none = { c: char, p: null };
  if (response.status === 404) return none;
  if (!response.ok) throw new Error(`Breakdown file ${name}: HTTP ${response.status}`);
  const type = response.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) return none;
  return (await response.json()) as Breakdown;
}

export function breakdownOf(char: string): Promise<Breakdown> {
  let file = files.get(char);
  if (!file) {
    file = fetchBreakdown(char);
    files.set(char, file);
    file.catch(() => files.delete(char));
  }
  return file;
}
