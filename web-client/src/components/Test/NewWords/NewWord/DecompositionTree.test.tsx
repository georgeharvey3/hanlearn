import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../../services/decompositionService');
vi.mock('../../../../services/errorReporting', () => ({
  reportError: vi.fn(),
}));

import DecompositionTree from './DecompositionTree';

import { decomposeCharacter } from '../../../../services/decompositionService';
import { reportError } from '../../../../services/errorReporting';

const mockedDecompose = vi.mocked(decomposeCharacter);
const mockedReportError = vi.mocked(reportError);

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

  it('reports the failure to Sentry', async () => {
    const error = new Error('network error');
    mockedDecompose.mockRejectedValueOnce(error);

    render(<DecompositionTree char="木" />);

    await waitFor(() => {
      expect(screen.getByText('Decomposition failed')).toBeInTheDocument();
    });

    // reportError adds the layer:client tag from sentry.ts and the feature tag.
    expect(mockedReportError).toHaveBeenCalledWith(error, {
      feature: 'decomposition',
      context: { char: '木', depth: 0 },
    });
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

describe('DecompositionTree empty vs failed (issue #317)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state and no error for a character with no decomposition', async () => {
    // Since #317 the function returns an empty list only for this case; a real
    // failure throws functions/internal instead.
    mockedDecompose.mockResolvedValueOnce([]);

    render(<DecompositionTree char="一" />);

    await waitFor(() => {
      expect(screen.getByText('No decomposition available')).toBeInTheDocument();
    });

    expect(screen.queryByText('Decomposition failed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers a retry on a nested component when its decomposition fails', async () => {
    const user = userEvent.setup();

    mockedDecompose.mockResolvedValueOnce([{ char: '木', meaning: 'tree', pinyin: 'mù' }]);

    render(<DecompositionTree char="林" />);

    await waitFor(() => {
      expect(screen.getByText('木')).toBeInTheDocument();
    });

    const internalError = Object.assign(new Error('internal'), {
      code: 'functions/internal',
    });
    mockedDecompose.mockRejectedValueOnce(internalError);

    await user.click(screen.getByRole('button', { name: 'Decompose 木' }));

    await waitFor(() => {
      expect(screen.getByText('Could not load decomposition')).toBeInTheDocument();
    });

    const retry = screen.getByRole('button', { name: 'Retry decomposition for 木' });

    mockedDecompose.mockResolvedValueOnce([{ char: '十', meaning: 'ten', pinyin: 'shí' }]);
    await user.click(retry);

    await waitFor(() => {
      expect(screen.getByText('十')).toBeInTheDocument();
    });

    expect(screen.queryByText('Could not load decomposition')).not.toBeInTheDocument();
  });

  it('shows an empty state on a nested component with no further decomposition', async () => {
    const user = userEvent.setup();

    mockedDecompose.mockResolvedValueOnce([{ char: '木', meaning: 'tree', pinyin: 'mù' }]);

    render(<DecompositionTree char="林" />);

    await waitFor(() => {
      expect(screen.getByText('木')).toBeInTheDocument();
    });

    mockedDecompose.mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: 'Decompose 木' }));

    await waitFor(() => {
      expect(screen.getByText('No further decomposition')).toBeInTheDocument();
    });

    expect(screen.queryByText('Could not load decomposition')).not.toBeInTheDocument();
  });
});
