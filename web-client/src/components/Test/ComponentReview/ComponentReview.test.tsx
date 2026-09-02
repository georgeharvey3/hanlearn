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

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ComponentReview from './ComponentReview';
import { decomposeCharacter } from '../../../services/decompositionService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ComponentReview', () => {
  it('renders nothing when the question offered no characters', () => {
    const { container } = render(
      <ComponentReview chars={[]} open={false} onToggle={vi.fn()} onContinue={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('offers the breakdown without fetching it until it is asked for', () => {
    render(<ComponentReview chars={['好']} open={false} onToggle={vi.fn()} onContinue={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(decomposeCharacter).not.toHaveBeenCalled();
  });

  it('shows the components of every character of the word when open', async () => {
    render(<ComponentReview chars={['你', '好']} open onToggle={vi.fn()} onContinue={vi.fn()} />);

    await waitFor(() => expect(decomposeCharacter).toHaveBeenCalledTimes(2));
    expect(decomposeCharacter).toHaveBeenCalledWith('你');
    expect(decomposeCharacter).toHaveBeenCalledWith('好');
  });

  it('reports the toggle and the continue', async () => {
    const onToggle = vi.fn();
    const onContinue = vi.fn();
    render(
      <ComponentReview chars={['好']} open={false} onToggle={onToggle} onContinue={onContinue} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Components' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
