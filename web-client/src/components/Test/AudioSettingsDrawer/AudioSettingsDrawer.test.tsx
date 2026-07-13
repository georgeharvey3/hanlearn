import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText('Auto-start microphone')).toBeInTheDocument();
  });

  it('renders a quiz type radio group per answer type', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    const meaning = screen.getByRole('radiogroup', { name: 'Meaning' });
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    for (const group of [meaning, pinyin]) {
      expect(within(group).getByRole('radio', { name: 'Input' })).toBeInTheDocument();
      expect(within(group).getByRole('radio', { name: 'Flashcard' })).toBeInTheDocument();
    }
  });

  it('defaults to meaning=Flashcard and pinyin=Input', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    const meaning = screen.getByRole('radiogroup', { name: 'Meaning' });
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    expect(within(meaning).getByRole('radio', { name: 'Flashcard' })).toBeChecked();
    expect(within(pinyin).getByRole('radio', { name: 'Input' })).toBeChecked();
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

  it('toggling a checkbox updates localStorage', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);
    const soundEffectsCheckbox = screen.getByRole('checkbox', { name: 'Sound effects' });

    // Default is checked (localStorage has no 'false' value)
    expect(soundEffectsCheckbox).toBeChecked();

    await user.click(soundEffectsCheckbox);
    expect(localStorage.getItem('useSoundEffects')).toBe('false');
  });

  it('switching a quiz type updates localStorage for that answer type only', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);

    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    await user.click(within(pinyin).getByRole('radio', { name: 'Flashcard' }));

    expect(localStorage.getItem('pinyinQuizType')).toBe('flashcard');
    expect(localStorage.getItem('meaningQuizType')).toBeNull();
    expect(within(pinyin).getByRole('radio', { name: 'Flashcard' })).toBeChecked();
  });

  it('supports mixed quiz types (meaning=flashcard, pinyin=input)', async () => {
    const user = userEvent.setup();
    // Start away from the defaults so both clicks fire change events
    localStorage.setItem('meaningQuizType', 'input');
    localStorage.setItem('pinyinQuizType', 'flashcard');
    render(<AudioSettingsDrawer {...defaultProps} />);

    const meaning = screen.getByRole('radiogroup', { name: 'Meaning' });
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    await user.click(within(meaning).getByRole('radio', { name: 'Flashcard' }));
    await user.click(within(pinyin).getByRole('radio', { name: 'Input' }));

    expect(localStorage.getItem('meaningQuizType')).toBe('flashcard');
    expect(localStorage.getItem('pinyinQuizType')).toBe('input');
  });

  it('does not render checkboxes when closed', () => {
    render(<AudioSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Text-to-speech')).not.toBeInTheDocument();
  });
});
