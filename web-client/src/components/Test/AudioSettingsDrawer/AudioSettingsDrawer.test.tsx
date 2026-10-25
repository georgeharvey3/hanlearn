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

  it('shows the Answers and Sound groups of the Settings page', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    const dialog = screen.getByRole('dialog', { name: 'Test settings' });
    const answers = within(dialog).getByRole('region', { name: 'Answers' });
    const sound = within(dialog).getByRole('region', { name: 'Sound' });

    expect(within(answers).getByRole('radiogroup', { name: 'Meaning' })).toBeInTheDocument();
    expect(within(answers).getByRole('radiogroup', { name: 'Pinyin' })).toBeInTheDocument();
    expect(within(answers).getByRole('switch', { name: 'Auto-start microphone' })).toBeChecked();
    expect(within(sound).getByRole('switch', { name: 'Text-to-speech' })).toBeChecked();
    expect(within(sound).getByRole('switch', { name: 'Sound effects' })).toBeChecked();
  });

  it('defaults to meaning=Flashcard and pinyin=Input', () => {
    render(<AudioSettingsDrawer {...defaultProps} />);
    const meaning = screen.getByRole('radiogroup', { name: 'Meaning' });
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    expect(within(meaning).getByRole('radio', { name: 'Flashcard' })).toBeChecked();
    expect(within(pinyin).getByRole('radio', { name: 'Input' })).toBeChecked();
  });

  it('turns off text-to-speech, with the reason, without speech synthesis', () => {
    render(<AudioSettingsDrawer {...defaultProps} synthAvailable={false} />);
    const tts = screen.getByRole('switch', { name: /^Text-to-speech/ });
    expect(tts).toBeDisabled();
    expect(tts).not.toBeChecked();
    expect(tts).toHaveTextContent('Not supported in this browser');
  });

  it('turns off the microphone without speech recognition, as the page does', () => {
    render(<AudioSettingsDrawer {...defaultProps} speechAvailable={false} />);
    const mic = screen.getByRole('switch', { name: /^Auto-start microphone/ });
    expect(mic).toBeDisabled();
    expect(mic).toHaveTextContent('Not supported in this browser');
  });

  it('turns off the microphone when no answer is typed', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    await user.click(within(pinyin).getByRole('radio', { name: 'Flashcard' }));
    const mic = screen.getByRole('switch', { name: /^Auto-start microphone/ });
    expect(mic).toBeDisabled();
    expect(mic).toHaveTextContent('Set Meaning or Pinyin to Input first');
  });

  it('stores a switch in localStorage', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);
    const effects = screen.getByRole('switch', { name: 'Sound effects' });
    await user.click(effects);
    expect(localStorage.getItem('useSoundEffects')).toBe('false');
    expect(effects).not.toBeChecked();
  });

  it('stores a quiz type for that answer type only', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);

    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    await user.click(within(pinyin).getByRole('radio', { name: 'Flashcard' }));

    expect(localStorage.getItem('pinyinQuizType')).toBe('flashcard');
    expect(localStorage.getItem('meaningQuizType')).toBeNull();
    expect(within(pinyin).getByRole('radio', { name: 'Flashcard' })).toBeChecked();
  });

  it('hands the settings back on close', async () => {
    const user = userEvent.setup();
    render(<AudioSettingsDrawer {...defaultProps} />);
    await user.click(screen.getByRole('switch', { name: 'Sound effects' }));
    await user.keyboard('{Escape}');
    expect(defaultProps.onClose).toHaveBeenCalledWith(
      expect.objectContaining({ useSoundEffects: false, useSound: true }),
    );
  });

  it('renders nothing when closed', () => {
    render(<AudioSettingsDrawer {...defaultProps} open={false} />);
    expect(screen.queryByText('Text-to-speech')).not.toBeInTheDocument();
  });
});
