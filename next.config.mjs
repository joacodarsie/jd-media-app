import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Optimiza imports de librerias grandes (tree-shaking agresivo).
  // lucide-react es la que mas pesa: importamos solo iconos pero el bundler
  // incluia todo si no lo declaramos aqui.
  experimental: {
    // Necesario en Next 14.2 para que corra src/instrumentation.ts (carga Sentry).
    instrumentationHook: true,

    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
    ],

    // Router Cache del cliente: cuanto tiempo se reusa el contenido ya cargado
    // de una sección al volver a ella, sin re-fetch al servidor.
    // - dynamic: páginas force-dynamic (casi todas acá). 30s hace que volver a
    //   una sección recién visitada sea INSTANTÁNEO. Las mutaciones siguen
    //   bustando el cache vía revalidatePath/router.refresh, así que no se ve
    //   data vieja tras una acción; sólo al navegar atrás/adelante.
    // - static: páginas estáticas, se pueden retener más tiempo.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // Cache de assets estaticos por mas tiempo en el browser
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Comprimir respuestas
  compress: true,

  // No mostrar el banner de "Powered by Vercel"
  poweredByHeader: false,
};

// Envoltura de Sentry. Por ahora SIN subida de source maps (no depende de tokens,
// así el build nunca falla por eso). Para activar source maps legibles más
// adelante: setear SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT y quitar
// `sourcemaps.disable`.
export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  // Evita que el SDK toque rutas con adblockers (mismo aprendizaje que /pauta):
  // el tunnel se deja sin setear a propósito.
});
