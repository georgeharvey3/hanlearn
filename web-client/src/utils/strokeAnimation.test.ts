import { describe, it, expect } from 'vitest';
import { animationLength, medianLength, strokeTimings } from './strokeAnimation';

describe('strokeTimings', () => {
  it('measures a median along its points', () => {
    expect(
      medianLength([
        [0, 0],
        [300, 400],
        [300, 500],
      ]),
    ).toBe(600);
  });

  it('starts each stroke after the one before it and a gap', () => {
    const [first, second] = strokeTimings([
      [
        [0, 0],
        [1000, 0],
      ],
      [
        [0, 0],
        [0, 500],
      ],
    ]);
    expect(first).toEqual({ length: 1000, delay: 0, duration: 900 });
    expect(second.delay).toBe(900 + 120);
    expect(second.duration).toBe(450);
  });

  it('gives a dot a minimum time', () => {
    expect(
      strokeTimings([
        [
          [0, 0],
          [10, 0],
        ],
      ])[0].duration,
    ).toBe(250);
  });

  it('ends when the last stroke ends', () => {
    expect(
      animationLength([
        [
          [0, 0],
          [1000, 0],
        ],
        [
          [0, 0],
          [0, 500],
        ],
      ]),
    ).toBe(900 + 120 + 450);
    expect(animationLength([])).toBe(0);
  });
});
