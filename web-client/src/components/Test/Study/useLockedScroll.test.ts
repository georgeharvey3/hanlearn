import { renderHook } from '@testing-library/react';
import { useLockedScroll } from './useLockedScroll';

describe('useLockedScroll', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hides the page overflow while mounted and restores it after', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = renderHook(() => useLockedScroll());
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('does nothing when inactive', () => {
    renderHook(() => useLockedScroll(false));
    expect(document.body.style.overflow).toBe('');
  });

  it('puts the page back at the top when a field loses focus', () => {
    vi.useFakeTimers();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderHook(() => useLockedScroll());
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    document.dispatchEvent(new FocusEvent('focusout'));
    vi.advanceTimersByTime(150);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
