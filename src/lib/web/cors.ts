/** La web pública de JD Media le pega a estas rutas desde otro dominio. */
const PERMITIDOS = ["https://jdmedia.com.ar", "https://www.jdmedia.com.ar", "http://localhost:4173", "http://localhost:5173"];

export function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin && (PERMITIDOS.includes(origin) || origin.endsWith(".vercel.app"));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : PERMITIDOS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
