import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { renderWithProviders } from '../../test/utils';
import TestChengyusTest from './TestChengyusTest';
import { Word } from '../../types/models';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
}));

const mockWords: Word[] = [
  {
    id: 1,
    simp: '一石二鸟',
    trad: '一石二鳥',
    pinyin: 'yī shí èr niǎo',
    meaning: 'kill two birds with one stone',
  },
  {
    id: 2,
    simp: '半途而废',
    trad: '半途而廢',
    pinyin: 'bàn tú ér fèi',
    meaning: 'give up halfway',
  },
];

describe('TestChengyusTest', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the first word characters', () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);
    expect(screen.getByLabelText('Show details for 一')).toBeInTheDocument();
    expect(screen.getByLabelText('Show details for 石')).toBeInTheDocument();
  });

  it('shows an error message when character lookup returns non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
    });

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByLabelText('Show details for 一'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error looking up character');
    });
  });

  it('shows an error message when character lookup network request fails (regression: unhandled rejection)', async () => {
    // Before fix: fetch().then() without .catch() caused unhandled promise rejection on network failure
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<TestChengyusTest words={mockWords} />);

    await userEvent.click(screen.getByLabelText('Show details for 一'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error looking up character');
    });
  });

  it('toggles chengyu meaning when Show Answer is clicked', async () => {
    renderWithProviders(<TestChengyusTest words={mockWords} />);

    expect(screen.queryByText('kill two birds with one stone')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Show Answer'));

    expect(screen.getByText(/kill two birds with one stone/)).toBeInTheDocument();
  });
});
