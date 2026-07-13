/**
 * Tests for Settings component — user-configurable test preferences.
 *
 * Focus areas:
 * - Reads initial state from localStorage
 * - Radio buttons update charSet and persist to localStorage
 * - Checkboxes toggle boolean settings and persist to localStorage
 * - Quiz type radio (Input/Flashcard) persists to localStorage
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
import { axe } from 'vitest-axe';

import Settings from './Settings';
import { renderWithProviders, createTestStore } from '../../test/utils';

function makeStore(speechAvailable = false, synthAvailable = false) {
  return createTestStore({
    auth: { userId: 'u1', loading: false, initialized: true, modalOpen: false },
    addWords: {
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
      activeListId: 'default',
      words: [],
      listStats: {},
      loading: false,
      error: false,
    },
    settings: { speechAvailable, synthAvailable },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Settings — accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Settings />, { store: makeStore() });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Settings — initial render from localStorage', () => {
  it('defaults charSet to Traditional when localStorage is empty', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    const tradRadio = screen.getByRole('radio', { name: /traditional/i });
    expect(tradRadio).toBeChecked();
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
  it('switches to Simplified when Simplified radio is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const simpRadio = screen.getByRole('radio', { name: /simplified/i });
    await user.click(simpRadio);

    expect(simpRadio).toBeChecked();
    expect(localStorage.getItem('charSet')).toBe('simp');
  });

  it('switches back to Traditional when Traditional radio is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('charSet', 'simp');
    renderWithProviders(<Settings />, { store: makeStore() });

    const tradRadio = screen.getByRole('radio', { name: /traditional/i });
    await user.click(tradRadio);

    expect(tradRadio).toBeChecked();
    expect(localStorage.getItem('charSet')).toBe('trad');
  });
});

describe('Settings — checkbox toggles', () => {
  it('toggling Text-to-speech checkbox persists to localStorage', async () => {
    const user = userEvent.setup();
    // synthAvailable=true so checkbox is enabled
    renderWithProviders(<Settings />, { store: makeStore(false, true) });

    const soundCheckbox = screen.getByRole('checkbox', { name: /text-to-speech/i });
    // Default is checked (true), clicking unchecks
    await user.click(soundCheckbox);
    expect(localStorage.getItem('useSound')).toBe('false');
  });

  it('switching quiz type to Input persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    // Default is Flashcard
    expect(screen.getByRole('radio', { name: /flashcard/i })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /input/i }));
    expect(localStorage.getItem('useFlashcards')).toBe('false');
  });

  it('switching quiz type back to Flashcard persists to localStorage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('useFlashcards', 'false');
    renderWithProviders(<Settings />, { store: makeStore() });

    expect(screen.getByRole('radio', { name: /input/i })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /flashcard/i }));
    expect(localStorage.getItem('useFlashcards')).toBe('true');
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

describe('Settings — quiz type independence', () => {
  it('enabling English speech recognition leaves quiz type unchanged', async () => {
    const user = userEvent.setup();
    // Start with speechAvailable=true, English speech off, flashcard mode on
    localStorage.setItem('useEnglishSpeechRecognition', 'false');
    localStorage.setItem('useFlashcards', 'true');
    renderWithProviders(<Settings />, { store: makeStore(true, false) });

    const englishSpeechCheckbox = screen.getByRole('checkbox', {
      name: /english speech recognition/i,
    });
    await user.click(englishSpeechCheckbox);

    expect(localStorage.getItem('useFlashcards')).toBe('true');
    expect(screen.getByRole('radio', { name: /flashcard/i })).toBeChecked();
  });

  it('switching to Flashcard quiz type leaves speech recognition unchanged', async () => {
    const user = userEvent.setup();
    localStorage.setItem('useFlashcards', 'false');
    localStorage.setItem('useEnglishSpeechRecognition', 'true');
    renderWithProviders(<Settings />, { store: makeStore(true, false) });

    await user.click(screen.getByRole('radio', { name: /flashcard/i }));

    expect(localStorage.getItem('useEnglishSpeechRecognition')).toBe('true');
  });
});

describe('Settings — mutual exclusion rules', () => {
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
  it('disables Text-to-speech checkbox when synthAvailable is false', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, false) });
    const soundCheckbox = screen.getByRole('checkbox', { name: /text-to-speech/i });
    expect(soundCheckbox).toBeDisabled();
  });

  it('enables Text-to-speech checkbox when synthAvailable is true', () => {
    renderWithProviders(<Settings />, { store: makeStore(false, true) });
    const soundCheckbox = screen.getByRole('checkbox', { name: /text-to-speech/i });
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

describe('Settings — time estimate display', () => {
  it('shows estimated test time on initial render', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    expect(screen.getByText(/estimated test time:/i)).toBeInTheDocument();
  });

  it('updates estimate when stage checkbox is toggled off', async () => {
    const user = userEvent.setup();
    // Use a larger numWords so the sentence stage time difference is noticeable
    localStorage.setItem('numWords', '15');
    renderWithProviders(<Settings />, { store: makeStore() });

    const estimateEl = screen.getByText(/estimated test time:/i);
    const initialText = estimateEl.textContent;

    const sentenceWriteCheckbox = screen.getByRole('checkbox', { name: /make sentences/i });
    await user.click(sentenceWriteCheckbox);

    expect(estimateEl.textContent).not.toBe(initialText);
  });

  it('updates estimate when Only Priority is toggled on', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'MP');
    renderWithProviders(<Settings />, { store: makeStore() });

    const estimateEl = screen.getByText(/estimated test time:/i);
    const initialText = estimateEl.textContent;

    const onlyPriorityCheckbox = screen.getByRole('checkbox', { name: /only priority/i });
    await user.click(onlyPriorityCheckbox);

    expect(estimateEl.textContent).not.toBe(initialText);
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

describe('Settings — sentence stages for all words', () => {
  it('renders the "Sentence stages for all words" checkbox unchecked by default', () => {
    renderWithProviders(<Settings />, { store: makeStore() });
    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('reads sentenceStagesForAllWords=true from localStorage', () => {
    localStorage.setItem('sentenceStagesForAllWords', 'true');
    renderWithProviders(<Settings />, { store: makeStore() });
    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    expect(checkbox).toBeChecked();
  });

  it('toggling the checkbox persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Settings />, { store: makeStore() });

    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    await user.click(checkbox);
    expect(localStorage.getItem('sentenceStagesForAllWords')).toBe('true');
  });

  it('is disabled when both sentence stages are off', () => {
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'false');
    renderWithProviders(<Settings />, { store: makeStore() });
    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    expect(checkbox).toBeDisabled();
  });

  it('is enabled when sentenceRead is on', () => {
    localStorage.setItem('sentenceRead', 'true');
    localStorage.setItem('sentenceWrite', 'false');
    renderWithProviders(<Settings />, { store: makeStore(true, false) });
    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    expect(checkbox).not.toBeDisabled();
  });

  it('is enabled when sentenceWrite is on', () => {
    localStorage.setItem('sentenceRead', 'false');
    localStorage.setItem('sentenceWrite', 'true');
    renderWithProviders(<Settings />, { store: makeStore() });
    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    expect(checkbox).not.toBeDisabled();
  });

  it('updates the estimated test time when toggled on', async () => {
    const user = userEvent.setup();
    // Ensure sentence stages are enabled so the checkbox is active
    localStorage.setItem('numWords', '10');
    renderWithProviders(<Settings />, { store: makeStore() });

    const estimateEl = screen.getByText(/estimated test time:/i);
    const initialText = estimateEl.textContent;

    const checkbox = screen.getByRole('checkbox', { name: /sentence stages for all words/i });
    await user.click(checkbox);

    expect(estimateEl.textContent).not.toBe(initialText);
  });
});
