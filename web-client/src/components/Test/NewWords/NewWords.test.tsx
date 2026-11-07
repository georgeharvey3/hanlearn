/**
 * Tests for NewWords: the introduction of new words before the test.
 *
 * Each word goes through three steps, Understand, Speak and Write. Continue
 * moves on from any step, finished or not, and Skip to test ends the
 * introduction. The steps record no
 * result, so the only way out is `startTest`.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../firebase/config', () => ({ auth: {}, db: {}, functions: {}, ai: {} }));
vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));
vi.mock('../../../services/decompositionService', () => ({
  decomposeCharacter: vi.fn(),
}));
vi.mock('../../../services/sentenceService', () => ({ getSegmentedSentence: vi.fn() }));
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
import { getSegmentedSentence } from '../../../services/sentenceService';
import * as ttsService from '../../../services/ttsService';
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
// 我的电脑很新。 The build writes the Han segments; the service adds the gaps.
const segment = (s: string, t: string) => ({ s, t, p: '', e: '' });
const diannaoSentence = {
  sentence: {
    id: 's1',
    chinese: {
      sentence: '我的电脑很新。',
      highlight: [[2, 4]],
      segments: [
        segment('我的', '我的'),
        segment('电脑', '電腦'),
        segment('很新', '很新'),
        segment('。', '。'),
      ],
      targetIndex: 1,
    },
    english: { sentence: 'My computer is new.', highlight: [] },
  },
  totalCount: 2,
};

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
  vi.mocked(getSegmentedSentence).mockResolvedValue({ sentence: null, totalCount: 0 });
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

    await user.click(screen.getByRole('button', { name: 'Continue' }));
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

describe('NewWords — Understand: the example sentence', () => {
  const example = () => screen.findByRole('group', { name: 'Example' });

  it('shows the first sentence of the word, the word highlighted, and its English', async () => {
    localStorage.setItem('charSet', 'simp');
    vi.mocked(getSegmentedSentence).mockResolvedValue(diannaoSentence);
    render([diannao]);

    const block = await example();
    expect(getSegmentedSentence).toHaveBeenCalledWith('电脑', 'simp');
    expect(within(block).getByText('电脑', { selector: 'mark' })).toBeInTheDocument();
    expect(block).toHaveTextContent('我的电脑很新。');
    expect(within(block).getByText('My computer is new.')).toBeInTheDocument();
  });

  it('shows the traditional text when the learner reads traditional', async () => {
    localStorage.setItem('charSet', 'trad');
    vi.mocked(getSegmentedSentence).mockResolvedValue({
      ...diannaoSentence,
      sentence: {
        ...diannaoSentence.sentence,
        chinese: { ...diannaoSentence.sentence.chinese, sentence: '我的電腦很新。' },
      },
    });
    render([{ ...diannao, trad: '電腦' }]);

    const block = await example();
    expect(getSegmentedSentence).toHaveBeenCalledWith('电脑', 'trad');
    expect(within(block).getByText('電腦', { selector: 'mark' })).toBeInTheDocument();
    expect(block).toHaveTextContent('我的電腦很新。');
  });

  it('the play button reads the sentence aloud', async () => {
    const user = userEvent.setup();
    localStorage.setItem('charSet', 'simp');
    localStorage.setItem('useSound', 'false');
    vi.mocked(getSegmentedSentence).mockResolvedValue(diannaoSentence);
    render([diannao]);

    await user.click(within(await example()).getByRole('button', { name: 'Play sentence' }));

    expect(ttsService.speak).toHaveBeenCalledWith('我的电脑很新。', expect.anything());
  });

  it('shows no block and no message for a word with no sentence', async () => {
    render([diannao]);
    await act(async () => {});
    expect(getSegmentedSentence).toHaveBeenCalled();
    expect(screen.queryByText('Example')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading example' })).not.toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('shows no block and no error when the fetch fails', async () => {
    vi.mocked(getSegmentedSentence).mockRejectedValue(new Error('offline'));
    render([diannao]);
    await act(async () => {});
    expect(screen.queryByText('Example')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('NewWords — Speak', () => {
  const toSpeak = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Continue' }));

  it('Continue opens Write before the learner says anything (#443)', async () => {
    const user = userEvent.setup();
    render([diannao]);
    await toSpeak(user);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(currentStep()).toBe('Write');
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
  // A traced character flashes for a second before the next one.
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const toWrite = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Write' }));

  it('traces each character in turn, then Next word opens the next word', async () => {
    const user = userEvent.setup();
    render([diannao, xiuxi]);
    await toWrite(user);

    expect(screen.getByRole('img', { name: 'Trace 电 here' })).toBeInTheDocument();

    act(() => completeTrace());
    expect(screen.getByRole('img', { name: 'Trace 电 here' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('img', { name: 'Trace 脑 here' })).toBeInTheDocument();

    act(() => completeTrace());
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Traced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next word' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(currentStep()).toBe('Understand');
  });

  it('keeps a traced word traced after a jump to another step', async () => {
    const user = userEvent.setup();
    render([diannao, xiuxi]);
    await toWrite(user);
    act(() => completeTrace());
    act(() => vi.advanceTimersByTime(1000));
    act(() => completeTrace());
    act(() => vi.advanceTimersByTime(1000));

    await user.click(screen.getByRole('button', { name: 'Understand' }));
    await toWrite(user);

    expect(screen.getByText('Traced')).toBeInTheDocument();
  });

  it('Start test on the last word starts the test, traced or not', async () => {
    const user = userEvent.setup();
    const startTest = vi.fn();
    render([diannao], startTest);
    await toWrite(user);

    await user.click(screen.getByRole('button', { name: 'Start test' }));
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
