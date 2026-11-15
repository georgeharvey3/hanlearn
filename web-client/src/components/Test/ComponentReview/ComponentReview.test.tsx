/**
 * Tests for the component review shown after a missed character question.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../services/breakdownService', () => ({
  breakdownOf: vi.fn(),
}));

vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));

vi.mock('../../../utils/charDataLoader', () => ({
  loadCharData: vi.fn(),
  onCharDataError: vi.fn(),
}));

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ComponentReview from './ComponentReview';
import { clearCharacterGlossCache } from './glossCache';
import { Breakdown, breakdownOf } from '../../../services/breakdownService';
import { searchWord } from '../../../services/dictionaryService';
import { loadCharData } from '../../../utils/charDataLoader';
import { Word } from '../../../types/models';

const mockedSearchWord = vi.mocked(searchWord);
const mockedBreakdownOf = vi.mocked(breakdownOf);
const mockedLoadCharData = vi.mocked(loadCharData);

const dictionaryEntry = (char: string, pinyin: string, meaning: string): Word => ({
  id: char.codePointAt(0) ?? 0,
  simp: char,
  trad: char,
  pinyin,
  meaning,
});

// The breakdown file of 疑, as the build writes it (#528), with the parts of
// its parts cut: this ticket shows one level only.
const YI: Breakdown = {
  c: '疑',
  p: [
    { c: '匕', s: [0, 1], l: 'spoon', y: 'bǐ' },
    { c: '矢', s: [2, 3, 4, 5, 6], l: 'arrow', y: 'shǐ' },
    { c: null, s: [7, 8], l: null },
    { c: '疋', s: [9, 10, 11, 12, 13], l: 'roll', y: 'pǐ' },
  ],
};

const AI: Breakdown = {
  c: '礙',
  p: [
    { c: '石', s: [0, 1, 2, 3, 4], l: 'stone', y: 'shí', r: 'meaning' },
    {
      c: '疑',
      s: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      l: 'to doubt',
      y: 'yí',
      r: 'sound',
    },
  ],
};

const strokesOf = (count: number) => ({
  strokes: Array.from({ length: count }, (_, i) => `M ${i} 0 L ${i} 10 Z`),
  medians: Array.from({ length: count }, (_, i) => [
    [i, 0],
    [i, 10],
  ]),
});

beforeEach(() => {
  vi.clearAllMocks();
  clearCharacterGlossCache();
  mockedSearchWord.mockImplementation(async (char: string) => {
    if (char === '你') return [dictionaryEntry('你', 'nǐ', 'you')];
    if (char === '好') return [dictionaryEntry('好', 'hǎo', 'good')];
    return [];
  });
  mockedBreakdownOf.mockImplementation(async (char: string) =>
    char === '礙' ? AI : char === '疑' ? YI : { c: char, p: null },
  );
  mockedLoadCharData.mockImplementation((char, onLoad) =>
    onLoad(strokesOf(char === '礙' ? 19 : 14)),
  );
});

describe('ComponentReview', () => {
  it('renders nothing when the question offered no characters', () => {
    const { container } = render(
      <ComponentReview chars={[]} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pinyin and meaning of every character without being asked', async () => {
    render(<ComponentReview chars={['你', '好']} charSet="trad" open={false} onToggle={vi.fn()} />);

    expect(await screen.findByText('nǐ')).toBeInTheDocument();
    expect(await screen.findByText('you')).toBeInTheDocument();
    expect(await screen.findByText('hǎo')).toBeInTheDocument();
    expect(await screen.findByText('good')).toBeInTheDocument();
    expect(mockedSearchWord).toHaveBeenCalledWith('你', 'trad');
    expect(mockedSearchWord).toHaveBeenCalledWith('好', 'trad');
  });

  it('says so when a character is not in the dictionary', async () => {
    render(<ComponentReview chars={['〇']} charSet="trad" open={false} onToggle={vi.fn()} />);

    expect(await screen.findByText('Not in the dictionary')).toBeInTheDocument();
  });

  it('says so when the lookup fails', async () => {
    mockedSearchWord.mockRejectedValue(new Error('offline'));

    render(<ComponentReview chars={['好']} charSet="trad" open={false} onToggle={vi.fn()} />);

    expect(await screen.findByText('Definition unavailable')).toBeInTheDocument();
  });

  it('offers the breakdown without fetching it until it is asked for', async () => {
    render(<ComponentReview chars={['好']} charSet="trad" open={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show components' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await waitFor(() => expect(mockedSearchWord).toHaveBeenCalled());
    expect(mockedBreakdownOf).not.toHaveBeenCalled();
  });

  it('reports the toggle', async () => {
    const onToggle = vi.fn();
    render(<ComponentReview chars={['好']} charSet="trad" open={false} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show components' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('draws each character of the review split into its parts, one chip each', async () => {
    render(<ComponentReview chars={['礙', '疑']} charSet="trad" open onToggle={vi.fn()} />);

    const ai = await screen.findByTestId('breakdown-礙');
    expect(within(ai).getByRole('button', { name: '石' })).toBeInTheDocument();
    expect(within(ai).getByRole('button', { name: '疑' })).toBeInTheDocument();
    const yi = await screen.findByTestId('breakdown-疑');
    expect(within(yi).getAllByRole('button')).toHaveLength(4);
  });

  it('shows the label, pinyin and clue of a tapped chip', async () => {
    render(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '石' }));

    const line = screen.getByTestId('part-line');
    expect(line).toHaveTextContent('stone');
    expect(line).toHaveTextContent('shí');
    expect(line).toHaveTextContent('meaning clue');
  });

  it('replaces the line of the first part when a second part is tapped', async () => {
    render(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '石' }));
    await userEvent.click(screen.getByRole('button', { name: '疑' }));

    const lines = screen.getAllByTestId('part-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent('to doubt');
    expect(lines[0]).toHaveTextContent('yí');
    expect(lines[0]).toHaveTextContent('sound clue');
    expect(lines[0]).not.toHaveTextContent('stone');
    expect(screen.getByRole('button', { name: '疑' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '石' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the line of a part tapped on the character itself', async () => {
    render(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const ai = await screen.findByTestId('breakdown-礙');
    const hits = await within(ai).findAllByTestId('stroke-hit');
    await userEvent.click(hits[2]);

    expect(screen.getByTestId('part-line')).toHaveTextContent('stone');
  });

  it('makes the tap area of a stroke wider than the stroke', async () => {
    render(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const hits = await screen.findAllByTestId('stroke-hit');
    expect(hits).toHaveLength(19);
    for (const hit of hits) {
      expect(Number(hit.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(40);
    }
  });

  it('says that a part with no label has no name of its own', async () => {
    render(<ComponentReview chars={['疑']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'no name of its own' }));

    expect(screen.getByTestId('part-line')).toHaveTextContent('no name of its own');
  });

  it('says so when a character does not split', async () => {
    render(<ComponentReview chars={['一']} charSet="trad" open onToggle={vi.fn()} />);

    expect(await screen.findByText('No components')).toBeInTheDocument();
  });

  it('offers a retry when the breakdown does not load', async () => {
    mockedBreakdownOf.mockRejectedValueOnce(new Error('offline'));
    render(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: '石' })).toBeInTheDocument();
  });
});
