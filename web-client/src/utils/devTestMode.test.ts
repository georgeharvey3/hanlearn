/**
 * Tests for devTestMode utilities.
 * These utilities allow developers to jump to specific test stages via URL params.
 *
 * Note: getDevTestConfig() returns null when NODE_ENV !== 'development'.
 * In the test environment (NODE_ENV==='test'), functions return null by design.
 * We test the development-mode parsing by mocking window.location directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the module internals by importing it fresh after stubbing the env
// devTestMode.ts checks process.env.NODE_ENV at call time (not import time),
// so vi.stubEnv works here.

describe('devTestMode utilities — development environment parsing', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when no devStage param is present', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    });

    // Re-import to get fresh module with stubbed env
    const { getDevTestConfig } = await import('./devTestMode');
    expect(getDevTestConfig()).toBeNull();
  });

  it('returns correct config for "new" stage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=new' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config).not.toBeNull();
    expect(config!.stage).toBe('new');
    expect(config!.testFinished).toBe(false);
  });

  it('returns correct config for "vocab" stage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=vocab' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config!.stage).toBe('vocab');
    expect(config!.testFinished).toBe(false);
  });

  it('returns correct config for "read" stage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=read' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config!.stage).toBe('read');
    expect(config!.testFinished).toBe(false);
  });

  it('returns correct config for "write" stage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=write' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config!.stage).toBe('write');
    expect(config!.testFinished).toBe(false);
  });

  it('returns testFinished=true for "summary" stage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=summary' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config!.stage).toBe('summary');
    // summary stage implies the test is already finished
    expect(config!.testFinished).toBe(true);
  });

  it('returns null for invalid devStage value and warns', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=invalid' },
      writable: true,
      configurable: true,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getDevTestConfig } = await import('./devTestMode');
    expect(getDevTestConfig()).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid devStage: invalid'));
    warnSpy.mockRestore();
  });

  it('handles additional query params alongside devStage', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?foo=bar&devStage=read&baz=qux' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    const config = getDevTestConfig();
    expect(config!.stage).toBe('read');
  });

  it('isDevTestMode returns true with valid param', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=vocab' },
      writable: true,
      configurable: true,
    });

    const { isDevTestMode } = await import('./devTestMode');
    expect(isDevTestMode()).toBe(true);
  });

  it('isDevTestMode returns false with no param', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    });

    const { isDevTestMode } = await import('./devTestMode');
    expect(isDevTestMode()).toBe(false);
  });

  it('getDevStage returns the stage value', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=write' },
      writable: true,
      configurable: true,
    });

    const { getDevStage } = await import('./devTestMode');
    expect(getDevStage()).toBe('write');
  });

  it('getDevStage returns null with no param', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    });

    const { getDevStage } = await import('./devTestMode');
    expect(getDevStage()).toBeNull();
  });

  it('getDevStage returns "summary" correctly', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=summary' },
      writable: true,
      configurable: true,
    });

    const { getDevStage } = await import('./devTestMode');
    expect(getDevStage()).toBe('summary');
  });
});

describe('devTestMode utilities — non-development environment', () => {
  // In test environment (NODE_ENV=test), all functions return null by design.
  // This verifies the guard works at the current test NODE_ENV value.
  it('getDevTestConfig returns null in non-development env (test env)', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=new' },
      writable: true,
      configurable: true,
    });

    const { getDevTestConfig } = await import('./devTestMode');
    // NODE_ENV is 'test' here, so should return null regardless of URL params
    expect(getDevTestConfig()).toBeNull();
  });

  it('isDevTestMode returns false in test env', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=vocab' },
      writable: true,
      configurable: true,
    });

    const { isDevTestMode } = await import('./devTestMode');
    expect(isDevTestMode()).toBe(false);
  });

  it('getDevStage returns null in test env', async () => {
    Object.defineProperty(window, 'location', {
      value: { search: '?devStage=read' },
      writable: true,
      configurable: true,
    });

    const { getDevStage } = await import('./devTestMode');
    expect(getDevStage()).toBeNull();
  });
});
