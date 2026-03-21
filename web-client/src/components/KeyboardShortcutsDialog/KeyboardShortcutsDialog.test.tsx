import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';
import { renderWithProviders } from '../../test/utils';

describe('KeyboardShortcutsDialog', () => {
  it('renders shortcut groups when open', () => {
    renderWithProviders(<KeyboardShortcutsDialog open={true} onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Add Words')).toBeInTheDocument();
    expect(screen.getByText('Sentence Exercises')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderWithProviders(<KeyboardShortcutsDialog open={false} onClose={() => {}} />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays correct shortcut keys and descriptions', () => {
    renderWithProviders(<KeyboardShortcutsDialog open={true} onClose={() => {}} />);
    expect(screen.getAllByText('Focus answer input').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Show hint')).toBeInTheDocument();
    expect(screen.getByText('Toggle pinyin visibility')).toBeInTheDocument();
  });

  it('renders kbd elements for shortcut keys', () => {
    renderWithProviders(<KeyboardShortcutsDialog open={true} onClose={() => {}} />);
    const kbdElements = document.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
  });
});
