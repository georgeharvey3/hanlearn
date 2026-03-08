/**
 * Tests for FormInput — covers the select variant (lines 29-50) and
 * the standard text/textarea/default variants.
 */
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

import FormInput from './FormInput';

// ---------------------------------------------------------------------------
// select variant (previously uncovered — lines 29-50)
// ---------------------------------------------------------------------------
describe('FormInput — select variant', () => {
  const options = [
    { value: 'a', displayValue: 'Option A' },
    { value: 'b', displayValue: 'Option B' },
  ];

  it('renders a select element with the provided options', () => {
    render(
      <FormInput
        elementType="select"
        elementConfig={{ options }}
        value="a"
        label="My Select"
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows the label for the select', () => {
    render(
      <FormInput
        elementType="select"
        elementConfig={{ options }}
        value="a"
        label="Choose one"
      />,
    );
    // MUI renders label text multiple times; getAllByText confirms at least one exists
    expect(screen.getAllByText('Choose one').length).toBeGreaterThan(0);
  });

  it('opens the dropdown when the select is clicked', () => {
    render(
      <FormInput
        elementType="select"
        elementConfig={{ options }}
        value=""
        label="Pick"
        changed={vi.fn() as any}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('combobox'));
    // After opening, options should be in the document
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });

  it('shows error helper text when invalid, shouldValidate, and touched are all true', () => {
    render(
      <FormInput
        elementType="select"
        elementConfig={{ options }}
        value=""
        invalid={true}
        shouldValidate={true}
        touched={true}
        errorMessage="Please select an option"
      />,
    );
    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });

  it('does NOT show error when only touched is false', () => {
    render(
      <FormInput
        elementType="select"
        elementConfig={{ options }}
        value=""
        invalid={true}
        shouldValidate={true}
        touched={false}
        errorMessage="Please select an option"
      />,
    );
    expect(screen.queryByText('Please select an option')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// text input (default/standard variant)
// ---------------------------------------------------------------------------
describe('FormInput — text input variant', () => {
  it('renders a text input by default', () => {
    render(<FormInput elementConfig={{ placeholder: 'Enter text' }} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows error helper text when invalid, shouldValidate, and touched', () => {
    render(
      <FormInput
        invalid={true}
        shouldValidate={true}
        touched={true}
        errorMessage="This field is required"
      />,
    );
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('does not show error when not touched', () => {
    render(
      <FormInput
        invalid={true}
        shouldValidate={true}
        touched={false}
        errorMessage="This field is required"
      />,
    );
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
  });

  it('renders a textarea when elementType is "textarea"', () => {
    render(<FormInput elementType="textarea" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows a label when provided', () => {
    render(<FormInput label="Username" />);
    // MUI may render label multiple times; confirm at least one exists
    expect(screen.getAllByText('Username').length).toBeGreaterThan(0);
  });

  it('calls onChange when text is typed', () => {
    const onChange = vi.fn();
    render(<FormInput changed={onChange as any} value="" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });
});
