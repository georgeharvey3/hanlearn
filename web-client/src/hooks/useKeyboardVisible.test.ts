import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useKeyboardVisible from './useKeyboardVisible';

describe('useKeyboardVisible', () => {
  let resizeHandler: (() => void) | null;
  let mockViewport: {
    height: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resizeHandler = null;
    mockViewport = {
      height: window.innerHeight,
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        resizeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'visualViewport', {
      value: mockViewport,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('returns true when viewport shrinks significantly', () => {
    const { result } = renderHook(() => useKeyboardVisible());

    act(() => {
      mockViewport.height = window.innerHeight - 300;
      resizeHandler?.();
    });

    expect(result.current).toBe(true);
  });

  it('returns false when viewport returns to normal', () => {
    const { result } = renderHook(() => useKeyboardVisible());

    act(() => {
      mockViewport.height = window.innerHeight - 300;
      resizeHandler?.();
    });
    expect(result.current).toBe(true);

    act(() => {
      mockViewport.height = window.innerHeight;
      resizeHandler?.();
    });
    expect(result.current).toBe(false);
  });

  it('ignores small viewport changes (e.g. URL bar)', () => {
    const { result } = renderHook(() => useKeyboardVisible());

    act(() => {
      mockViewport.height = window.innerHeight - 50;
      resizeHandler?.();
    });

    expect(result.current).toBe(false);
  });

  it('returns false when visualViewport is not available', () => {
    Object.defineProperty(window, 'visualViewport', {
      value: null,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardVisible());
    unmount();
    expect(mockViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
