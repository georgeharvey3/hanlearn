/**
 * Tests for NewWords: the introduction of new words before the test.
 *
 * Each word goes through three steps, Understand, Speak and Write. A step can
 * be skipped, and so can the rest of the introduction. The steps record no
 * result, so the only way out is `startTest`.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));
vi.mock('../../../services/decompositionService', () => ({
  decomposeCharacter: vi.fn(),
}));
vi.mock('../../../services/errorReporting', () => ({ reportError: vi.fn() }));
vi.mock('../../../services/ttsService', () => ({
  speak: vi.fn(),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

import React from 'react';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NewWords from './NewWords';
import { renderWithProviders, authenticatedState, createTestStore } from '../../../test/utils';
import { Word } from '../../../types/models';
import { searchWord } from '../../../services/dictionaryService';
import { decomposeCharacter } from '../../../services/decompositionService';
import { clearCharacterGlossCache } from '../ComponentReview/glossCache';

const makeWord = (id: number, simp: string, pinyin: string, meaning: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin,
  meaning,
  level: 1,
  due_date: new Date().toISOString(),
});

const diannao = makeWord(1, '电脑', 'dian4 nao3', 'computer/CL:臺|台[tai2]');
const xiuxi = makeWord(2, '休息', 'xiu1 xi5', 'rest/to take a break');

function makeStore(speechAvailable = true) {
  return createTestStore({
    ...authenticatedState(),
    settings: { speechAvailable, synthAvailable: false, lang: 'zh-CN' },
  });
}

// The trace box: a Hanzi Writer quiz that the test completes by hand.
let completeTrace: () => void = () => {};
function installHanziWriter() {
  (window as unknown as { HanziWriter: unknown }).HanziWriter = {
    create: () => ({
      quiz: ({ onComplete }: { onComplete: () => void }) => {
        completeTrace = onComplete;
      },
    }),
  };
}

// The speech recognizer: the test plays its events.
let recognizer: Record<string, (event?: unknown) => void> = {};
function installRecognition() {
  class FakeRecognition {
    lang = '';
    start = vi.fn(() => recognizer.audiostart?.());
    stop = vi.fn();
    abort = vi.fn();
    addEventListener = (event: string, handler: (e?: unknown) => void) => {
      recognizer[event] = handler;
    };
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    FakeRecognition;
}

const render = (words: Word[], startTest = vi.fn(), speechAvailable = true) =>
  renderWithProviders(<NewWords words={words} startTest={startTest} />, {
    store: makeStore(speechAvailable),
  });

const currentStep = () =>
  within(screen.getByRole('navigation', { name: 'Steps' }))
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-current') === 'step')?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  clearCharacterGlossCache();
  localStorage.clear();
  recognizer = {};
  installHanziWriter();
  installRecognition();
  vi.mocked(searchWord).mockImplementation(async (char: string) =>
    char === '电'
      ? [makeWord(10, '电', 'dian4', 'electric/electricity')]
      : [makeWord(11, char, 'nao3', 'brain/mind/head')],
  );
  vi.mocked(decomposeCharacter).mockResolvedValue([
    { char: '日', meaning: 'sun', pinyin: 'rì' },
    { char: '乚', meaning: 'hidden', pinyin: 'yǐn' },
  ]);
});

describe('NewWords — the session bar and the steps', () => {
  it('shows the stage, the word count and the Understand step first', () => {
    render([diannao, xiuxi]);
    expect(screen.getByText('New words')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(currentStep()).toBe('Understand');
  });

  it('Continue walks from Understand to Speak to Write', async () => {
    const user = userEvent.setup();
    render([diannao]);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(currentStep()).toBe('Speak');
    expect(screen.getByText('Say the word')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(currentStep()).toBe('Write');
  });

  it('a tap on the rail opens that step', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await user.click(screen.getByRole('button', { name: 'Write' }));
    expect(currentStep()).toBe('Write');
  });
});

describe('NewWords — Understand', () => {
  it('lists each character with its pinyin and senses', async () => {
    render([diannao]);
    const row = screen.getByRole('button', { name: /^电/ });
    expect(await within(row).findByText('electric · electricity')).toBeInTheDocument();
    expect(within(row).getByText('diàn')).toBeInTheDocument();
  });

  it("shows the word's own reading of a character, not every reading", async () => {
    vi.mocked(searchWord).mockResolvedValue([
      makeWord(12, '行', 'xing2', 'to walk'),
      makeWord(13, '行', 'hang2', 'row'),
    ]);
    render([makeWord(3, '银行', 'yin2 hang2', 'bank')]);
    const row = screen.getByRole('button', { name: /^行/ });
    expect(await within(row).findByText('to walk · row')).toBeInTheDocument();
    expect(within(row).getByText('háng')).toBeInTheDocument();
  });

  it('a tap on a character opens its parts in place', async () => {
    const user = userEvent.setup();
    render([diannao]);
    const row = screen.getByRole('button', { name: /^电/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');

    await user.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('日')).toBeInTheDocument();
    expect(screen.getByText('hidden')).toBeInTheDocument();
    expect(decomposeCharacter).toHaveBeenCalledWith('电');
  });

  it('offers Try again when the parts fail to load', async () => {
    const user = userEvent.setup();
    vi.mocked(decomposeCharacter).mockRejectedValueOnce(new Error('offline'));
    render([diannao]);

    await user.click(screen.getByRole('button', { name: /^电/ }));
    expect(await screen.findByText('Parts didn’t load')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('日')).toBeInTheDocument();
  });
});

describe('NewWords — Speak', () => {
  const toSpeak = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Continue' }));

  it('keeps Continue off until the learner says something', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await toSpeak(user);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('shows each heard syllable and "Well said" for a match', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await toSpeak(user);

    await user.click(screen.getByRole('button', { name: 'Record speech' }));
    expect(screen.getByText('Listening…')).toBeInTheDocument();
    act(() => {
      recognizer.result({ results: [[{ transcript: '电脑' }]] });
      recognizer.end();
    });

    expect(screen.getByText('Heard')).toBeInTheDocument();
    expect(screen.getByText('Well said')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('says "Check the tones" when only a tone is wrong', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await toSpeak(user);

    await user.click(screen.getByRole('button', { name: 'Record speech' }));
    act(() => {
      recognizer.result({ results: [[{ transcript: '电挠' }]] });
      recognizer.end();
    });

    expect(screen.getByText('Check the tones')).toBeInTheDocument();
    expect(screen.getByText('náo')).toBeInTheDocument();
  });

  it('says it heard nothing when the recognizer ends without a result', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await toSpeak(user);

    await user.click(screen.getByRole('button', { name: 'Record speech' }));
    act(() => recognizer.end());

    expect(screen.getByText('Heard nothing. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('turns the microphone off without speech input', async () => {
    const user = userEvent.setup();
    render([diannao], vi.fn(), false);
    await toSpeak(user);

    expect(screen.getByText('Speech input is not available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record speech' })).toBeDisabled();
  });
});

describe('NewWords — Write', () => {
  const toWrite = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Write' }));

  it('traces each character in turn, then enables Next word', async () => {
    const user = userEvent.setup();
    render([diannao, xiuxi]);
    await toWrite(user);

    expect(screen.getByRole('img', { name: 'Trace 电 here' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next word' })).toBeDisabled();

    act(() => completeTrace());
    expect(screen.getByRole('img', { name: 'Trace 脑 here' })).toBeInTheDocument();

    act(() => completeTrace());
    expect(screen.getByText('Traced')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next word' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(currentStep()).toBe('Understand');
  });

  it('keeps a traced word traced after a jump to another step', async () => {
    const user = userEvent.setup();
    render([diannao, xiuxi]);
    await toWrite(user);
    act(() => completeTrace());
    act(() => completeTrace());

    await user.click(screen.getByRole('button', { name: 'Understand' }));
    await toWrite(user);

    expect(screen.getByText('Traced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next word' })).toBeEnabled();
  });

  it('Skip on the last word starts the test', async () => {
    const user = userEvent.setup();
    const startTest = vi.fn();
    render([diannao], startTest);
    await toWrite(user);

    expect(screen.getByRole('button', { name: 'Start test' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(startTest).toHaveBeenCalledTimes(1);
  });
});

describe('NewWords — Skip to test', () => {
  it('ends the introduction from any step', async () => {
    const user = userEvent.setup();
    const startTest = vi.fn();
    render([diannao, xiuxi], startTest);

    await user.click(screen.getByRole('button', { name: 'Skip to test' }));
    expect(startTest).toHaveBeenCalledTimes(1);
  });
});
