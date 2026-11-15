import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
  analytics: null,
}));
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: { ctx: null } }));
// The audio ends at once, as a short clip does.
vi.mock('../../services/ttsService', () => ({
  speak: vi.fn((_text: string, options?: { onEnd?: () => void }) => options?.onEnd?.()),
  stopAll: vi.fn(),
}));
vi.mock('../../services/sentenceTabsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../../services/sentenceTabsService',
  );
  return { ...actual, loadQueueData: vi.fn() };
});
vi.mock('../../services/sentencePracticeService', () => ({
  saveGrade: vi.fn().mockResolvedValue(undefined),
  loadPractice: vi.fn(),
}));
vi.mock('../../services/sentenceService', () => ({ getSegmentedSentence: vi.fn() }));
vi.mock('../../services/dictionaryService', () => ({ searchWord: vi.fn() }));
vi.mock('../../services/wordService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../services/wordService');
  return { ...actual, addWordToList: vi.fn() };
});
vi.mock('../../services/analyticsService', () => ({ trackFeatureUsage: vi.fn() }));
vi.mock('../../services/errorReporting', () => ({ reportError: vi.fn() }));

import SentencePractice from './SentencePractice';
import { FocusModeProvider } from '../../components/Layout/focusMode';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import { loadQueueData } from '../../services/sentenceTabsService';
import { saveGrade } from '../../services/sentencePracticeService';
import { getSegmentedSentence } from '../../services/sentenceService';
import * as ttsService from '../../services/ttsService';
import { searchWord } from '../../services/dictionaryService';
import { addWordToList } from '../../services/wordService';
import { makeDirections } from '../../utils/directions';
import { Word } from '../../types/models';
import { PracticeByWord } from '../../utils/sentenceQueue';

const inDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

const word = (id: number, simp: string, level = 3): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: '',
  meaning: '',
  level,
  due_date: inDays(10),
  directions: makeDirections(level, inDays(10)),
});

const STUDY = word(1, '学习');
const READ = word(2, '看书');

/** A sentence of the files: 我学习中文。 with 学习 as the target. */
const sentenceOf = (target: string, id: string) => ({
  sentence: {
    id,
    chinese: {
      sentence: `我${target}中文。`,
      simplified: `我${target}中文。`,
      highlight: [[1, 1 + target.length]],
      segments: [
        { s: '我', t: '我', p: 'wǒ', e: 'I; me' },
        { s: target, t: target, p: 'xué xí', e: 'to study' },
        { s: '中文', t: '中文', p: 'Zhōng wén', e: 'Chinese' },
        { s: '。', t: '。', p: '', e: '' },
      ],
      targetIndex: 1,
    },
    english: { sentence: `I ${target} Chinese.`, highlight: [] },
  },
  totalCount: 1,
});

/** A traditional sentence: pinyin-pro misreads 蘋 as "pín" (#492). */
const traditionalSentence = (id: string) => ({
  sentence: {
    id,
    chinese: {
      sentence: '我的蘋果沒了。',
      simplified: '我的苹果没了。',
      highlight: [[2, 4]],
      segments: [
        { s: '我', t: '我', p: 'wǒ', e: 'I; me' },
        { s: '的', t: '的', p: 'de', e: 'of' },
        { s: '苹果', t: '蘋果', p: 'píng guǒ', e: 'apple' },
        { s: '没', t: '沒', p: 'méi', e: 'not have' },
        { s: '了', t: '了', p: 'le', e: 'completed action marker' },
        { s: '。', t: '。', p: '', e: '' },
      ],
      targetIndex: 2,
    },
    english: { sentence: 'My apple is gone.', highlight: [] },
  },
  totalCount: 1,
});

function setQueue(words: Word[], practice: PracticeByWord = {}) {
  vi.mocked(loadQueueData).mockResolvedValue({
    words,
    practice,
    index: Object.fromEntries(words.map((w) => [w.simp, [`s-${w.simp}`]])),
  });
}

function renderTab(
  tab: 'comprehend' | 'compose',
  sound = true,
  setFocused: (focused: boolean) => void = () => {},
) {
  const state = authenticatedState('user-1');
  const store = createTestStore({
    ...state,
    settings: { speechAvailable: sound, synthAvailable: sound },
  });
  return renderWithProviders(
    <FocusModeProvider value={setFocused}>
      <SentencePractice tab={tab} />
    </FocusModeProvider>,
    { store },
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveGrade).mockClear();
  vi.mocked(ttsService.speak).mockClear();
  vi.mocked(getSegmentedSentence).mockImplementation(async (simp, _charSet, id) =>
    sentenceOf(simp, id ?? 'none'),
  );
});

describe('the Comprehend tab', () => {
  it('plays the sentence with the Chinese hidden, and shows the text on request', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('comprehend');

    expect(await screen.findByRole('button', { name: 'Play sentence' })).toBeInTheDocument();
    expect(ttsService.speak).toHaveBeenCalledWith('我学习中文。', expect.anything());
    expect(screen.queryByRole('button', { name: '中文: show meaning' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show text' }));
    expect(screen.getByRole('button', { name: '中文: show meaning' })).toBeInTheDocument();
  });

  it('shows the Chinese at once with sound off', async () => {
    setQueue([STUDY]);
    renderTab('comprehend', false);

    expect(await screen.findByRole('button', { name: '中文: show meaning' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play sentence' })).not.toBeInTheDocument();
  });

  it('locks the target word until the reveal, which shows the pinyin and the English', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('comprehend', false);

    await screen.findByRole('button', { name: '中文: show meaning' });
    expect(screen.queryByRole('button', { name: '学习: show meaning' })).not.toBeInTheDocument();
    expect(screen.queryByText('I 学习 Chinese.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show English' }));

    expect(screen.getByText('I 学习 Chinese.')).toBeInTheDocument();
    expect(screen.getByText(/wǒ xué xí/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学习: show meaning' })).toBeInTheDocument();
  });

  it.each([
    ['sound on', true],
    ['sound off', false],
  ])('names the word above the card only after the reveal, with %s', async (_mode, sound) => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('comprehend', sound);

    await screen.findByRole('button', { name: 'Show English' });
    expect(screen.queryByText(/Sentence with/)).not.toBeInTheDocument();
    // With sound off the sentence shows the word; nothing outside it may.
    const outsideSentence = screen.queryAllByText('学习').filter((el) => !el.closest('p'));
    expect(outsideSentence).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Show English' }));

    expect(screen.getByText(/Sentence with/)).toHaveTextContent('Sentence with 学习');
  });

  it('reads the pinyin of a traditional sentence from its simplified text', async () => {
    const user = userEvent.setup();
    vi.mocked(getSegmentedSentence).mockImplementation(async (_simp, _charSet, id) =>
      traditionalSentence(id ?? 'none'),
    );
    setQueue([STUDY]);
    renderTab('comprehend', false);

    await user.click(await screen.findByRole('button', { name: 'Show English' }));

    expect(screen.getByText('wǒ de píng guǒ méi le。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '沒: show meaning' })).toBeInTheDocument();
  });

  it('saves the grade with the mode, the reveal of the text and the lookups', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('comprehend');

    await user.click(await screen.findByRole('button', { name: 'Show text' }));
    await user.click(screen.getByRole('button', { name: '中文: show meaning' }));
    // A tap that closes the panel is no lookup.
    await user.click(screen.getByRole('button', { name: '中文: show meaning' }));
    await user.click(screen.getByRole('button', { name: 'Show English' }));
    await user.click(screen.getByRole('button', { name: 'Wrong' }));

    expect(saveGrade).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        wordId: 1,
        sentenceId: 's-学习',
        tab: 'comprehend',
        grade: 'wrong',
        mode: 'audio',
        revealed: true,
        lookups: 1,
      }),
    );
  });

  it('shows the meaning of a tapped word under the sentence, one word at a time', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('comprehend', false);

    await user.click(await screen.findByRole('button', { name: '中文: show meaning' }));
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    const panel = screen.getByRole('group', { name: '中文' });
    expect(within(panel).getByText('Zhōng wén')).toBeInTheDocument();
    expect(within(panel).getByText('Chinese')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '我: show meaning' }));
    expect(screen.queryByRole('group', { name: '中文' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: '我' })).getByText('I · me'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '我: show meaning' }));
    expect(screen.queryByRole('group', { name: '我' })).not.toBeInTheDocument();
  });

  it('plays a word from its panel, and adds it to the list', async () => {
    const user = userEvent.setup();
    vi.mocked(searchWord).mockResolvedValue([
      { id: 7, simp: '中文', trad: '中文', pinyin: 'zhong1 wen2', meaning: 'Chinese' } as Word,
    ]);
    vi.mocked(addWordToList).mockResolvedValue(null);
    setQueue([STUDY]);
    renderTab('comprehend', false);

    await user.click(await screen.findByRole('button', { name: '中文: show meaning' }));
    const panel = screen.getByRole('group', { name: '中文' });
    await user.click(within(panel).getByRole('button', { name: 'Play pronunciation' }));
    expect(ttsService.speak).toHaveBeenCalledWith('中文', expect.anything());

    await user.click(within(panel).getByRole('button', { name: 'Add to list' }));
    expect(await within(panel).findByRole('button', { name: 'Added' })).toBeDisabled();
    expect(addWordToList).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 7 }),
      expect.anything(),
    );
  });

  it('runs a set of the size of the setting, then offers more', async () => {
    const user = userEvent.setup();
    localStorage.setItem('comprehendPerSet', '1');
    setQueue([STUDY, READ]);
    renderTab('comprehend', false);

    expect(await screen.findByText('1 / 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show English' }));
    await user.click(screen.getByRole('button', { name: 'Right' }));

    expect(await screen.findByText('1 right · 0 wrong')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Practise more' }));

    // The word just graded right goes to the end, so the next set starts with the other.
    await user.click(await screen.findByRole('button', { name: 'Show English' }));
    expect(screen.getByText('I 看书 Chinese.')).toBeInTheDocument();
  });

  it('keeps focus mode on for the finish screen', async () => {
    const user = userEvent.setup();
    const setFocused = vi.fn();
    localStorage.setItem('comprehendPerSet', '1');
    setQueue([STUDY, READ]);
    renderTab('comprehend', false, setFocused);

    await user.click(await screen.findByRole('button', { name: 'Show English' }));
    await user.click(screen.getByRole('button', { name: 'Right' }));

    expect(await screen.findByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument();
    expect(setFocused).toHaveBeenLastCalledWith(true);
  });

  it('says there is nothing to practise, with a link to Study', async () => {
    const setFocused = vi.fn();
    setQueue([word(1, '学习', 1)]);
    renderTab('comprehend', true, setFocused);

    expect(await screen.findByText('Nothing to practise')).toBeInTheDocument();
    // The empty state keeps the navigation of the app.
    expect(setFocused).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('link', { name: 'Go to Study' })).toHaveAttribute(
      'href',
      '/test-words',
    );
  });
});

describe('the Compose tab', () => {
  it('needs an answer before the reveal', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose', false);

    const check = await screen.findByRole('button', { name: 'Check' });
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(check).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Record speech' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Your answer'), '我学习');
    expect(check).toBeEnabled();
  });

  it('shows the answer above the reference, plays it, and saves the raw answer', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose');

    await user.type(await screen.findByLabelText('Your answer'), '我在学习');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    const answer = screen.getByText('Your answer').nextElementSibling as HTMLElement;
    expect(answer).toHaveTextContent('我在学习');
    const reference = screen.getByText('Original').nextElementSibling as HTMLElement;
    expect(within(reference).getByText(/wǒ xué xí/)).toBeInTheDocument();
    expect(ttsService.speak).toHaveBeenCalledWith('我学习中文。', expect.anything());

    await user.click(screen.getByRole('button', { name: 'Right' }));
    expect(saveGrade).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        wordId: 1,
        tab: 'compose',
        grade: 'right',
        mode: 'audio',
        answer: '我在学习',
      }),
    );
  });

  it('reads the pinyin of a traditional sentence from its simplified text', async () => {
    const user = userEvent.setup();
    vi.mocked(getSegmentedSentence).mockImplementation(async (_simp, _charSet, id) =>
      traditionalSentence(id ?? 'none'),
    );
    setQueue([STUDY]);
    renderTab('compose', false);

    await user.type(await screen.findByLabelText('Your answer'), '我的蘋果');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    const reference = screen.getByText('Original').nextElementSibling as HTMLElement;
    expect(reference).toHaveTextContent('我的蘋果沒了。');
    expect(within(reference).getByText('wǒ de píng guǒ méi le。')).toBeInTheDocument();
  });

  it('uses only words at bank 3 or more', async () => {
    setQueue([word(1, '学习', 2)]);
    renderTab('compose');

    expect(await screen.findByText('Nothing to practise')).toBeInTheDocument();
  });
});
