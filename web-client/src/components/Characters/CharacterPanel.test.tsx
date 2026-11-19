/**
 * Tests for the panel of one character on the word page (#562): the parts,
 * the Composition switch and the stroke animation.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/breakdownService', () => ({
  breakdownOf: vi.fn(),
}));

vi.mock('../../services/partReportService', () => ({
  reportPart: vi.fn(),
}));

vi.mock('../../services/errorReporting', () => ({
  reportError: vi.fn(),
}));

vi.mock('../../utils/charDataLoader', () => ({
  loadCharData: vi.fn(),
  onCharDataError: vi.fn(),
}));

import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';

import { copy } from '../../copy';
import CharacterPanel from './CharacterPanel';
import { Breakdown, breakdownOf } from '../../services/breakdownService';
import { loadCharData } from '../../utils/charDataLoader';
import { authenticatedState, createTestStore, renderWithProviders } from '../../test/utils';

const mockedBreakdownOf = vi.mocked(breakdownOf);
const mockedLoadCharData = vi.mocked(loadCharData);

const MING: Breakdown = {
  c: '明',
  p: [
    { c: '日', s: [0, 1, 2, 3], l: 'sun', y: 'rì' },
    { c: '月', s: [4, 5, 6, 7], l: 'moon', y: 'yuè' },
  ],
};

// Eight strokes, each a short line, so the animation is 8 × 250 ms plus the gaps.
const STROKES = {
  strokes: Array.from({ length: 8 }, (_, i) => `M ${i} 0 L ${i} 10 Z`),
  medians: Array.from({ length: 8 }, () => [
    [0, 0],
    [0, 10],
  ]),
};

const renderPanel = (char = '明') =>
  renderWithProviders(<CharacterPanel char={char} />, {
    store: createTestStore(authenticatedState()),
  });

describe('CharacterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLoadCharData.mockImplementation((_char, onLoad) => onLoad(STROKES));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the parts of a character with a breakdown, and the Composition switch on', async () => {
    mockedBreakdownOf.mockResolvedValue(MING);
    renderPanel();

    expect(await screen.findByRole('button', { name: '日' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: copy.wordPage.composition })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByTestId('ink-character')).not.toBeInTheDocument();
  });

  it('shows the character in one ink when Composition is off', async () => {
    mockedBreakdownOf.mockResolvedValue(MING);
    renderPanel();

    fireEvent.click(await screen.findByRole('switch', { name: copy.wordPage.composition }));

    expect(screen.queryByRole('button', { name: '日' })).not.toBeInTheDocument();
    expect(screen.getByTestId('ink-character')).toBeInTheDocument();
  });

  it('takes no tap on a part while the strokes draw, and takes it again after', async () => {
    mockedBreakdownOf.mockResolvedValue(MING);
    renderPanel();
    const sun = await screen.findByRole('button', { name: '日' });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: copy.wordPage.animate }));

    expect(screen.getByTestId('ink-character')).toBeInTheDocument();
    expect(sun.closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: copy.wordPage.animate })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(8 * 250 + 7 * 120);
    });

    expect(screen.queryByTestId('ink-character')).not.toBeInTheDocument();
    expect(sun.closest('[aria-disabled="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: copy.wordPage.animate })).toBeEnabled();
  });

  it('has no Composition switch for a character with no breakdown', async () => {
    mockedBreakdownOf.mockResolvedValue({ c: '一', p: null });
    renderPanel('一');

    expect(await screen.findByTestId('ink-character')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.wordPage.animate })).toBeEnabled();
  });
});
