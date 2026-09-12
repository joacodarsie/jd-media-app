import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { armarDatos, periodoPorDefecto } from "@/lib/finanzas/informe-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Los datos del informe, en JSON.
 *
 * Existe para el script de Google Sheets: el dueño no usa Excel y quería el
 * informe como una planilla nativa en su Drive. En vez de pedirle que cree un
 * service account de Google, el script corre dentro de SU cuenta (Apps Script),
 * pide estos datos y arma la planilla él mismo. Así el formato es nativo —sin
 * conversión de por medio— y no hay credenciales de Google en la app.
 *
 * Va con token porque devuelve toda la información financiera de la agencia.
 * No usa la sesión del navegador: quien consume esto es un script, no una
 * persona logueada.
 */
export async function GET(req: NextRequest) {
  const esperado = process.env.INFORME_TOKEN;
  if (!esperado) {
    return NextResponse.json(
      { error: "Falta configurar INFORME_TOKEN en el servidor" },
      { status: 503 }
    );
  }
  const token =
    req.nextUrl.searchParams.get("token") ??
    req.headers.get("x-informe-token") ??
    "";
  if (token !== esperado) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const m = req.nextUrl.searchParams.get("m");
  const periodo = m && /^\d{4}-\d{2}$/.test(m) ? m : periodoPorDefecto();

  try {
    const datos = await armarDatos(createAdmin(), periodo);
    return NextResponse.json(datos, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudieron armar los datos" },
      { status: 500 }
    );
  }
}
