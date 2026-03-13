import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SimilarityScore from './SimilarityScore';

describe('SimilarityScore', () => {
  it('renders the score percentage text', () => {
    render(<SimilarityScore score={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows "Great" label for score >= 80', () => {
    render(<SimilarityScore score={85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();
  });

  it('shows "Good" label for score >= 60', () => {
    render(<SimilarityScore score={65} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows "Fair" label for score >= 40', () => {
    render(<SimilarityScore score={45} />);
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('shows "Keep trying" label for score < 40', () => {
    render(<SimilarityScore score={25} />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Keep trying')).toBeInTheDocument();
  });

  it('handles score of 0', () => {
    render(<SimilarityScore score={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Keep trying')).toBeInTheDocument();
  });

  it('handles score of 100', () => {
    render(<SimilarityScore score={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Great')).toBeInTheDocument();
  });

  it('shows indeterminate spinner when loading', () => {
    render(<SimilarityScore score={0} loading />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Scoring…')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders a determinate progress indicator with aria-label', () => {
    render(<SimilarityScore score={60} />);
    expect(screen.getByLabelText('Similarity score: 60%')).toBeInTheDocument();
  });
});
