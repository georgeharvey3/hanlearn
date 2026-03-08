/**
 * Tests for Settings component — user-configurable test preferences.
 *
 * Focus areas:
 * - Reads initial state from localStorage
 * - Radio buttons update charSet and persist to localStorage
 * - Checkboxes toggle boolean settings and persist to localStorage
 * - Mutual exclusion: enabling English speech disables flashcards (and vice versa)
 * - Disabling handwriting resets priority to none
 * - Disabling handwriting disables the Writing priority option
 * - Slider updates numWords and persists to localStorage
 * - Speech/synth availability gates checkbox disabled state
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Settings from './Settings';
import { renderWithProviders, createTestStore } from '../../test/utils';

function makeStore(speechAvailable = false, synthAvailable = false) {
  return createTestStore({
    auth: { userId: 'u1', loading: false, initialized: true, modalOpen: false },
    addWords: { words: [], loading: false, error: false },
    settings: { speechAvailable, synthAvailable },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Settings — initial render from localStorage', () => {
  it('defaults charSet to Simplified when localStorage is empty', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    const simpRadio = screen.getByRole('radio', { name: /simplified/i });
    expect(simpRadio).toBeChecked();
  });

  it('reads charSet = trad from localStorage', () => {
    localStorage.setItem('charSet', 'trad');
    renderWithProviders(<Settings />, { store: makeStore() });
    const tradRadio = screen.getByRole('radio', { name: /traditional/i });
    expect(tradRadio).toBeChecked();
  });

  it('shows the default numWords value (5) when localStorage is empty', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    // The number display renders the current value
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('reads numWords from localStorage', () => {
    localStorage.setItem('numWords', '10');
    renderWithProviders(<Settings />, { store: makeStore() });
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('Settings — character set radio buttons', () => {
  it('switches to Traditional when Traditional radio is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const tradRadio = screen.getByRole('radio', { name: /traditional/i });
    await user.click(tradRadio);

    expect(tradRadio).toBeChecked();
    expect(localStorage.getItem('charSet')).toBe('trad');
  });

  it('switches back to Simplified when Simplified radio is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('charSet', 'trad');
    renderWithProviders(<Settings />, { store: makeStore() });

    const simpRadio = screen.getByRole('radio', { name: /simplified/i });
    await user.click(simpRadio);

    expect(simpRadio).toBeChecked();
    expect(localStorage.getItem('charSet')).toBe('simp');
  });
});

describe('Settings — checkbox toggles', () => {
  it('toggling Sound checkbox persists to localStorage', async () => {
    const user = userEvent.setup();
    // synthAvailable=true so checkbox is enabled
    renderWithProviders(<Settings />, { store: makeStore(false, true) });

    const soundCheckbox = screen.getByRole('checkbox', { name: /^sound$/i });
    // Default is checked (true), clicking unchecks
    await user.click(soundCheckbox);
    expect(localStorage.getItem('useSound')).toBe('false');
  });

  it('toggling Meaning flashcards persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const flashcardsCheckbox = screen.getByRole('checkbox', { name: /meaning flashcards/i });
    await user.click(flashcardsCheckbox);
    expect(localStorage.getItem('useFlashcards')).toBe('false');
  });

  it('toggling Handwriting input persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const handwritingCheckbox = screen.getByRole('checkbox', { name: /handwriting input/i });
    await user.click(handwritingCheckbox);
    expect(localStorage.getItem('useHandwriting')).toBe('false');
  });

  it('toggling Make Sentences stage persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const sentenceWriteCheckbox = screen.getByRole('checkbox', { name: /make sentences/i });
    await user.click(sentenceWriteCheckbox);
    expect(localStorage.getItem('sentenceWrite')).toBe('false');
  });
});

describe('Settings — mutual exclusion rules', () => {
  it('enabling English speech recognition disables Meaning flashcards', async () => {
    const user = userEvent.setup();
    // Start with speechAvailable=true, English speech off
    localStorage.setItem('useEnglishSpeechRecognition', 'false');
    renderWithProviders(<Settings />, { store: makeStore(true, false) });

    const englishSpeechCheckbox = screen.getByRole('checkbox', {
      name: /english speech recognition/i,
    });
    await user.click(englishSpeechCheckbox);

    expect(localStorage.getItem('useFlashcards')).toBe('false');
  });

  it('enabling Meaning flashcards disables English speech recognition', async () => {
    const user = userEvent.setup();
    // Start with flashcards off, English speech on
    localStorage.setItem('useFlashcards', 'false');
    localStorage.setItem('useEnglishSpeechRecognition', 'true');
    renderWithProviders(<Settings />, { store: makeStore(true, false) });

    const flashcardsCheckbox = screen.getByRole('checkbox', { name: /meaning flashcards/i });
    await user.click(flashcardsCheckbox);

    expect(localStorage.getItem('useEnglishSpeechRecognition')).toBe('false');
  });

  it('disabling Handwriting input resets priority to none', async () => {
    const user = userEvent.setup();
    // Set priority to Writing (CM) first
    localStorage.setItem('priority', 'CM');
    localStorage.setItem('useHandwriting', 'true');
    renderWithProviders(<Settings />, { store: makeStore() });

    const handwritingCheckbox = screen.getByRole('checkbox', { name: /handwriting input/i });
    await user.click(handwritingCheckbox);

    expect(localStorage.getItem('priority')).toBe('none');
    expect(localStorage.getItem('onlyPriority')).toBe('false');
  });
});

describe('Settings — priority radio buttons', () => {
  it('selecting a priority radio persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const listeningRadio = screen.getByRole('radio', { name: /listening/i });
    await user.click(listeningRadio);

    expect(localStorage.getItem('priority')).toBe('MP');
  });

  it('selecting None priority also resets onlyPriority to false', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'MP');
    localStorage.setItem('onlyPriority', 'true');
    renderWithProviders(<Settings />, { store: makeStore() });

    const noneRadio = screen.getByRole('radio', { name: /none/i });
    await user.click(noneRadio);

    expect(localStorage.getItem('priority')).toBe('none');
    expect(localStorage.getItem('onlyPriority')).toBe('false');
  });

  it('Writing priority radio is disabled when handwriting is off', () => {
    localStorage.setItem('useHandwriting', 'false');
    renderWithProviders(<Settings />, { store: makeStore() });

    const writingRadio = screen.getByRole('radio', { name: /writing/i });
    expect(writingRadio).toBeDisabled();
  });

  it('Writing priority radio is enabled when handwriting is on', () => {
    localStorage.setItem('useHandwriting', 'true');
    renderWithProviders(<Settings />, { store: makeStore() });

    const writingRadio = screen.getByRole('radio', { name: /writing/i });
    expect(writingRadio).not.toBeDisabled();
  });
});

describe('Settings — speech availability gating', () => {
  it('disables Sound checkbox when synthAvailable is false', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, false) });
    const soundCheckbox = screen.getByRole('checkbox', { name: /^sound$/i });
    expect(soundCheckbox).toBeDisabled();
  });

  it('enables Sound checkbox when synthAvailable is true', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, true) });
    const soundCheckbox = screen.getByRole('checkbox', { name: /^sound$/i });
    expect(soundCheckbox).not.toBeDisabled();
  });

  it('disables Chinese speech recognition checkbox when speechAvailable is false', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, false) });
    const chineseSpeechCheckbox = screen.getByRole('checkbox', {
      name: /chinese speech recognition/i,
    });
    expect(chineseSpeechCheckbox).toBeDisabled();
  });

  it('enables Chinese speech recognition checkbox when speechAvailable is true', () => {
    renderWithProviders(<Settings />, { store: makeStore(true, false) });
    const chineseSpeechCheckbox = screen.getByRole('checkbox', {
      name: /chinese speech recognition/i,
    });
    expect(chineseSpeechCheckbox).not.toBeDisabled();
  });

  it('disables Translate Sentences stage when speechAvailable is false', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, false) });
    const translateSentencesCheckbox = screen.getByRole('checkbox', {
      name: /translate sentences/i,
    });
    expect(translateSentencesCheckbox).toBeDisabled();
  });

  it('disables New Words stage when synthAvailable is false', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, false) });
    const newWordsCheckbox = screen.getByRole('checkbox', { name: /new words/i });
    expect(newWordsCheckbox).toBeDisabled();
  });
});

describe('Settings — Only Priority checkbox', () => {
  it('Only Priority checkbox is disabled when priority is none', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    const onlyPriorityCheckbox = screen.getByRole('checkbox', { name: /only priority/i });
    expect(onlyPriorityCheckbox).toBeDisabled();
  });

  it('Only Priority checkbox is enabled when priority is set', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'MP');
    renderWithProviders(<Settings />, { store: makeStore() });

    const onlyPriorityCheckbox = screen.getByRole('checkbox', { name: /only priority/i });
    expect(onlyPriorityCheckbox).not.toBeDisabled();
  });

  it('toggling Only Priority persists to localStorage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'MP');
    renderWithProviders(<Settings />, { store: makeStore() });

    const onlyPriorityCheckbox = screen.getByRole('checkbox', { name: /only priority/i });
    await user.click(onlyPriorityCheckbox);
    expect(localStorage.getItem('onlyPriority')).toBe('true');
  });
});
