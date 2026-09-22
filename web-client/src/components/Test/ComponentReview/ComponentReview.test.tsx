/**
 * Tests for the component review shown after a missed character question.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../services/decompositionService', () => ({
  decomposeCharacter: vi.fn().mockResolvedValue([
    { char: '女', meaning: 'woman', pinyin: 'nǚ' },
    { char: '子', meaning: 'child', pinyin: 'zǐ' },
  ]),
}));

vi.mock('../../../services/dictionaryService', () => ({
  searchWord: vi.fn(),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ComponentReview from './ComponentReview';
import { clearCharacterGlossCache } from './glossCache';
import { decomposeCharacter } from '../../../services/decompositionService';
import { searchWord } from '../../../services/dictionaryService';
import { Word } from '../../../types/models';

const mockedSearchWord = vi.mocked(searchWord);

const dictionaryEntry = (char: string, pinyin: string, meaning: string): Word => ({
  id: char.codePointAt(0) ?? 0,
  simp: char,
  trad: char,
  pinyin,
  meaning,
});

beforeEach(() => {
  vi.clearAllMocks();
  clearCharacterGlossCache();
  mockedSearchWord.mockImplementation(async (char: string) => {
    if (char === '你') return [dictionaryEntry('你', 'nǐ', 'you')];
    if (char === '好') return [dictionaryEntry('好', 'hǎo', 'good')];
    return [];
  });
});

describe('ComponentReview', () => {
  it('renders nothing when the question offered no characters', () => {
    const { container } = render(
      <ComponentReview
        chars={[]}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pinyin and meaning of every character without being asked', async () => {
    render(
      <ComponentReview
        chars={['你', '好']}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(await screen.findByText('nǐ')).toBeInTheDocument();
    expect(await screen.findByText('you')).toBeInTheDocument();
    expect(await screen.findByText('hǎo')).toBeInTheDocument();
    expect(await screen.findByText('good')).toBeInTheDocument();
    expect(mockedSearchWord).toHaveBeenCalledWith('你', 'trad');
    expect(mockedSearchWord).toHaveBeenCalledWith('好', 'trad');
  });

  it('says so when a character is not in the dictionary', async () => {
    render(
      <ComponentReview
        chars={['〇']}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(await screen.findByText('Not in the dictionary')).toBeInTheDocument();
  });

  it('says so when the lookup fails', async () => {
    mockedSearchWord.mockRejectedValue(new Error('offline'));

    render(
      <ComponentReview
        chars={['好']}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(await screen.findByText('Definition unavailable')).toBeInTheDocument();
  });

  it('offers the breakdown without fetching it until it is asked for', async () => {
    render(
      <ComponentReview
        chars={['好']}
        charSet="trad"
        open={false}
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    await waitFor(() => expect(mockedSearchWord).toHaveBeenCalled());
    expect(decomposeCharacter).not.toHaveBeenCalled();
  });

  it('shows the components of every character of the word when open', async () => {
    render(
      <ComponentReview
        chars={['你', '好']}
        charSet="trad"
        open
        onToggle={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => expect(decomposeCharacter).toHaveBeenCalledTimes(2));
    expect(decomposeCharacter).toHaveBeenCalledWith('你');
    expect(decomposeCharacter).toHaveBeenCalledWith('好');
  });

  it('reports the toggle and the continue', async () => {
    const onToggle = vi.fn();
    const onContinue = vi.fn();
    render(
      <ComponentReview
        chars={['好']}
        charSet="trad"
        open={false}
        onToggle={onToggle}
        onContinue={onContinue}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Components' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
