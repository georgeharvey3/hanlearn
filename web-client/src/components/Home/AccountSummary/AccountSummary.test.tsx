import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSummary from './AccountSummary';

describe('AccountSummary', () => {
  it('shows loading skeleton when loading', () => {
    render(<AccountSummary loading={true} />);
    expect(screen.queryByText(/words/i)).not.toBeInTheDocument();
  });

  it('shows due word count and Test button when user has words', () => {
    const testClicked = vi.fn();
    render(<AccountSummary numDue={3} numTot={10} testClicked={testClicked} />);
    expect(screen.getByText('You have 3/10 words due for testing...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test' })).toBeEnabled();
  });

  it('disables Test button when no words are due', () => {
    render(<AccountSummary numDue={0} numTot={5} />);
    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled();
  });

  it('shows empty state with Add Words button when numTot is 0', async () => {
    const addWordsClicked = vi.fn();
    render(<AccountSummary numDue={0} numTot={0} addWordsClicked={addWordsClicked} />);

    expect(screen.getByText('No words in your bank yet. Start by adding some words!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test' })).not.toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: 'Add Words' });
    expect(addButton).toBeInTheDocument();

    await userEvent.click(addButton);
    expect(addWordsClicked).toHaveBeenCalledTimes(1);
  });
});
