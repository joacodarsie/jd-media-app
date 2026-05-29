/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Optimiza imports de librerias grandes (tree-shaking agresivo).
  // lucide-react es la que mas pesa: importamos solo iconos pero el bundler
  // incluia todo si no lo declaramos aqui.
  experimental: {
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

export default nextConfig;
