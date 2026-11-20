/**
 * The component breakdown of a character: its parts, the strokes of each
 * part, a label (#527), and the origin of the character (#569).
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
  /** The parts of the part. */
  p?: BreakdownPart[];
}

/**
 * A character of an origin that is a part of the breakdown: `s` holds the
 * strokes of that part, which give it the ink of its part.
 */
export interface OriginPart {
  c: string;
  s: number[];
}

/**
 * The origin of a character (#569), from its Make Me a Hanzi etymology. A
 * story origin gives `t`: the text, with each character that is a part as an
 * OriginPart. A meaning-and-sound origin gives `m` (the meaning part, with its
 * gloss) or `n` (the sound part, with its pinyin), or both. A side with no
 * `s` matches no part, and shows in plain text.
 */
export interface Origin {
  t?: (string | OriginPart)[];
  m?: { c: string; l?: string; s?: number[] };
  n?: { c: string; y?: string; s?: number[] };
}

/** The breakdown of one character. `p` is null when the character does not split. */
export interface Breakdown {
  c: string;
  p: BreakdownPart[] | null;
  /** The origin; absent when the source has none. */
  o?: Origin;
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
