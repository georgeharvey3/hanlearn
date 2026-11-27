/** The sizes of the handwriting pad (#476). */
import { WRITER_SIZE } from '../Test/handwriting';

/** The height of the candidate strip, in pixels. */
export const STRIP_HEIGHT = 52;

/** The width of the column of the pad's buttons, in pixels. */
export const TOOLS_WIDTH = 56;

/**
 * The side of the square drawing box: the side of the handwriting box of the
 * Test, or less on a phone too narrow for it and the buttons.
 */
export const CANVAS_SIDE = `min(${WRITER_SIZE}px, calc(100vw - ${TOOLS_WIDTH + 18}px))`;

/** The height of the pad, with no safe area below it, as a CSS length. */
export const PAD_HEIGHT = `calc(${STRIP_HEIGHT + 2}px + ${CANVAS_SIDE})`;
