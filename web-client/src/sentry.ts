import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (!import.meta.env.DEV && dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENV || 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function isInitialised(): boolean {
  return !import.meta.env.DEV && !!dsn;
}
