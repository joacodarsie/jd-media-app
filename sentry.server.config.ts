// Sentry — inicialización del lado servidor (Node). Se carga vía
// src/instrumentation.ts. Si no hay DSN configurado, queda desactivado (no-op).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  // No mandar nada en desarrollo local.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
