import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SimilarityScore from './SimilarityScore';

describe('SimilarityScore', () => {
  it('renders the score as a meter with its percentage', () => {
    render(<SimilarityScore score={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Similarity' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
  });

  it.each([
    [97, 'Match'],
    [86, 'Close match'],
    [45, 'Partly right'],
    [0, 'Keep trying'],
  ])('labels a score of %i as "%s"', (score, label) => {
    render(<SimilarityScore score={score} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('says it is scoring while the score loads', () => {
    render(<SimilarityScore score={0} loading />);
    expect(screen.getByText('Scoring…')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});
