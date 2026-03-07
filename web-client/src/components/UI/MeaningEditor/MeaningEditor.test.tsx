/**
 * Tests for MeaningEditor component — inline chip-based meaning editor.
 *
 * Focus areas:
 * - Displays each parsed meaning as a chip
 * - readOnly mode: no delete icons, no Add chip
 * - Clicking a chip enters inline edit mode
 * - Escape key cancels an edit without saving
 * - Enter key saves the edited text (calls onChange)
 * - Blur on edit input saves the text
 * - Saving with empty text removes the meaning chip
 * - Delete icon on a chip removes it (only present when >1 meaning)
 * - Single-meaning chip has no delete icon (can't reduce to zero)
 * - "Add" chip opens an input for a new meaning
 * - Enter in the Add input appends a new meaning
 * - Escape in the Add input cancels without adding
 * - Blank input in Add field does not call onChange
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MeaningEditor from './MeaningEditor';

// MeaningEditor is a pure component — no Redux / Firebase needed.

const singleMeaning = 'hello / greetings';
const multiMeaning = 'hello/greetings/hi';

describe('MeaningEditor — read-only display', () => {
  it('renders each meaning as a chip', () => {
    render(<MeaningEditor value={multiMeaning} readOnly />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('greetings')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('does not render the Add chip in readOnly mode', () => {
    render(<MeaningEditor value={singleMeaning} readOnly />);
    expect(screen.queryByText('Add')).not.toBeInTheDocument();
  });

  it('does not render delete icons in readOnly mode', () => {
    render(<MeaningEditor value={multiMeaning} readOnly />);
    // MUI Chip delete button has data-testid="CancelIcon" or role="button" named after the item
    // In readOnly, onDelete prop is not provided, so no cancel icon is rendered
    expect(screen.queryByTitle(/delete/i)).not.toBeInTheDocument();
  });
});

describe('MeaningEditor — editable display', () => {
  it('renders each meaning chip in editable mode', () => {
    render(<MeaningEditor value={multiMeaning} onChange={vi.fn()} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('greetings')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('renders the Add chip in editable mode', () => {
    render(<MeaningEditor value={singleMeaning} onChange={vi.fn()} />);
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('does not render a delete icon for a single meaning', () => {
    // onDelete is only provided when meanings.length > 1
    const { container } = render(<MeaningEditor value="hello" onChange={vi.fn()} />);
    // MUI delete icon has aria-label="..." or data-testid
    // The easiest check: no SVG cancel icon rendered
    expect(container.querySelector('[data-testid="CancelIcon"]')).toBeNull();
  });

  it('renders delete icons when there are multiple meanings', () => {
    const { container } = render(<MeaningEditor value={multiMeaning} onChange={vi.fn()} />);
    expect(container.querySelectorAll('[data-testid="CancelIcon"]').length).toBeGreaterThan(0);
  });
});

describe('MeaningEditor — editing a meaning', () => {
  it('clicking a chip shows an input with the current meaning', async () => {
    const user = userEvent.setup();
    render(<MeaningEditor value="hello/greetings" onChange={vi.fn()} />);

    await user.click(screen.getByText('hello'));
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('Escape cancels an edit without calling onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello/greetings" onChange={onChange} />);

    await user.click(screen.getByText('hello'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'changed');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    // Chip should reappear
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('Enter saves the edited meaning and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello/greetings" onChange={onChange} />);

    await user.click(screen.getByText('hello'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'hey{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('hey'));
  });

  it('blur on the edit input saves the edited meaning', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello/greetings" onChange={onChange} />);

    await user.click(screen.getByText('hello'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'blurred');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('blurred'));
  });

  it('saving an empty edit removes the meaning', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello/greetings" onChange={onChange} />);

    await user.click(screen.getByText('hello'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    // onChange called with only the remaining meaning
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('greetings'));
    expect(onChange).toHaveBeenCalledWith(expect.not.stringContaining('hello'));
  });
});

describe('MeaningEditor — deleting a meaning', () => {
  it('clicking the delete icon on a chip removes it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello/greetings/hi" onChange={onChange} />);

    // MUI puts a cancel icon button for each deletable chip
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    await user.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    // The resulting value should still contain the other meanings
    const calledWith: string = onChange.mock.calls[0][0];
    expect(calledWith).not.toBe('');
  });
});

describe('MeaningEditor — adding a meaning', () => {
  it('clicking Add shows a text input', async () => {
    const user = userEvent.setup();
    render(<MeaningEditor value="hello" onChange={vi.fn()} />);

    await user.click(screen.getByText('Add'));
    expect(screen.getByPlaceholderText(/new meaning/i)).toBeInTheDocument();
  });

  it('Enter in Add input calls onChange with the new meaning appended', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello" onChange={onChange} />);

    await user.click(screen.getByText('Add'));
    const input = screen.getByPlaceholderText(/new meaning/i);
    await user.type(input, 'world{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('world'));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });

  it('Escape in Add input cancels without calling onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello" onChange={onChange} />);

    await user.click(screen.getByText('Add'));
    const input = screen.getByPlaceholderText(/new meaning/i);
    await user.type(input, 'world');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    // Add chip should come back
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('submitting a blank Add input does not call onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello" onChange={onChange} />);

    await user.click(screen.getByText('Add'));
    const input = screen.getByPlaceholderText(/new meaning/i);
    // Don't type anything — just press Enter
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('blur on Add input with text saves the new meaning', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MeaningEditor value="hello" onChange={onChange} />);

    await user.click(screen.getByText('Add'));
    const input = screen.getByPlaceholderText(/new meaning/i);
    await user.type(input, 'world');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('world'));
  });
});
