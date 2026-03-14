import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase/config';

/**
 * Log a page view event.
 */
export function trackPageView(pageName: string): void {
  if (!analytics) return;
  logEvent(analytics, 'page_view', { page_path: pageName });
}

/**
 * Log a feature usage event.
 */
export function trackFeatureUsage(feature: string, details?: Record<string, string>): void {
  if (!analytics) return;
  logEvent(analytics, feature, details);
}
