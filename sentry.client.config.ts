// Sentry — inicialización del lado cliente (browser). La carga withSentryConfig.
// Desactivado si no hay DSN. Sin session replay (para no inflar el bundle).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
