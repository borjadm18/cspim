import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  initialized = true;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    environment: process.env.VERCEL_ENV || 'development',
  });
}

export { Sentry };
