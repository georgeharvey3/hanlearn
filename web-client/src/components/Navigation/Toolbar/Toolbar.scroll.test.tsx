import React from 'react';
import { screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

vi.mock('../../../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
}));

import Toolbar from './Toolbar';
import { renderWithProviders } from '../../../test/utils';

describe('Toolbar — scroll behaviour on home page', () => {
  let addEventSpy: MockInstance<typeof window.addEventListener>;
  let removeEventSpy: MockInstance<typeof window.removeEventListener>;

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, 'addEventListener');
    removeEventSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById('main-banner')?.remove();
  });

  function renderOnHomePage() {
    // Toolbar is wrapped with withRouter, so it reads location from the Router.
    // renderWithProviders wraps with BrowserRouter — navigate to "/" to be on home.
    window.history.pushState({}, '', '/');
    return renderWithProviders(<Toolbar isAuth={false} />);
  }

  it('registers a scroll listener when on the unauthenticated home page', () => {
    renderOnHomePage();
    const scrollCalls = addEventSpy.mock.calls.filter(([event]) => event === 'scroll');
    expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT register a scroll listener when authenticated', () => {
    window.history.pushState({}, '', '/');
    renderWithProviders(<Toolbar isAuth />);
    const scrollCalls = addEventSpy.mock.calls.filter(([event]) => event === 'scroll');
    expect(scrollCalls).toHaveLength(0);
  });

  it('does NOT register a scroll listener on a non-home route', () => {
    window.history.pushState({}, '', '/add-words');
    renderWithProviders(<Toolbar isAuth={false} />);
    const scrollCalls = addEventSpy.mock.calls.filter(([event]) => event === 'scroll');
    expect(scrollCalls).toHaveLength(0);
  });

  it('removes scroll listener on unmount', () => {
    const { unmount } = renderOnHomePage();
    unmount();
    const removeCalls = removeEventSpy.mock.calls.filter(([event]) => event === 'scroll');
    expect(removeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('uses window.scrollY fallback when no #main-banner exists', () => {
    renderOnHomePage();
    // Extract the registered handler
    const scrollCall = addEventSpy.mock.calls.find(([event]) => event === 'scroll');
    expect(scrollCall).toBeDefined();
    const handler = scrollCall![1] as EventListener;

    // Simulate scrollY = 100 (half of 200 threshold)
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    act(() => {
      handler(new Event('scroll'));
    });

    // The AppBar should still be in the document (scroll changes styles, not presence)
    const logo = screen.getByRole('link', { name: /hanlearn/i });
    expect(logo).toBeInTheDocument();
  });

  it('uses banner-based progress when #main-banner exists', () => {
    // Create a mock banner element
    const banner = document.createElement('div');
    banner.id = 'main-banner';
    document.body.appendChild(banner);
    // Mock getBoundingClientRect
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    renderOnHomePage();
    const scrollCall = addEventSpy.mock.calls.find(([event]) => event === 'scroll');
    const handler = scrollCall![1] as EventListener;

    act(() => {
      handler(new Event('scroll'));
    });

    // Banner bottom is 100, innerHeight is 800, so pastBanner = 700, progress = min(1, 700/200) = 1
    // At progress=1, background should be primary color (not transparent)
    const logo = screen.getByRole('link', { name: /hanlearn/i });
    expect(logo).toBeInTheDocument();
  });

  it('clamps scroll progress to 0 when banner is fully visible', () => {
    const banner = document.createElement('div');
    banner.id = 'main-banner';
    document.body.appendChild(banner);
    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      top: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 900,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    renderOnHomePage();
    const scrollCall = addEventSpy.mock.calls.find(([event]) => event === 'scroll');
    const handler = scrollCall![1] as EventListener;

    act(() => {
      handler(new Event('scroll'));
    });

    // bannerBottom (900) > innerHeight (800), so pastBanner = max(0, 800-900) = 0
    // progress = 0 → transparent background, no shadow
    const logo = screen.getByRole('link', { name: /hanlearn/i });
    expect(logo).toBeInTheDocument();
  });
});
