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

/** The box of one placed tile on screen, as a DOMRect gives it. */
export interface TileBox {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

/**
 * The slot that a dragged tile drops into: the index of the tile it goes
 * before, or the tile count for the end. The tiles wrap onto rows, so a point
 * above a tile's row, or on its row and left of its centre, goes before it.
 */
export function dropSlot(boxes: readonly TileBox[], x: number, y: number): number {
  const at = boxes.findIndex((b) => y < b.top || (y <= b.bottom && x < b.left + b.width / 2));
  return at === -1 ? boxes.length : at;
}

/** True when a drop into `slot` leaves the tile at `from` where it is. */
export const slotKeepsOrder = (from: number, slot: number): boolean =>
  slot === from || slot === from + 1;

/** The placed tiles with the tile at `from` moved into `slot` (see dropSlot). */
export function moveToSlot<T>(items: readonly T[], from: number, slot: number): T[] {
  const out = [...items];
  const [moved] = out.splice(from, 1);
  out.splice(slot > from ? slot - 1 : slot, 0, moved);
  return out;
}
