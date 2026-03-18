/**
 * Tests for analyticsService when analytics IS initialised (production path).
 * Companion to analyticsService.test.ts which covers the null-analytics guard.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockLogEvent, fakeAnalytics } = vi.hoisted(() => {
  const mockLogEvent = vi.fn();
  const fakeAnalytics = { app: {} };
  return { mockLogEvent, fakeAnalytics };
});

vi.mock('firebase/analytics', () => ({
  logEvent: mockLogEvent,
}));

vi.mock('../../firebase/config', () => ({
  analytics: fakeAnalytics,
}));

import { trackPageView, trackFeatureUsage } from '../analyticsService';

describe('analyticsService (production — analytics enabled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackPageView calls logEvent with page_view and page_path', () => {
    trackPageView('/dashboard');
    expect(mockLogEvent).toHaveBeenCalledWith(fakeAnalytics, 'page_view', {
      page_path: '/dashboard',
    });
  });

  it('trackFeatureUsage calls logEvent with feature name and details', () => {
    trackFeatureUsage('test_completed', { score: '4' });
    expect(mockLogEvent).toHaveBeenCalledWith(fakeAnalytics, 'test_completed', { score: '4' });
  });

  it('trackFeatureUsage works without optional details', () => {
    trackFeatureUsage('hint_used');
    expect(mockLogEvent).toHaveBeenCalledWith(fakeAnalytics, 'hint_used', undefined);
  });
});
