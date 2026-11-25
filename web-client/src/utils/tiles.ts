/**
 * The pure rules of tile mode in the Compose tab (#386). The build makes the
 * tiles of each sentence (migration/exampleSentences.js, tilesOf); the screen
 * shuffles them, and src/utils/answerCompare.ts compares the answer (#597).
 */

/** The tiles in a new random order (Fisher-Yates). `random` gives a number in [0, 1). */
export function shuffleTiles<T>(tiles: readonly T[], random: () => number = Math.random): T[] {
  const out = [...tiles];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
