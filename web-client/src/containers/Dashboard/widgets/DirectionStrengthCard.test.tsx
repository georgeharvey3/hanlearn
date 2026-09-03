import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import DirectionStrengthCard from './DirectionStrengthCard';

const distribution = {
  MC: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 8 },
  MP: { 1: 1, 2: 1, 3: 0, 4: 0, 5: 8 },
  PM: { 1: 3, 2: 2, 3: 5, 4: 0, 5: 0 },
  PC: { 1: 4, 2: 1, 3: 5, 4: 0, 5: 0 },
  CM: { 1: 10, 2: 0, 3: 0, 4: 0, 5: 0 },
};

describe('DirectionStrengthCard', () => {
  it('names each of the five directions as question → answer', () => {
    render(<DirectionStrengthCard distribution={distribution} totalWords={10} />);

    expect(screen.getByText('Character → Meaning')).toBeInTheDocument();
    expect(screen.getByText('Pinyin → Meaning')).toBeInTheDocument();
    expect(screen.getByText('Meaning → Pinyin')).toBeInTheDocument();
    expect(screen.getByText('Character → Pinyin')).toBeInTheDocument();
    expect(screen.getByText('Meaning → Character')).toBeInTheDocument();
  });

  it('gives each bar a label with the counts, so the bank split is readable', () => {
    render(<DirectionStrengthCard distribution={distribution} totalWords={10} />);

    expect(
      screen.getByLabelText(
        'Meaning → Character: 10 New, 0 Learning, 0 Familiar, 0 Known, 0 Mastered',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'Character → Meaning: 2 New, 0 Learning, 0 Familiar, 0 Known, 8 Mastered',
      ),
    ).toBeInTheDocument();
  });

  it('draws a segment per bank that has words, sized as a share of the words', () => {
    render(<DirectionStrengthCard distribution={distribution} totalWords={10} />);

    const bar = screen.getByLabelText(
      'Character → Meaning: 2 New, 0 Learning, 0 Familiar, 0 Known, 8 Mastered',
    );

    // Two banks hold words, so the other three draw nothing.
    expect(bar.children).toHaveLength(2);
    expect((bar.children[0] as HTMLElement).style.width).toBe('20%');
    expect((bar.children[1] as HTMLElement).style.width).toBe('80%');
  });

  it('asks for words rather than drawing empty bars when there are none', () => {
    render(<DirectionStrengthCard distribution={{}} totalWords={0} />);

    expect(screen.getByText(/Add some words/)).toBeInTheDocument();
    expect(screen.queryByText('Character → Meaning')).not.toBeInTheDocument();
  });

  it('renders a bar for a direction the distribution is missing', () => {
    render(<DirectionStrengthCard distribution={{ MC: { 1: 5 } }} totalWords={5} />);

    expect(
      screen.getByLabelText(
        'Meaning → Character: 0 New, 0 Learning, 0 Familiar, 0 Known, 0 Mastered',
      ),
    ).toBeInTheDocument();
  });

  it('shows the five bank names as a legend', () => {
    render(<DirectionStrengthCard distribution={distribution} totalWords={10} />);

    const legend = screen.getByTestId('direction-strength-legend');
    for (const label of ['New', 'Learning', 'Familiar', 'Known', 'Mastered']) {
      expect(legend).toHaveTextContent(label);
    }
  });
});
