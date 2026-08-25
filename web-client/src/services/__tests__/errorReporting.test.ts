import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockCaptureException, mockWithScope, scope } = vi.hoisted(() => {
  const scope = {
    setTag: vi.fn(),
    setLevel: vi.fn(),
    setContext: vi.fn(),
  };
  const mockCaptureException = vi.fn();
  const mockWithScope = vi.fn((callback: (s: typeof scope) => void) => callback(scope));
  return { mockCaptureException, mockWithScope, scope };
});

vi.mock('@sentry/react', () => ({
  captureException: mockCaptureException,
  withScope: mockWithScope,
}));

import { reportError } from '../errorReporting';

describe('errorReporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the error to Sentry', () => {
    const error = new Error('boom');
    reportError(error, { feature: 'tts' });
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it('tags the event with the feature', () => {
    reportError(new Error('boom'), { feature: 'sentence-score' });
    expect(scope.setTag).toHaveBeenCalledWith('feature', 'sentence-score');
  });

  it('defaults to the error level', () => {
    reportError(new Error('boom'), { feature: 'tts' });
    expect(scope.setLevel).not.toHaveBeenCalled();
  });

  it('applies an explicit level', () => {
    reportError(new Error('boom'), { feature: 'hanzi-writer', level: 'warning' });
    expect(scope.setLevel).toHaveBeenCalledWith('warning');
  });

  it('attaches the context when one is given', () => {
    reportError(new Error('boom'), { feature: 'tts', context: { textLength: 12 } });
    expect(scope.setContext).toHaveBeenCalledWith('detail', { textLength: 12 });
  });

  it('sets no context when none is given', () => {
    reportError(new Error('boom'), { feature: 'tts' });
    expect(scope.setContext).not.toHaveBeenCalled();
  });

  it('reports a rejection value that is not an Error', () => {
    reportError('a string rejection', { feature: 'tts' });
    expect(mockCaptureException).toHaveBeenCalledWith('a string rejection');
  });
});
