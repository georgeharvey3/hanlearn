import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useKeyboardShortcutsDialog } from './useKeyboardShortcutsDialog';

describe('useKeyboardShortcutsDialog', () => {
  it('opens on ? keypress', () => {
    const { result } = renderHook(() => useKeyboardShortcutsDialog());
    expect(result.current.open).toBe(false);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(result.current.open).toBe(true);
  });

  it('does not open when input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useKeyboardShortcutsDialog());

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(result.current.open).toBe(false);

    document.body.removeChild(input);
  });

  it('does not open when textarea is focused', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const { result } = renderHook(() => useKeyboardShortcutsDialog());

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });

    expect(result.current.open).toBe(false);

    document.body.removeChild(textarea);
  });

  it('toggles on repeated ? keypress', () => {
    const { result } = renderHook(() => useKeyboardShortcutsDialog());

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(result.current.open).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(result.current.open).toBe(false);
  });

  it('handleOpen and handleClose toggle state', () => {
    const { result } = renderHook(() => useKeyboardShortcutsDialog());

    act(() => {
      result.current.handleOpen();
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.handleClose();
    });
    expect(result.current.open).toBe(false);
  });
});
