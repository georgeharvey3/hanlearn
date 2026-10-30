/**
 * Tests for the Settings page: six groups that open and close. A closed group
 * shows its values in one line. Every control writes its value to
 * localStorage, where the session reads it.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../firebase/auth', () => ({
  getCurrentUser: () => ({ email: 'learner@example.com' }),
  logoutUser: () => Promise.resolve(),
}));

import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import Settings from './Settings';
import { renderWithProviders, createTestStore } from '../../test/utils';

function makeStore(speechAvailable = true, synthAvailable = true, userId: string | null = 'u1') {
  return createTestStore({
    auth: { userId, loading: false, initialized: true, modalOpen: false },
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

const renderSettings = (store = makeStore()) => renderWithProviders(<Settings />, { store });

const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

/** Opens a group by its header and returns the header. */
async function open(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(header(name));
  return header(name);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Settings — accessibility', () => {
  it('has no accessibility violations with every group open', async () => {
    const { container } = renderSettings();
    // fireEvent, not userEvent: axe on six open groups is slow enough already.
    for (const name of [
      'Study session',
      'Answers',
      'Skill focus',
      'Session stages',
      'Sound',
      'Account',
    ]) {
      fireEvent.click(header(name));
    }
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);
});

describe('Settings — groups', () => {
  it('starts with every group closed', () => {
    renderSettings();
    for (const name of [
      'Study session',
      'Answers',
      'Skill focus',
      'Session stages',
      'Sound',
      'Account',
    ]) {
      expect(header(name)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows the values of each closed group in one line', () => {
    renderSettings();
    expect(header('Study session')).toHaveTextContent(/25 questions · ~\d+ min · Traditional/);
    expect(header('Answers')).toHaveTextContent('Meaning: Flashcard · Pinyin: Input');
    expect(header('Skill focus')).toHaveTextContent('Balanced');
    expect(header('Session stages')).toHaveTextContent(
      'New words, Test, Translate sentences, Make sentences',
    );
    expect(header('Sound')).toHaveTextContent('Text-to-speech · Sound effects');
    expect(header('Account')).toHaveTextContent('learner@example.com');
  });

  it('opens a group, and hides its line of values while open', async () => {
    const user = userEvent.setup();
    renderSettings();
    const session = await open(user, 'Study session');
    expect(session).toHaveAttribute('aria-expanded', 'true');
    expect(session).not.toHaveTextContent('25 questions');
    await user.click(session);
    expect(session).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Settings — Session', () => {
  it('reads the questions per session, and migrates the old words per session', () => {
    localStorage.setItem('numWords', '4');
    renderSettings();
    expect(header('Study session')).toHaveTextContent('20 questions');
  });

  it('steps the questions per session by 5, from 5 to 50', async () => {
    const user = userEvent.setup();
    localStorage.setItem('questionsPerSession', '45');
    renderSettings();
    await open(user, 'Study session');

    const more = screen.getByRole('button', { name: 'More questions' });
    await user.click(more);
    expect(localStorage.getItem('questionsPerSession')).toBe('50');
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(more).toBeDisabled();
  });

  it('stops at 5 questions', async () => {
    const user = userEvent.setup();
    localStorage.setItem('questionsPerSession', '10');
    renderSettings();
    await open(user, 'Study session');
    const fewer = screen.getByRole('button', { name: 'Fewer questions' });
    await user.click(fewer);
    expect(localStorage.getItem('questionsPerSession')).toBe('5');
    expect(fewer).toBeDisabled();
  });

  it('shows the time a session takes, and updates it with the size', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Study session');
    const before = screen.getByText(/^About \d+ min$/).textContent;
    await user.click(screen.getByRole('button', { name: 'Fewer questions' }));
    expect(screen.getByText(/^About \d+ min$/).textContent).not.toBe(before);
  });

  it('switches the characters and stores the choice', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Study session');
    const characters = screen.getByRole('radiogroup', { name: 'Characters' });
    expect(within(characters).getByRole('radio', { name: 'Traditional' })).toBeChecked();

    await user.click(within(characters).getByRole('radio', { name: 'Simplified' }));
    expect(localStorage.getItem('charSet')).toBe('simp');
    expect(within(characters).getByRole('radio', { name: 'Simplified' })).toBeChecked();
  });
});

describe('Settings — Answers', () => {
  it('stores each answer type on its own', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Answers');
    const meaning = screen.getByRole('radiogroup', { name: 'Meaning' });
    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    expect(within(meaning).getByRole('radio', { name: 'Flashcard' })).toBeChecked();
    expect(within(pinyin).getByRole('radio', { name: 'Input' })).toBeChecked();

    await user.click(within(pinyin).getByRole('radio', { name: 'Flashcard' }));
    expect(localStorage.getItem('pinyinQuizType')).toBe('flashcard');
    expect(localStorage.getItem('meaningQuizType')).toBeNull();
  });

  it('turns off Auto-start microphone, with the reason, when no answer is typed', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Answers');
    const mic = screen.getByRole('switch', { name: /Auto-start microphone/ });
    expect(mic).toBeChecked();

    const pinyin = screen.getByRole('radiogroup', { name: 'Pinyin' });
    await user.click(within(pinyin).getByRole('radio', { name: 'Flashcard' }));
    expect(mic).toBeDisabled();
    expect(mic).not.toBeChecked();
    expect(mic).toHaveTextContent('Set Meaning or Pinyin to Input first');
  });

  it('stores the handwriting switch', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Answers');
    await user.click(screen.getByRole('switch', { name: 'Handwriting' }));
    expect(localStorage.getItem('useHandwriting')).toBe('false');
  });
});

describe('Settings — Focus', () => {
  it('stores the focus, and shows it on the closed header', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Skill focus');
    const only = screen.getByRole('switch', { name: 'Only this skill' });
    expect(only).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Listening' }));
    expect(localStorage.getItem('priority')).toBe('MP');
    await user.click(only);
    expect(localStorage.getItem('onlyPriority')).toBe('true');

    await user.click(header('Skill focus'));
    expect(header('Skill focus')).toHaveTextContent('Listening only');
  });

  it('offers Pronunciation, the character question that asks for the pinyin', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Skill focus');

    await user.click(screen.getByRole('radio', { name: 'Pronunciation' }));
    expect(localStorage.getItem('priority')).toBe('PC');
  });

  it('keeps a stored Pronunciation focus', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'PC');
    renderSettings();
    await open(user, 'Skill focus');

    expect(screen.getByRole('radio', { name: 'Pronunciation' })).toBeChecked();
  });

  it('turns off Only this skill when the focus goes back to none', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'MC');
    localStorage.setItem('onlyPriority', 'true');
    renderSettings();
    await open(user, 'Skill focus');
    await user.click(screen.getByRole('radio', { name: 'Balanced' }));
    expect(localStorage.getItem('onlyPriority')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Only this skill' })).not.toBeChecked();
  });

  it('offers Writing only with handwriting, and ends a Writing focus without it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('priority', 'CM');
    renderSettings();
    await open(user, 'Answers');
    await open(user, 'Skill focus');
    expect(screen.getByRole('radio', { name: 'Writing' })).toBeEnabled();

    await user.click(screen.getByRole('switch', { name: 'Handwriting' }));
    expect(screen.getByRole('radio', { name: 'Writing' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Balanced' })).toBeChecked();
    expect(localStorage.getItem('priority')).toBe('none');
  });
});

describe('Settings — Stages', () => {
  it('stores a stage, and leaves it out of the closed header', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Session stages');
    await user.click(screen.getByRole('switch', { name: 'Make sentences' }));
    expect(localStorage.getItem('sentenceWrite')).toBe('false');

    await user.click(header('Session stages'));
    expect(header('Session stages')).toHaveTextContent('New words, Test, Translate sentences');
    expect(header('Session stages')).not.toHaveTextContent('Make sentences');
  });

  it('offers Translate with all words only with Translate sentences', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Session stages');
    const allWords = screen.getByRole('switch', { name: /Translate with all words/ });
    expect(allWords).not.toBeChecked();
    await user.click(allWords);
    expect(localStorage.getItem('sentenceStagesForAllWords')).toBe('true');

    await user.click(screen.getByRole('switch', { name: /^Translate sentences/ }));
    expect(allWords).toBeDisabled();
    expect(allWords).not.toBeChecked();
    expect(allWords).toHaveTextContent('Turn on Translate sentences first');
  });

  it('shortens the session time when a stage is turned off', async () => {
    const user = userEvent.setup();
    renderSettings();
    const before = header('Study session').textContent;
    await open(user, 'Session stages');
    await user.click(screen.getByRole('switch', { name: 'Make sentences' }));
    expect(header('Study session').textContent).not.toBe(before);
  });
});

describe('Settings — Sound', () => {
  it('stores each sound switch', async () => {
    const user = userEvent.setup();
    renderSettings();
    await open(user, 'Sound');
    await user.click(screen.getByRole('switch', { name: 'Text-to-speech' }));
    await user.click(screen.getByRole('switch', { name: 'Sound effects' }));
    expect(localStorage.getItem('useSound')).toBe('false');
    expect(localStorage.getItem('useSoundEffects')).toBe('false');

    await user.click(header('Sound'));
    expect(header('Sound')).toHaveTextContent('Off');
  });

  it('sets the iOS audio session type from the sound switches', async () => {
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    try {
      const user = userEvent.setup();
      renderSettings();
      await open(user, 'Sound');
      await user.click(screen.getByRole('switch', { name: 'Text-to-speech' }));
      expect(session.type).toBe('playback');
      await user.click(screen.getByRole('switch', { name: 'Sound effects' }));
      expect(session.type).toBe('ambient');
    } finally {
      Reflect.deleteProperty(navigator, 'audioSession');
    }
  });
});

describe('Settings — a browser without speech', () => {
  it('turns off the controls that need speech, with the reason', async () => {
    const user = userEvent.setup();
    localStorage.setItem('meaningQuizType', 'input');
    renderSettings(makeStore(false, false));
    for (const name of ['Answers', 'Session stages', 'Sound']) await open(user, name);

    for (const name of [
      /Auto-start microphone/,
      /^New words/,
      /^Translate sentences/,
      /^Text-to-speech/,
    ]) {
      const row = screen.getByRole('switch', { name });
      expect(row).toBeDisabled();
      expect(row).not.toBeChecked();
      expect(row).toHaveTextContent('Not supported in this browser');
    }
    expect(screen.getByRole('switch', { name: 'Make sentences' })).toBeEnabled();
  });
});

describe('Settings — Account', () => {
  it('shows the email of the learner, and logs out', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    renderSettings(store);
    await open(user, 'Account');
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(store.getState().auth.userId).toBeNull();
  });

  it('offers to log in when signed out', async () => {
    const user = userEvent.setup();
    const store = makeStore(true, true, null);
    renderSettings(store);
    expect(header('Account')).toHaveTextContent('Not signed in');
    await open(user, 'Account');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(store.getState().auth.modalOpen).toBe(true);
  });
});
