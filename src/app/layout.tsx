import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { VersionNueva } from "@/components/version-nueva";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "JD Media",
  description:
    "Operación interna de JD Media: tareas, clientes, contenidos, equipo y procesos.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JD Media",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

// Va acá y no en metadata: Next lo pide así y si no ensucia los logs en cada visita.
export const viewport: Viewport = { themeColor: "#FFD400" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <PwaRegister />
          <VersionNueva actual={process.env.VERCEL_DEPLOYMENT_ID ?? null} />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
