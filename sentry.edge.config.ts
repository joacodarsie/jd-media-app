// Sentry — inicialización para el runtime Edge (middleware). Se carga vía
// src/instrumentation.ts. Desactivado si no hay DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
