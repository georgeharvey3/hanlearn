import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copy } from '../../../copy';
import FiveWays from './FiveWays';

// The scroll position decides the step on the card; the test sets it.
const scroll = vi.hoisted(() => ({ progress: 0 }));
vi.mock('./motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./motion')>()),
  useGutter: () => ({ phone: false, gutter: 32, topBar: 64 }),
  useStageScale: () => 1,
  useSectionProgress: () => ({ ref: { current: null }, progress: scroll.progress }),
}));
vi.mock('./StrokeChar', () => ({
  StrokeChar: () => null,
  useStrokeData: (chars: string[]) => chars.map(() => null),
}));

const SPEAKER = 'VolumeUpRoundedIcon';
const MIC = 'MicNoneOutlinedIcon';
const steps = copy.landing.fiveWays.steps;

// The icon each step shows with its Sound face: speaker when Sound is the
// question, microphone when Sound is the answer.
const expected: (string | null)[] = [null, SPEAKER, MIC, MIC, null];

// Progress at the middle of step i, from the section's START and END.
const progressOf = (i: number) => 0.1 + ((0.92 - 0.1) / 5) * (i + 0.5);

const icons = (el: HTMLElement) => ({
  speaker: within(el).queryAllByTestId(SPEAKER),
  mic: within(el).queryAllByTestId(MIC),
});

describe('FiveWays', () => {
  beforeEach(() => {
    scroll.progress = 0;
  });

  it.each(steps.map((label, i) => [label, i] as const))(
    'shows the right sound icon on the card for "%s"',
    (_label, i) => {
      scroll.progress = progressOf(i);
      render(<FiveWays />);
      const found = icons(screen.getByTestId('five-ways-card'));
      const icon = expected[i];
      // One on the direction label, one on the Sound face.
      expect(found.speaker).toHaveLength(icon === SPEAKER ? 2 : 0);
      expect(found.mic).toHaveLength(icon === MIC ? 2 : 0);
      [...found.speaker, ...found.mic].forEach((svg) =>
        expect(svg).toHaveAttribute('aria-hidden', 'true'),
      );
    },
  );

  it('shows the right sound icon in each line of the step list', () => {
    scroll.progress = progressOf(0);
    render(<FiveWays />);
    steps.forEach((label, i) => {
      const row = screen.getByText(label).parentElement as HTMLElement;
      const found = icons(row);
      expect(found.speaker).toHaveLength(expected[i] === SPEAKER ? 1 : 0);
      expect(found.mic).toHaveLength(expected[i] === MIC ? 1 : 0);
    });
  });
});
