import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockStart, mockStop, mockTrace, mockLogEvent } = vi.hoisted(() => {
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockTrace = vi.fn(() => ({ start: mockStart, stop: mockStop }));
  const mockLogEvent = vi.fn();
  return { mockStart, mockStop, mockTrace, mockLogEvent };
});

vi.mock('firebase/performance', () => ({
  trace: mockTrace,
}));

vi.mock('firebase/analytics', () => ({
  logEvent: mockLogEvent,
}));

vi.mock('web-vitals', () => ({
  onLCP: vi.fn(),
  onINP: vi.fn(),
  onCLS: vi.fn(),
}));

vi.mock('../../firebase/config', () => ({
  perf: null,
  analytics: null,
}));

import {
  startTrace,
  stopTrace,
  traceAsync,
  initPerformanceMonitoring,
} from '../performanceService';
import { onLCP, onINP, onCLS } from 'web-vitals';

describe('performanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initPerformanceMonitoring', () => {
    it('registers Web Vitals observers', () => {
      initPerformanceMonitoring();
      expect(onLCP).toHaveBeenCalledWith(expect.any(Function));
      expect(onINP).toHaveBeenCalledWith(expect.any(Function));
      expect(onCLS).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('startTrace', () => {
    it('returns null when perf is null (dev mode)', () => {
      const result = startTrace('test_trace');
      expect(result).toBeNull();
      expect(mockTrace).not.toHaveBeenCalled();
    });
  });

  describe('stopTrace', () => {
    it('is a no-op when passed null', () => {
      expect(() => stopTrace(null)).not.toThrow();
    });
  });

  describe('traceAsync', () => {
    it('executes the function and returns its result without tracing in dev', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await traceAsync('test', fn);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('re-throws errors from the wrapped function', async () => {
      const error = new Error('test error');
      const fn = vi.fn().mockRejectedValue(error);
      await expect(traceAsync('test', fn)).rejects.toThrow('test error');
    });
  });
});
