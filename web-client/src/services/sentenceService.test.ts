import { vi, describe, it, expect, beforeEach } from 'vitest';

import fixture from './fixtures/sentences-5b66.json';

type Service = typeof import('./sentenceService');

const fetchMock = vi.fn();

/** A response of Hosting: the file, a 404, or the app shell of the SPA rewrite. */
const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * A fresh copy of the service for each test, so that the in-memory copy of
 * the files starts empty.
 */
async function loadService(): Promise<Service> {
  vi.resetModules();
  return import('./sentenceService');
}

describe('sentenceService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      url === '/sentences/5b66.json' ? jsonResponse(fixture) : new Response('', { status: 404 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  describe('getSegmentedSentence', () => {
    it('reads the file of the first character of the word', async () => {
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('学生', 'simp', 0);

      expect(fetchMock).toHaveBeenCalledWith('/sentences/5b66.json');
      expect(result.totalCount).toBe(2);
      expect(result.sentence?.id).toBe('s1');
      expect(result.sentence?.chinese.sentence).toBe('学生们，听好了！');
      expect(result.sentence?.english.sentence).toBe('Listen up, students!');
    });

    it('keeps each fetched file in memory for the session', async () => {
      const { getSegmentedSentence, getHintSentence } = await loadService();

      await getSegmentedSentence('学生', 'simp', 0);
      await getSegmentedSentence('学习', 'trad', 0);
      await getHintSentence('学生');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('shows the traditional text of the data', async () => {
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('学生', 'trad', 0);

      expect(result.sentence?.chinese.sentence).toBe('學生們，聽好了！');
      expect(result.sentence?.chinese.highlight).toEqual([[0, 2]]);
    });

    it('keeps the punctuation between segments as segments with no entry', async () => {
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('学生', 'trad', 0);
      const segments = result.sentence!.chinese.segments;

      expect(segments.map((segment) => segment.t)).toEqual([
        '學生',
        '們',
        '，',
        '聽',
        '好',
        '了',
        '！',
      ]);
      expect(segments[2]).toEqual({ s: '，', t: '，', p: '', e: '' });
      expect(result.sentence!.chinese.targetIndex).toBe(0);
    });

    it('moves the target index past the punctuation before it', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({
          你: [
            {
              id: 'p1',
              simp: '姐，你去哪儿？',
              trad: '姐，你去哪兒？',
              english: 'Sis, where are you going?',
              segments: [
                { s: '姐', t: '姐', p: 'jiě', e: 'older sister' },
                { s: '你', t: '你', p: 'nǐ', e: 'you' },
                { s: '去', t: '去', p: 'qù', e: 'to go' },
                { s: '哪儿', t: '哪兒', p: 'nǎ r', e: 'where?' },
              ],
              targetIndex: 1,
            },
          ],
        }),
      );
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('你', 'simp', 0);
      const { segments, targetIndex } = result.sentence!.chinese;

      expect(segments[targetIndex].s).toBe('你');
      expect(segments.map((segment) => segment.s).join('')).toBe('姐，你去哪儿？');
    });

    it('wraps an offset past the last sentence back to the start', async () => {
      const { getSegmentedSentence } = await loadService();

      expect((await getSegmentedSentence('学生', 'simp', 1)).sentence?.id).toBe('s2');
      expect((await getSegmentedSentence('学生', 'simp', 2)).sentence?.id).toBe('s1');
    });

    it('gives no sentence for a word with none in its file', async () => {
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('学校', 'simp', 0);

      expect(result).toEqual({ sentence: null, totalCount: 0 });
    });

    it('gives no sentence when the file does not exist', async () => {
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('电脑', 'simp', 0);

      expect(result).toEqual({ sentence: null, totalCount: 0 });
    });

    it('gives no sentence when Hosting answers with the app page in place of a file', async () => {
      fetchMock.mockImplementation(
        async () =>
          new Response('<!doctype html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
      );
      const { getSegmentedSentence } = await loadService();

      const result = await getSegmentedSentence('电脑', 'simp', 0);

      expect(result).toEqual({ sentence: null, totalCount: 0 });
    });

    it('throws on a server error, and keeps no empty copy of the file', async () => {
      fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
      const { getSegmentedSentence } = await loadService();

      await expect(getSegmentedSentence('学生', 'simp', 0)).rejects.toThrow('503');
      expect((await getSegmentedSentence('学生', 'simp', 0)).sentence?.id).toBe('s1');
    });

    it('keeps the segments as they are when one is not in the text', async () => {
      fetchMock.mockImplementation(async () =>
        jsonResponse({
          你: [
            {
              id: 'bad',
              simp: '你，去！',
              trad: '你，去！',
              english: 'You, go!',
              segments: [
                { s: '你', t: '你', p: 'nǐ', e: 'you' },
                { s: '来', t: '來', p: 'lái', e: 'to come' },
                { s: '去', t: '去', p: 'qù', e: 'to go' },
              ],
              targetIndex: 2,
            },
          ],
        }),
      );
      const { getSegmentedSentence } = await loadService();

      const { segments, targetIndex } = (await getSegmentedSentence('你', 'simp', 0)).sentence!
        .chinese;

      expect(segments.map((segment) => segment.s)).toEqual(['你', '来', '去']);
      expect(targetIndex).toBe(2);
    });

    it('leaves out a sentence that the learner reported', async () => {
      const { getSegmentedSentence } = await loadService();
      const { markSentenceReported } = await import('../utils/reportedSentences');

      markSentenceReported('s1');
      const result = await getSegmentedSentence('学生', 'simp', 0);

      expect(result.totalCount).toBe(1);
      expect(result.sentence?.id).toBe('s2');
    });

    it('throws when the network fails, and reads the file again on the next call', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const { getSegmentedSentence } = await loadService();

      await expect(getSegmentedSentence('学生', 'simp', 0)).rejects.toThrow('Failed to fetch');
      const result = await getSegmentedSentence('学生', 'simp', 0);

      expect(result.sentence?.id).toBe('s1');
    });
  });

  describe('getHintSentence', () => {
    it('gives the simplified text and the English of one sentence of the word', async () => {
      const { getHintSentence } = await loadService();

      const hint = await getHintSentence('学习');

      expect(hint).toEqual({ chinese: '我在学习中文。', english: 'I am studying Chinese.' });
    });

    it('gives null for a word with no sentences', async () => {
      const { getHintSentence } = await loadService();

      expect(await getHintSentence('电脑')).toBeNull();
    });
  });

  describe('checkSentenceAvailability', () => {
    it('is true for a word with sentences', async () => {
      const { checkSentenceAvailability } = await loadService();

      expect(await checkSentenceAvailability('学生', 'trad')).toBe(true);
    });

    it('is false for a word with no sentences', async () => {
      const { checkSentenceAvailability } = await loadService();

      expect(await checkSentenceAvailability('学校', 'simp')).toBe(false);
    });
  });

  describe('takeSentenceStart', () => {
    it('starts at 0 and moves on by two for each session', async () => {
      const { takeSentenceStart } = await loadService();

      expect(takeSentenceStart('学生')).toBe(0);
      expect(takeSentenceStart('学生')).toBe(2);
      expect(takeSentenceStart('学习')).toBe(0);
    });
  });
});
