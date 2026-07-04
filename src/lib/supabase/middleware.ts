import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rutas que NO requieren sesion de Supabase.
 * Incluye:
 *  - Login / auth / aprobacion (publico para que el cliente apruebe sin login)
 *  - /c/<token> y /api/c/<token>/* → portal magico del cliente (token propio)
 *  - /contrato/cliente, /diagnostico/cliente, /plan/cliente → PDFs publicos por id
 *  - /api/cron/* → endpoints de Vercel Cron, autenticados via Bearer CRON_SECRET
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/aprobacion",
  "/c/",
  "/api/c/",
  "/contrato/cliente/",
  "/contrato/unificado",
  "/diagnostico/cliente/",
  "/plan/cliente/",
  // Reporte mensual: público SOLO con ?token válido del portal; sin token la
  // propia página exige login (requireUser).
  "/reporte/cliente/",
  // Callback de OAuth de TikTok: lo abre el navegador del cliente (sin sesión);
  // la seguridad está en el `state` firmado.
  "/api/tiktok/callback",
  "/api/cron/",
  // Páginas legales públicas (requeridas por TikTok/Meta para el alta de la app).
  "/privacidad",
  "/terminos",
  // Archivo de verificación de dominio de TikTok (signature file en /public).
  // Debe servirse sin redirigir a login para que TikTok lo lea.
  "/tiktok",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
