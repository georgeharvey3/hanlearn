import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioSettingsDrawer from './AudioSettingsDrawer';

describe('AudioSettingsDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    speechAvailable: true,
    synthAvailable: true,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders all audio setting checkboxes when open', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    expect(screen.getByText('Sound')).toBeInTheDocument();
    expect(screen.getByText('Chinese speech recognition')).toBeInTheDocument();
    expect(screen.getByText('English speech recognition')).toBeInTheDocument();
    expect(screen.getByText('Automatic recording')).toBeInTheDocument();
    expect(screen.getByText('Meaning flashcards')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    expect(screen.getByText('Audio & Voice Settings')).toBeInTheDocument();
  });

  it('disables sound checkbox when synthAvailable is false', () => {
    render(<AudioSettingsDrawer {...defaultProps} synthAvailable={false} />);
    const soundCheckbox = screen.getByRole('checkbox', { name: /^Sound/ });
    expect(soundCheckbox).toBeDisabled();
  });

  it('disables speech recognition checkboxes when speechAvailable is false', () => {
    render(<AudioSettingsDrawer {...defaultProps} speechAvailable={false} />);
    const chinese = screen.getByRole('checkbox', { name: /^Chinese speech recognition/ });
    const english = screen.getByRole('checkbox', { name: /^English speech recognition/ });
    expect(chinese).toBeDisabled();
    expect(english).toBeDisabled();
  });

  it('toggling a checkbox updates localStorage', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);
    const soundCheckbox = screen.getByRole('checkbox', { name: 'Sound' });

    // Default is checked (localStorage has no 'false' value)
    expect(soundCheckbox).toBeChecked();

    await user.click(soundCheckbox);
    expect(localStorage.getItem('useSound')).toBe('false');
  });

  it('enforces mutual exclusivity between English speech recognition and flashcards', async () => {
    const user = userEvent.setup();
    localStorage.setItem('useEnglishSpeechRecognition', 'false');
    render(<AudioSettingsDrawer {...defaultProps} />);

    const flashcards = screen.getByRole('checkbox', { name: 'Meaning flashcards' });
    const english = screen.getByRole('checkbox', { name: 'English speech recognition' });

    // Flashcards is checked, English is unchecked
    expect(flashcards).toBeChecked();
    expect(english).not.toBeChecked();

    // Enable English → flashcards should become unchecked
    await user.click(english);
    expect(localStorage.getItem('useFlashcards')).toBe('false');
  });

  it('does not render checkboxes when closed', () => {
    render(<AudioSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Sound')).not.toBeInTheDocument();
  });
});
