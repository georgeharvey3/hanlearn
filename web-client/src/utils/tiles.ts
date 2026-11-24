/**
 * The pure rules of tile mode in the Compose tab (#386). The build makes the
 * tiles of each sentence (migration/exampleSentences.js, tilesOf); the screen
 * shuffles them and grades the answer with no AI call.
 */
import type { SentenceResult } from './sentenceQueue';

/**
 * The characters that a tile can hold: Han characters and digits. A
 * constructor, because the compile target does not allow the `u` flag in a
 * literal.
 */
const TILE_CHAR = new RegExp('[\\p{Script=Han}\\p{Nd}]', 'u');

const tileChars = (text: string): string =>
  Array.from(text)
    .filter((c) => TILE_CHAR.test(c))
    .join('');

/**
 * The grade of a tile answer: right only for an exact match with the
 * reference sentence. The match ignores punctuation, so 明天我去 is wrong
 * for 我明天去.
 */
export function gradeTiles(answer: string, reference: string): SentenceResult {
  const expected = tileChars(reference);
  return expected !== '' && tileChars(answer) === expected ? 'right' : 'wrong';
}

/** The tiles in a new random order (Fisher-Yates). `random` gives a number in [0, 1). */
export function shuffleTiles<T>(tiles: readonly T[], random: () => number = Math.random): T[] {
  const out = [...tiles];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
