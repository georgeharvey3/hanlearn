import { describe, it, expect } from 'vitest';

import { partInk } from './theme';

/** The CIE L* lightness of a hex colour, 0 (black) to 100 (white). */
const lightness = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
};

describe('partInk', () => {
  it('has 4 inks that differ in lightness, for colour-blind learners', () => {
    expect(partInk).toHaveLength(4);
    const values = partInk.map(lightness).sort((a, b) => a - b);
    for (let i = 1; i < values.length; i++) {
      expect(values[i] - values[i - 1]).toBeGreaterThanOrEqual(10);
    }
  });
});
