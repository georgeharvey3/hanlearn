import { trace, type PerformanceTrace } from 'firebase/performance';
import { logEvent } from 'firebase/analytics';
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';
import { perf, analytics } from '../firebase/config';

/**
 * Report a Web Vitals metric to Firebase Analytics.
 */
function reportWebVital(metric: Metric): void {
  if (import.meta.env.DEV) {
    console.debug(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
    return;
  }

  if (analytics) {
    logEvent(analytics, 'web_vitals', {
      metric_name: metric.name,
      metric_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_rating: metric.rating,
      metric_id: metric.id,
    });
  }
}

/**
 * Initialise Web Vitals observers. Call once at app startup.
 */
export function initPerformanceMonitoring(): void {
  onLCP(reportWebVital);
  onINP(reportWebVital);
  onCLS(reportWebVital);
}

/**
 * Start a custom Firebase Performance trace.
 * Returns null in development mode.
 */
export function startTrace(name: string): PerformanceTrace | null {
  if (!perf) return null;
  const t = trace(perf, name);
  t.start();
  return t;
}

/**
 * Stop a Firebase Performance trace.
 */
export function stopTrace(t: PerformanceTrace | null): void {
  if (t) t.stop();
}

/**
 * Run an async function wrapped in a Firebase Performance trace.
 * Safe to call in development — the function runs normally without tracing.
 */
export async function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t = startTrace(name);
  try {
    const result = await fn();
    stopTrace(t);
    return result;
  } catch (error) {
    stopTrace(t);
    throw error;
  }
}
