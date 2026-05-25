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
