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

  // Tells a client event apart from the layer:functions event that a Cloud
  // Function raises for the same failure.
  Sentry.setTag('layer', 'client');
}

export function isInitialised(): boolean {
  return !import.meta.env.DEV && !!dsn;
}
