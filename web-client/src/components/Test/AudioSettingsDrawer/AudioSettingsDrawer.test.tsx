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
    expect(screen.getByText('Text-to-speech')).toBeInTheDocument();
    expect(screen.getByText('Sound effects')).toBeInTheDocument();
    expect(screen.getByText('Chinese speech recognition')).toBeInTheDocument();
    expect(screen.getByText('English speech recognition')).toBeInTheDocument();
    expect(screen.getByText('Automatic recording')).toBeInTheDocument();
  });

  it('renders the quiz type radio group', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    expect(screen.getByText('Quiz type')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Input' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Flashcard' })).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    expect(screen.getByText('Test Settings')).toBeInTheDocument();
  });

  it('disables text-to-speech checkbox when synthAvailable is false', () => {
    render(<AudioSettingsDrawer {...defaultProps} synthAvailable={false} />);
    const ttsCheckbox = screen.getByRole('checkbox', { name: /^Text-to-speech/ });
    expect(ttsCheckbox).toBeDisabled();
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
    const soundEffectsCheckbox = screen.getByRole('checkbox', { name: 'Sound effects' });

    // Default is checked (localStorage has no 'false' value)
    expect(soundEffectsCheckbox).toBeChecked();

    await user.click(soundEffectsCheckbox);
    expect(localStorage.getItem('useSoundEffects')).toBe('false');
  });

  it('switching quiz type updates localStorage', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);

    const inputRadio = screen.getByRole('radio', { name: 'Input' });
    const flashcardRadio = screen.getByRole('radio', { name: 'Flashcard' });

    // Default is flashcard mode (localStorage empty)
    expect(flashcardRadio).toBeChecked();

    await user.click(inputRadio);
    expect(localStorage.getItem('useFlashcards')).toBe('false');
    expect(inputRadio).toBeChecked();

    await user.click(flashcardRadio);
    expect(localStorage.getItem('useFlashcards')).toBe('true');
  });

  it('switching quiz type does not affect speech recognition settings', async () => {
    const user = userEvent.setup();
    localStorage.setItem('useEnglishSpeechRecognition', 'true');
    render(<AudioSettingsDrawer {...defaultProps} />);

    await user.click(screen.getByRole('radio', { name: 'Flashcard' }));
    expect(localStorage.getItem('useEnglishSpeechRecognition')).toBe('true');
  });

  it('does not render checkboxes when closed', () => {
    render(<AudioSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Text-to-speech')).not.toBeInTheDocument();
  });
});
