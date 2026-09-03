/**
 * Tests for resuming a session in the engine — issue #305.
 *
 * A resumed session asks what is left of the queue it saved and carries the
 * grades it already collected, so that the one write at the end reschedules
 * every question the learner answered, not only the ones after the reload.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('howler', () => ({
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
  },
}));

vi.mock('../../services/sentenceService', () => ({
  checkSentenceAvailability: vi.fn().mockResolvedValue(false),
  getHintSentence: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/ttsService', () => ({
  speak: vi.fn(),
  prefetch: vi.fn(),
  stopAll: vi.fn(),
}));

import { renderHook, act } from '@testing-library/react';

import { useTestEngine } from './useTestEngine';
import { Props } from './types';
import { QueuePair, Word, WordDirectionResults } from '../../types/models';
import { SessionPlan } from './Logic/TestLogic';
import { VocabProgress } from '../../utils/savedSession';

const makeWord = (id: number, simp: string): Word => ({
  id,
  simp,
  trad: simp,
  pinyin: 'nǐ hǎo',
  meaning: 'hello',
  level: 1,
  due_date: '2020/01/01',
});

const words = [makeWord(1, '你好'), makeWord(2, '再见'), makeWord(3, '谢谢')];

const pair = (index: string): QueuePair => ({ index, aCategory: 'M', qCategory: 'C' });

const plan: SessionPlan = {
  words,
  queue: [pair('0'), pair('1'), pair('2')],
  newWords: [],
};

/**
 * The props are built once per test and then held, because the engine's effects
 * depend on their identity: rebuilding them on every render re-runs the effect
 * that starts each question, which never settles.
 */
const makeProps = (overrides: Partial<Props> = {}): Props =>
  ({
    words,
    plan,
    userId: 'user-1',
    speechAvailable: false,
    synthAvailable: false,
    isDemo: false,
    onFinishTest: vi.fn(),
    history: { push: vi.fn(), replace: vi.fn() },
    location: { pathname: '/', search: '', hash: '', state: undefined },
    match: { isExact: true, params: {}, path: '/', url: '/' },
    ...overrides,
  }) as unknown as Props;

const renderEngine = (props: Props) => renderHook(() => useTestEngine(props));

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) =>
    key === 'useHandwriting' ? 'false' : null,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTestEngine — resuming a session', () => {
  it('asks the plan when there is nothing to resume', () => {
    const { result } = renderEngine(makeProps());

    expect(result.current.state.queue).toHaveLength(3);
    expect(result.current.state.initialQueueLength).toBe(3);
    expect(result.current.state.gradeList).toEqual([]);
  });

  it('asks what is left of the saved queue, and keeps its grades', () => {
    const resume: VocabProgress = {
      queue: [pair('2')],
      gradeList: [
        { wordId: 1, direction: 'MC', result: 'pass', toneErrors: 0 },
        { wordId: 2, direction: 'MC', result: 'fail', toneErrors: 0 },
      ],
      initialQueueLength: 3,
    };
    const { result } = renderEngine(makeProps({ resume }));

    expect(result.current.state.queue).toEqual([pair('2')]);
    expect(result.current.state.gradeList).toHaveLength(2);
    // The word the saved queue points at is the one on screen.
    expect(result.current.state.chosenCharacter).toBe('谢谢');
  });

  it('measures the bar against the whole session, not the part that is left', () => {
    const resume: VocabProgress = { queue: [pair('2')], gradeList: [], initialQueueLength: 3 };
    const { result } = renderEngine(makeProps({ resume }));

    expect(result.current.state.initialQueueLength).toBe(3);
  });

  it('reschedules the questions answered before the reload as well as after', () => {
    const onFinishTest = vi.fn();
    const resume: VocabProgress = {
      queue: [pair('2')],
      gradeList: [
        { wordId: 1, direction: 'MC', result: 'pass', toneErrors: 0 },
        { wordId: 2, direction: 'MC', result: 'fail', toneErrors: 0 },
      ],
      initialQueueLength: 3,
    };
    const { result } = renderEngine(makeProps({ resume, onFinishTest }));

    act(() => {
      result.current.onCorrectAnswer('pass');
    });

    expect(onFinishTest).toHaveBeenCalledTimes(1);
    const submitted = onFinishTest.mock.calls[0][0] as WordDirectionResults[];
    expect(submitted.map((entry) => entry.word_id).sort()).toEqual([1, 2, 3]);
    expect(submitted.find((entry) => entry.word_id === 2)?.directions.MC).toBe('fail');
  });
});

describe('useTestEngine — reporting progress', () => {
  it('reports the whole queue before the first answer', () => {
    const onProgress = vi.fn();
    renderEngine(makeProps({ onProgress }));

    expect(onProgress).toHaveBeenCalledWith({
      queue: plan.queue,
      gradeList: [],
      initialQueueLength: 3,
    });
  });

  it('reports the queue and the grade after each answer', () => {
    const onProgress = vi.fn();
    const { result } = renderEngine(makeProps({ onProgress }));
    onProgress.mockClear();

    act(() => {
      result.current.onCorrectAnswer('pass');
    });

    const reported = onProgress.mock.calls.at(-1)![0] as VocabProgress;
    expect(reported.queue).toHaveLength(2);
    expect(reported.gradeList).toEqual([
      { wordId: 1, direction: 'MC', result: 'pass', toneErrors: 0 },
    ]);
    expect(reported.initialQueueLength).toBe(3);
  });

  it('reports nothing in the demo', () => {
    const onProgress = vi.fn();
    renderEngine(makeProps({ onProgress, isDemo: true }));

    expect(onProgress).not.toHaveBeenCalled();
  });
});
