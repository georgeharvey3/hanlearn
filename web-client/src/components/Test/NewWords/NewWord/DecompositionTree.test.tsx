import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('../../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../../services/decompositionService');

import DecompositionTree from './DecompositionTree';

import { decomposeCharacter } from '../../../../services/decompositionService';

const mockedDecompose = vi.mocked(decomposeCharacter);

describe('DecompositionTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error message and retry button when decomposition fails', async () => {
    mockedDecompose.mockRejectedValueOnce(new Error('network error'));

    render(<DecompositionTree char="木" />);

    await waitFor(() => {
      expect(screen.getByText('Decomposition failed')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retries decomposition when retry button is clicked', async () => {
    const user = userEvent.setup();

    mockedDecompose.mockRejectedValueOnce(new Error('network error'));

    render(<DecompositionTree char="木" />);

    await waitFor(() => {
      expect(screen.getByText('Decomposition failed')).toBeInTheDocument();
    });

    mockedDecompose.mockResolvedValueOnce([
      { char: '十', meaning: 'ten', pinyin: 'shí' },
      { char: '八', meaning: 'eight', pinyin: 'bā' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('十')).toBeInTheDocument();
    });

    expect(screen.queryByText('Decomposition failed')).not.toBeInTheDocument();
    expect(mockedDecompose).toHaveBeenCalledTimes(2);
  });

  it('shows loading spinner during retry', async () => {
    const user = userEvent.setup();

    mockedDecompose.mockRejectedValueOnce(new Error('network error'));

    render(<DecompositionTree char="木" />);

    await waitFor(() => {
      expect(screen.getByText('Decomposition failed')).toBeInTheDocument();
    });

    // Make the next call hang so we can observe loading state
    let resolveDecompose!: (value: unknown[]) => void;
    mockedDecompose.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDecompose = resolve as (value: unknown[]) => void;
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByLabelText('Loading character decomposition')).toBeInTheDocument();

    resolveDecompose([]);

    await waitFor(() => {
      expect(screen.getByText('No decomposition available')).toBeInTheDocument();
    });
  });
});
