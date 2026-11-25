import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
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
  prefetch: vi.fn(),
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
// The real conversion, which a test can hold back to type during it.
vi.mock('../../utils/charSet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/charSet')>();
  return { ...actual, toCharSet: vi.fn(actual.toCharSet) };
});

import SentencePractice from './SentencePractice';
import { FocusModeProvider } from '../../components/Layout/focusMode';
import { renderWithProviders, authenticatedState, createTestStore } from '../../test/utils';
import { loadQueueData } from '../../services/sentenceTabsService';
import { saveGrade } from '../../services/sentencePracticeService';
import { getSegmentedSentence } from '../../services/sentenceService';
import { toCharSet } from '../../utils/charSet';
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
    index: Object.fromEntries(
      words.map((w) => [w.simp, { comprehend: `s-${w.simp}`, compose: `s-${w.simp}` }]),
    ),
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
  vi.mocked(ttsService.prefetch).mockClear();
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

  it('fetches the audio of the next sentence while the learner hears this one', async () => {
    setQueue([STUDY, READ]);
    renderTab('comprehend');

    await screen.findByRole('button', { name: 'Play sentence' });
    const played = vi.mocked(ttsService.speak).mock.calls[0][0];
    const next = played === '我学习中文。' ? '我看书中文。' : '我学习中文。';
    await waitFor(() => expect(ttsService.prefetch).toHaveBeenCalledWith(next, 1.0));
  });

  it('fetches no audio ahead with sound off', async () => {
    setQueue([STUDY, READ]);
    renderTab('comprehend', false);

    await screen.findByRole('button', { name: '中文: show meaning' });
    expect(ttsService.prefetch).not.toHaveBeenCalled();
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

  /** Type an answer into the input, in place of its text, and check it. */
  const attempt = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    const input = await screen.findByLabelText('Your answer');
    await user.clear(input);
    await user.type(input, text);
    await user.click(screen.getByRole('button', { name: 'Check' }));
  };

  it('reveals a first-attempt match, and saves it right', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose');

    await screen.findByLabelText('Your answer');
    expect(screen.queryByRole('button', { name: 'Give up' })).not.toBeInTheDocument();
    await attempt(user, '我学习中文');

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(screen.getByText('I 学习 Chinese.')).toBeInTheDocument();
    const answer = screen.getByText('Your answer').nextElementSibling as HTMLElement;
    expect(answer).toHaveTextContent('我学习中文');
    const reference = screen.getByText('Original').nextElementSibling as HTMLElement;
    expect(within(reference).getByText(/wǒ xué xí/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report sentence' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Right' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wrong' })).not.toBeInTheDocument();

    expect(saveGrade).toHaveBeenCalledTimes(1);
    expect(saveGrade).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        wordId: 1,
        tab: 'compose',
        grade: 'right',
        mode: 'audio',
        gaveUp: false,
        lookups: 0,
        attempts: [{ answer: '我学习中文', answerMs: expect.any(Number), lookups: 0 }],
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/1 right/)).toBeInTheDocument();
    expect(saveGrade).toHaveBeenCalledTimes(1);
  });

  it('ignores punctuation and spaces in the compare', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '我 学习, 中文!');

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(saveGrade).toHaveBeenCalledWith('user-1', expect.objectContaining({ grade: 'right' }));
  });

  it('marks a wrong attempt, keeps its text in the input, and saves nothing', async () => {
    const user = userEvent.setup();
    localStorage.setItem('charSet', 'simp');
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '学习我在中文');

    const marks = await screen.findByRole('group', { name: 'Last attempt' });
    expect(within(marks).getByLabelText('学: placed')).toBeInTheDocument();
    expect(within(marks).getByLabelText('我: misplaced')).toBeInTheDocument();
    expect(within(marks).getByLabelText('在: extra')).toBeInTheDocument();
    // The gap does not show the missing characters.
    expect(within(marks).getByLabelText('Missing')).toHaveTextContent('');
    expect(screen.getByLabelText('Your answer')).toHaveValue('学习我在中文');
    expect(screen.queryByText('Original')).not.toBeInTheDocument();
    expect(saveGrade).not.toHaveBeenCalled();

    // Only the latest attempt shows its marks.
    await attempt(user, '我在学习中文');
    await waitFor(() =>
      expect(
        within(screen.getByRole('group', { name: 'Last attempt' })).getByLabelText('我: placed'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('我: misplaced')).not.toBeInTheDocument();
  });

  it('saves a later match wrong, with each attempt and the lookups before it', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose', false);

    await user.click(await screen.findByRole('button', { name: 'I: show Chinese' }));
    await attempt(user, '我在学习');
    await screen.findByRole('group', { name: 'Last attempt' });
    // The English words stay open to lookups on each attempt.
    await user.click(screen.getByRole('button', { name: 'Chinese.: show Chinese' }));
    await user.click(screen.getByRole('button', { name: 'I: show Chinese' }));
    await user.click(screen.getByRole('button', { name: 'I: show Chinese' }));
    await attempt(user, '我学习中文');

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(saveGrade).toHaveBeenCalledTimes(1);
    expect(saveGrade).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        grade: 'wrong',
        gaveUp: false,
        lookups: 3,
        attempts: [
          { answer: '我在学习', answerMs: expect.any(Number), lookups: 1 },
          { answer: '我学习中文', answerMs: expect.any(Number), lookups: 2 },
        ],
      }),
    );
  });

  it('offers Give up after a wrong attempt, which shows the reference and saves wrong', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '我在学习');
    await user.click(await screen.findByRole('button', { name: 'Give up' }));

    const answer = screen.getByText('Your answer').nextElementSibling as HTMLElement;
    expect(answer).toHaveTextContent('我在学习');
    const reference = screen.getByText('Original').nextElementSibling as HTMLElement;
    expect(reference).toHaveTextContent('我学习中文。');
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(saveGrade).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        grade: 'wrong',
        gaveUp: true,
        attempts: [{ answer: '我在学习', answerMs: expect.any(Number), lookups: 0 }],
      }),
    );
  });

  it('plays the reference only on request', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose');

    await attempt(user, '我学习中文');
    await screen.findByText('Original');
    expect(ttsService.speak).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Play sentence' }));
    expect(ttsService.speak).toHaveBeenCalledWith('我学习中文。', expect.anything());
  });

  it('offers no play button with sound off', async () => {
    const user = userEvent.setup();
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '我学习中文');
    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play sentence' })).not.toBeInTheDocument();
  });

  it('reads the pinyin of a traditional sentence from its simplified text', async () => {
    const user = userEvent.setup();
    vi.mocked(getSegmentedSentence).mockImplementation(async (_simp, _charSet, id) =>
      traditionalSentence(id ?? 'none'),
    );
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '我的蘋果沒了');

    const reference = (await screen.findByText('Original')).nextElementSibling as HTMLElement;
    expect(reference).toHaveTextContent('我的蘋果沒了。');
    expect(within(reference).getByText('wǒ de píng guǒ méi le。')).toBeInTheDocument();
  });

  it('matches a simplified answer to a traditional reference', async () => {
    const user = userEvent.setup();
    vi.mocked(getSegmentedSentence).mockImplementation(async (_simp, _charSet, id) =>
      traditionalSentence(id ?? 'none'),
    );
    setQueue([STUDY]);
    renderTab('compose', false);

    await attempt(user, '我的苹果没了');

    expect(await screen.findByText('Original')).toBeInTheDocument();
    expect(saveGrade).toHaveBeenCalledWith('user-1', expect.objectContaining({ grade: 'right' }));
  });

  describe('with a spoken answer', () => {
    // The recognizer gives simplified text in each character set (#494).
    let recognizer: Record<string, (event?: unknown) => void> = {};
    const say = (transcript: string) =>
      act(() => {
        recognizer.result?.({ results: [[{ transcript }]] });
        recognizer.end?.();
      });

    beforeEach(() => {
      recognizer = {};
      class FakeRecognition {
        lang = '';
        start = vi.fn(() => recognizer.audiostart?.());
        abort = vi.fn();
        addEventListener = (event: string, handler: (e?: unknown) => void) => {
          recognizer[event] = handler;
        };
      }
      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
        FakeRecognition;
    });

    const speakAnswer = async (charSet: 'simp' | 'trad', transcript: string) => {
      const user = userEvent.setup();
      localStorage.setItem('charSet', charSet);
      setQueue([{ ...STUDY, trad: '學習' }]);
      renderTab('compose');
      await user.click(await screen.findByRole('button', { name: 'Record speech' }));
      say(transcript);
      const check = screen.getByRole('button', { name: 'Check' });
      await waitFor(() => expect(check).toBeEnabled());
      // The recognized text goes into the input before the check.
      expect(screen.getByLabelText('Your answer')).not.toHaveValue('');
      await user.click(check);
      return (await screen.findByText('Your answer')).nextElementSibling as HTMLElement;
    };

    it('shows a traditional answer, with the target highlighted, for the traditional set', async () => {
      const answer = await speakAnswer('trad', '我学习中文');

      expect(answer).toHaveTextContent('我學習中文');
      expect(within(answer).getByText('學習').tagName).toBe('SPAN');
      expect(saveGrade).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          grade: 'right',
          attempts: [expect.objectContaining({ answer: '我學習中文' })],
        }),
      );
    });

    it('keeps a typed answer when a conversion ends after it', async () => {
      const user = userEvent.setup();
      let convert: (text: string) => void = () => {};
      vi.mocked(toCharSet).mockImplementationOnce(
        () => new Promise((resolve) => (convert = resolve)),
      );
      setQueue([{ ...STUDY, trad: '學習' }]);
      renderTab('compose');
      await user.click(await screen.findByRole('button', { name: 'Record speech' }));
      say('我在学习');

      const input = screen.getByLabelText('Your answer');
      await user.type(input, '我學中文');
      await act(async () => convert('我在學習'));

      expect(input).toHaveValue('我學中文');
    });

    it('keeps the transcript unchanged for the simplified set', async () => {
      const answer = await speakAnswer('simp', '我学习中文');

      expect(answer).toHaveTextContent('我学习中文');
      expect(saveGrade).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          grade: 'right',
          attempts: [expect.objectContaining({ answer: '我学习中文' })],
        }),
      );
    });
  });

  describe('in tile mode', () => {
    // The answer tiles of 我学习中文。, then the near-miss tiles.
    const TILES = Array.from('我学习中文写字闻觉门');
    const withTiles = () =>
      vi.mocked(getSegmentedSentence).mockImplementation(async (simp, _charSet, id) => {
        const found = sentenceOf(simp, id ?? 'none');
        return { ...found, sentence: { ...found.sentence, tiles: TILES } };
      });
    const tileButton = (char: string) =>
      within(screen.getByRole('group', { name: 'Tiles left' })).getByRole('button', {
        name: char,
      });
    const placeTiles = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
      for (const char of Array.from(text)) await user.click(tileButton(char));
    };

    it('grades an exact match right at the check, and saves the tiles shown', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      renderTab('compose', false);

      await user.click(await screen.findByRole('button', { name: 'Tiles' }));
      // Tile mode gives no help: the English words open nothing.
      expect(screen.queryByRole('button', { name: 'I: show Chinese' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
      const check = screen.getByRole('button', { name: 'Check' });

      await placeTiles(user, '我学习中文');
      await user.click(check);

      expect(screen.getByRole('status')).toHaveTextContent('Right');
      const reference = screen.getByText('Original').nextElementSibling as HTMLElement;
      expect(reference).toHaveTextContent('我学习中文。');
      expect(screen.queryByRole('button', { name: 'Wrong' })).not.toBeInTheDocument();
      expect(saveGrade).toHaveBeenCalledTimes(1);
      const saved = vi.mocked(saveGrade).mock.calls[0][1];
      expect(saved).toMatchObject({
        tab: 'compose',
        grade: 'right',
        input: 'tiles',
        answer: '我学习中文',
        lookups: 0,
      });
      expect([...('tiles' in saved ? (saved.tiles ?? []) : [])].sort()).toEqual([...TILES].sort());

      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByText(/1 right/)).toBeInTheDocument();
      expect(saveGrade).toHaveBeenCalledTimes(1);
    });

    it('grades the right characters in another order wrong', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      renderTab('compose', false);

      await user.click(await screen.findByRole('button', { name: 'Tiles' }));
      await placeTiles(user, '学习我中文');
      await user.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByRole('status')).toHaveTextContent('Wrong');
      expect(saveGrade).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ grade: 'wrong', answer: '学习我中文' }),
      );
    });

    it('puts a placed tile back when the learner taps it', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      renderTab('compose', false);

      await user.click(await screen.findByRole('button', { name: 'Tiles' }));
      await placeTiles(user, '我');
      await user.click(screen.getByRole('button', { name: 'Remove 我' }));

      expect(tileButton('我')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove 我' })).not.toBeInTheDocument();
    });

    it('lets a learner who is stuck check with no tile, and grades it wrong', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      renderTab('compose', false);

      await user.click(await screen.findByRole('button', { name: 'Tiles' }));
      await user.click(screen.getByRole('button', { name: 'Check' }));

      expect(screen.getByRole('status')).toHaveTextContent('Wrong');
      expect(saveGrade).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ grade: 'wrong', input: 'tiles', answer: '' }),
      );
    });

    it('keeps the choice between visits', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      const first = renderTab('compose', false);
      await user.click(await screen.findByRole('button', { name: 'Tiles' }));
      first.unmount();

      renderTab('compose', false);
      expect(await screen.findByRole('group', { name: 'Tiles left' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Free answer' }));
      expect(screen.getByLabelText('Your answer')).toBeInTheDocument();
      expect(localStorage.getItem('composeInput')).toBe('free');
    });

    it('shows only the free answer for a sentence with no tiles', async () => {
      localStorage.setItem('composeInput', 'tiles');
      setQueue([STUDY]);
      renderTab('compose', false);

      expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tiles' })).not.toBeInTheDocument();
    });

    it('logs the free answer by its attempts, with no tiles', async () => {
      const user = userEvent.setup();
      withTiles();
      setQueue([STUDY]);
      renderTab('compose', false);

      await user.type(await screen.findByLabelText('Your answer'), '我学习中文');
      await user.click(screen.getByRole('button', { name: 'Check' }));

      await screen.findByText('Original');
      const saved = vi.mocked(saveGrade).mock.calls[0][1];
      expect(saved).toMatchObject({
        attempts: [expect.objectContaining({ answer: '我学习中文' })],
      });
      expect(saved).not.toHaveProperty('tiles');
      expect(saved).not.toHaveProperty('input');
    });
  });

  it('uses only words at bank 3 or more', async () => {
    setQueue([word(1, '学习', 2)]);
    renderTab('compose');

    expect(await screen.findByText('Nothing to practise')).toBeInTheDocument();
  });
});
