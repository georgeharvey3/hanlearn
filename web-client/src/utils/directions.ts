import { DIRECTIONS, Direction, DirectionState, DirectionStates } from '../types/models';

/**
 * Helpers for the per-direction scheduling state of a word.
 *
 * Every word carries five directions. Documents written before the directions
 * map existed carry only the top-level `bank` and `dueDate`, so the read path
 * synthesizes the map from those two values. As a result no caller has to
 * handle a word without directions, and the Firestore migration is a cleanup
 * rather than a prerequisite.
 *
 * See docs/adr/0002-direction-level-scheduling.md.
 */

/**
 * Build a full directions map with every direction at the same level and due date.
 * This is the shape a new word starts with, and the shape a legacy document
 * takes when its single `bank` is copied across all five directions.
 */
export function makeDirections(level: number, dueDate: string): DirectionStates {
  return DIRECTIONS.reduce((acc, direction) => {
    acc[direction] = { level, dueDate };
    return acc;
  }, {} as DirectionStates);
}

/**
 * Complete a partial or absent directions map, filling any missing direction
 * from the word's top-level level and due date.
 *
 * A stored entry wins over the fallback, so a document that gained the map is
 * never overwritten by the derived values. A partial map can only come from a
 * write that was interrupted, or from a future release that adds a direction.
 */
export function fillDirections(
  stored: Partial<Record<Direction, Partial<DirectionState>>> | undefined,
  level: number,
  dueDate: string,
): DirectionStates {
  return DIRECTIONS.reduce((acc, direction) => {
    const entry = stored?.[direction];
    acc[direction] = {
      level: typeof entry?.level === 'number' ? entry.level : level,
      dueDate: typeof entry?.dueDate === 'string' && entry.dueDate ? entry.dueDate : dueDate,
    };
    return acc;
  }, {} as DirectionStates);
}
