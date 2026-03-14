import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockLogEvent } = vi.hoisted(() => {
  const mockLogEvent = vi.fn();
  return { mockLogEvent };
});

vi.mock('firebase/analytics', () => ({
  logEvent: mockLogEvent,
}));

vi.mock('../../firebase/config', () => ({
  analytics: null,
}));

import { trackPageView, trackFeatureUsage } from '../analyticsService';

describe('analyticsService (dev mode — analytics null)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackPageView is a no-op when analytics is null', () => {
    trackPageView('/test');
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('trackFeatureUsage is a no-op when analytics is null', () => {
    trackFeatureUsage('test_event');
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});
