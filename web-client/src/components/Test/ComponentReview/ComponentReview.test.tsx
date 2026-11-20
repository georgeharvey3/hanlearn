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

vi.mock('../../../services/partReportService', () => ({
  reportPart: vi.fn(),
}));

vi.mock('../../../services/errorReporting', () => ({
  reportError: vi.fn(),
}));

vi.mock('../../../utils/charDataLoader', () => ({
  loadCharData: vi.fn(),
  onCharDataError: vi.fn(),
}));

import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { copy } from '../../../copy';
import ComponentReview from './ComponentReview';
import { clearCharacterGlossCache } from './glossCache';
import { Breakdown, breakdownOf } from '../../../services/breakdownService';
import { searchWord } from '../../../services/dictionaryService';
import { loadCharData } from '../../../utils/charDataLoader';
import { reportPart } from '../../../services/partReportService';
import { partInk } from '../../../theme';
import { authenticatedState, createTestStore, renderWithProviders } from '../../../test/utils';
import { Word } from '../../../types/models';

const mockedSearchWord = vi.mocked(searchWord);
const mockedBreakdownOf = vi.mocked(breakdownOf);
const mockedLoadCharData = vi.mocked(loadCharData);
const mockedReportPart = vi.mocked(reportPart);

const dictionaryEntry = (char: string, pinyin: string, meaning: string): Word => ({
  id: char.codePointAt(0) ?? 0,
  simp: char,
  trad: char,
  pinyin,
  meaning,
});

// The breakdown files of 疑 and 礙, as the build writes them (#528). The
// strokes of a part of a part count in the strokes of the top character.
const YI: Breakdown = {
  c: '疑',
  p: [
    { c: '匕', s: [0, 1], l: 'spoon', y: 'bǐ' },
    { c: '矢', s: [2, 3, 4, 5, 6], l: 'arrow', y: 'shǐ' },
    { c: null, s: [7, 8], l: null },
    { c: '疋', s: [9, 10, 11, 12, 13], l: 'foot', y: 'pǐ' },
  ],
};

const AI: Breakdown = {
  c: '礙',
  p: [
    { c: '石', s: [0, 1, 2, 3, 4], l: 'stone', y: 'shí' },
    {
      c: '疑',
      s: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      l: 'to doubt',
      y: 'yí',
      p: [
        { c: '匕', s: [5, 6], l: 'spoon', y: 'bǐ' },
        { c: '矢', s: [7, 8, 9, 10, 11], l: 'arrow', y: 'shǐ' },
        { c: null, s: [12, 13], l: null },
        { c: '疋', s: [14, 15, 16, 17, 18], l: 'foot', y: 'pǐ' },
      ],
    },
  ],
  o: {
    m: { c: '石', l: 'stone', s: [0, 1, 2, 3, 4] },
    n: { c: '疑', y: 'yí', s: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  },
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

const chipNames = (breakdown: HTMLElement) =>
  within(breakdown)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent);

describe('ComponentReview', () => {
  it('renders nothing when the question offered no characters', () => {
    const { container } = renderWithProviders(
      <ComponentReview chars={[]} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pinyin and meaning of every character without being asked', async () => {
    renderWithProviders(
      <ComponentReview chars={['你', '好']} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(await screen.findByText('nǐ')).toBeInTheDocument();
    expect(await screen.findByText('you')).toBeInTheDocument();
    expect(await screen.findByText('hǎo')).toBeInTheDocument();
    expect(await screen.findByText('good')).toBeInTheDocument();
    expect(mockedSearchWord).toHaveBeenCalledWith('你', 'trad');
    expect(mockedSearchWord).toHaveBeenCalledWith('好', 'trad');
  });

  it('heads the rows with the title it is given', async () => {
    renderWithProviders(
      <ComponentReview
        chars={['你']}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        title={copy.test.missedCharacters}
      />,
    );

    expect(screen.getByText('Missed characters')).toBeInTheDocument();
    expect(await screen.findByText('nǐ')).toBeInTheDocument();
  });

  it('says so when a character is not in the dictionary', async () => {
    renderWithProviders(
      <ComponentReview chars={['〇']} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(await screen.findByText('Not in the dictionary')).toBeInTheDocument();
  });

  it('says so when the lookup fails', async () => {
    mockedSearchWord.mockRejectedValue(new Error('offline'));

    renderWithProviders(
      <ComponentReview chars={['好']} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(await screen.findByText('Definition unavailable')).toBeInTheDocument();
  });

  it('offers the breakdown without fetching it until it is asked for', async () => {
    renderWithProviders(
      <ComponentReview chars={['好']} charSet="trad" open={false} onToggle={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Show components' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await waitFor(() => expect(mockedSearchWord).toHaveBeenCalled());
    expect(mockedBreakdownOf).not.toHaveBeenCalled();
  });

  it('reports the toggle', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <ComponentReview chars={['好']} charSet="trad" open={false} onToggle={onToggle} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show components' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('draws each character of the review split into its parts, one chip each', async () => {
    renderWithProviders(
      <ComponentReview chars={['礙', '疑']} charSet="trad" open onToggle={vi.fn()} />,
    );

    const ai = await screen.findByTestId('breakdown-礙');
    expect(within(ai).getByRole('button', { name: '石' })).toBeInTheDocument();
    expect(within(ai).getByRole('button', { name: '疑' })).toBeInTheDocument();
    const yi = await screen.findByTestId('breakdown-疑');
    expect(within(yi).getAllByRole('button')).toHaveLength(4);
  });

  it('shows the label and pinyin of a tapped chip, with no clue chip', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '石' }));

    const line = screen.getByTestId('part-line');
    expect(line).toHaveTextContent('stone');
    expect(line).toHaveTextContent('shí');
    expect(line).not.toHaveTextContent(/clue/);
  });

  it('replaces the line of the first part when a second part is tapped', async () => {
    renderWithProviders(<ComponentReview chars={['疑']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '匕' }));
    await userEvent.click(screen.getByRole('button', { name: '矢' }));

    const lines = screen.getAllByTestId('part-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent('arrow');
    expect(lines[0]).toHaveTextContent('shǐ');
    expect(lines[0]).not.toHaveTextContent('spoon');
    expect(screen.getByRole('button', { name: '矢' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '匕' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the line of a part that splits', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: '疑' }));

    const line = screen.getByTestId('part-line');
    expect(line).toHaveTextContent('yí');
    expect(line).not.toHaveTextContent('The smallest part here');
  });

  it('shows the meaning-and-sound origin at once, each part in its ink', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const origin = await screen.findByTestId('origin');
    expect(origin).toHaveTextContent(copy.test.origin);
    expect(origin).toHaveTextContent(
      `${copy.test.originMeaning}: 石 stone · ${copy.test.originSound}: 疑 yí`,
    );
    const parts = within(origin).getAllByTestId('origin-part');
    expect(parts.map((part) => part.textContent)).toEqual(['石', '疑']);
    expect(parts[0]).toHaveStyle({ color: partInk[0] });
    expect(parts[1]).toHaveStyle({ color: partInk[1] });
  });

  it('shows one side only, and a part that no stroke matches in plain text', async () => {
    mockedBreakdownOf.mockResolvedValue({ ...AI, o: { n: { c: '矣', y: 'yǐ' } } });
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const origin = await screen.findByTestId('origin');
    expect(origin).toHaveTextContent(`${copy.test.originSound}: 矣 yǐ`);
    expect(origin).not.toHaveTextContent(copy.test.originMeaning);
    expect(within(origin).queryByTestId('origin-part')).not.toBeInTheDocument();
  });

  it('shows the line of a part tapped on the character itself', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const ai = await screen.findByTestId('breakdown-礙');
    const hits = await within(ai).findAllByTestId('stroke-hit');
    await userEvent.click(hits[2]);

    expect(screen.getByTestId('part-line')).toHaveTextContent('stone');
  });

  it('makes the tap area of a stroke wider than the stroke', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    const hits = await screen.findAllByTestId('stroke-hit');
    expect(hits).toHaveLength(19);
    for (const hit of hits) {
      expect(Number(hit.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(40);
    }
  });

  it('says that a part with no label has no name of its own', async () => {
    renderWithProviders(<ComponentReview chars={['疑']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'no name of its own' }));

    expect(screen.getByTestId('part-line')).toHaveTextContent('no name of its own');
  });

  it('says so when a character does not split', async () => {
    renderWithProviders(<ComponentReview chars={['一']} charSet="trad" open onToggle={vi.fn()} />);

    expect(await screen.findByText('No components')).toBeInTheDocument();
  });

  it('offers a retry when the stroke data does not load', async () => {
    mockedLoadCharData.mockImplementationOnce((_char, _onLoad, onError) =>
      onError(new Error('offline')),
    );
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: '石' })).toBeInTheDocument();
  });

  it('offers a retry when the breakdown does not load', async () => {
    mockedBreakdownOf.mockRejectedValueOnce(new Error('offline'));
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: '石' })).toBeInTheDocument();
  });

  it('splits a tapped part into its own parts and fades the rest', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);
    const ai = await screen.findByTestId('breakdown-礙');

    await userEvent.click(within(ai).getByRole('button', { name: '疑' }));

    expect(chipNames(ai)).toEqual(['匕', '矢', 'no name of its own', '疋', '‹ Back to 礙']);
    expect(screen.getByTestId('part-line')).toHaveTextContent('to doubt');
    const faded = within(ai).getAllByTestId('stroke-faded');
    expect(faded).toHaveLength(5);
  });

  it('jumps to a faded part tapped on the character', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);
    const ai = await screen.findByTestId('breakdown-礙');
    await userEvent.click(within(ai).getByRole('button', { name: '疑' }));

    // Stroke 2 is in 石, which faded when 疑 split.
    await userEvent.click(within(ai).getAllByTestId('stroke-hit')[2]);

    expect(screen.getByTestId('part-line')).toHaveTextContent('stone');
    expect(within(ai).getByRole('button', { name: '石' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(ai).getAllByTestId('stroke-faded')).toHaveLength(14);
  });

  it('goes back one step, and starts again from the whole character', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);
    const ai = await screen.findByTestId('breakdown-礙');
    await userEvent.click(within(ai).getByRole('button', { name: '疑' }));
    await userEvent.click(within(ai).getByRole('button', { name: '矢' }));

    await userEvent.click(within(ai).getByRole('button', { name: '‹ Back to 疑' }));
    expect(screen.getByTestId('part-line')).toHaveTextContent('to doubt');
    expect(chipNames(ai)).toContain('‹ Back to 礙');

    await userEvent.click(within(ai).getByRole('button', { name: '矢' }));
    await userEvent.click(within(ai).getByRole('button', { name: 'Start again' }));
    expect(chipNames(ai)).toEqual(['石', '疑']);
    expect(screen.queryByTestId('part-line')).not.toBeInTheDocument();
    expect(within(ai).queryAllByTestId('stroke-faded')).toHaveLength(0);
  });

  it('says so when a tapped part does not split any more', async () => {
    renderWithProviders(<ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />);
    const ai = await screen.findByTestId('breakdown-礙');
    await userEvent.click(within(ai).getByRole('button', { name: '疑' }));

    await userEvent.click(within(ai).getByRole('button', { name: '矢' }));

    const line = screen.getByTestId('part-line');
    expect(line).toHaveTextContent('arrow');
    expect(line).toHaveTextContent('The smallest part here');
  });

  describe('the report of a wrong breakdown', () => {
    const signedIn = () => ({ store: createTestStore(authenticatedState('user-1')) });
    const send = async (reason?: string) => {
      await userEvent.click(screen.getByRole('button', { name: 'Report breakdown' }));
      if (reason)
        await userEvent.type(screen.getByRole('textbox', { name: 'Reason (optional)' }), reason);
      await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    };

    it('saves the character, the part, the label shown and the reason', async () => {
      mockedReportPart.mockResolvedValue();
      renderWithProviders(
        <ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />,
        signedIn(),
      );
      const ai = await screen.findByTestId('breakdown-礙');
      await userEvent.click(within(ai).getByRole('button', { name: '疑' }));
      await userEvent.click(within(ai).getByRole('button', { name: '矢' }));

      await send('  The arrow is not here  ');

      expect(mockedReportPart).toHaveBeenCalledWith('user-1', {
        char: '礙',
        parent: '疑',
        part: '矢',
        strokes: [7, 8, 9, 10, 11],
        label: 'arrow',
        reason: 'The arrow is not here',
      });
      const line = screen.getByTestId('part-line');
      expect(within(line).getByRole('button', { name: 'Reported' })).toBeDisabled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('saves no reason when the learner gives none', async () => {
      mockedReportPart.mockResolvedValue();
      renderWithProviders(
        <ComponentReview chars={['疑']} charSet="trad" open onToggle={vi.fn()} />,
        signedIn(),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'no name of its own' }));

      await send();

      expect(mockedReportPart).toHaveBeenCalledWith('user-1', {
        char: '疑',
        parent: '疑',
        part: null,
        strokes: [7, 8],
        label: null,
        reason: null,
      });
    });

    it('saves nothing until the learner sends the report', async () => {
      renderWithProviders(
        <ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />,
        signedIn(),
      );
      const ai = await screen.findByTestId('breakdown-礙');
      await userEvent.click(within(ai).getByRole('button', { name: '石' }));

      await userEvent.click(screen.getByRole('button', { name: 'Report breakdown' }));

      expect(screen.getByRole('textbox', { name: 'Reason (optional)' })).toBeInTheDocument();
      expect(mockedReportPart).not.toHaveBeenCalled();
    });

    it('offers the report again for the next part tapped', async () => {
      mockedReportPart.mockResolvedValue();
      renderWithProviders(
        <ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />,
        signedIn(),
      );
      const ai = await screen.findByTestId('breakdown-礙');
      await userEvent.click(within(ai).getByRole('button', { name: '石' }));
      await send();

      await userEvent.click(within(ai).getByRole('button', { name: '疑' }));

      expect(screen.getByRole('button', { name: 'Report breakdown' })).toBeEnabled();
    });

    it('offers the report again, with the same reason, when the save fails', async () => {
      mockedReportPart.mockRejectedValue(new Error('permission-denied'));
      renderWithProviders(
        <ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />,
        signedIn(),
      );
      const ai = await screen.findByTestId('breakdown-礙');
      await userEvent.click(within(ai).getByRole('button', { name: '石' }));

      await send('Wrong split');
      await userEvent.click(await screen.findByRole('button', { name: 'Report failed' }));

      expect(mockedReportPart).toHaveBeenCalledTimes(2);
      expect(mockedReportPart.mock.calls[1][1]).toMatchObject({ reason: 'Wrong split' });
    });

    it('offers no report with no account to save it to', async () => {
      renderWithProviders(
        <ComponentReview chars={['礙']} charSet="trad" open onToggle={vi.fn()} />,
      );
      const ai = await screen.findByTestId('breakdown-礙');
      await userEvent.click(within(ai).getByRole('button', { name: '石' }));

      expect(screen.queryByRole('button', { name: 'Report breakdown' })).not.toBeInTheDocument();
    });
  });
});
