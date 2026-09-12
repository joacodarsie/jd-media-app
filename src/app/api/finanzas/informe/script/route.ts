import { NextRequest, NextResponse } from "next/server";
import { INFORME_GS } from "@/lib/finanzas/informe-gs";

export const dynamic = "force-dynamic";

/**
 * El código que arma la planilla de Google Sheets.
 *
 * En la planilla del dueño vive solo un cargador de treinta líneas; todo lo que
 * dibuja el informe se baja de acá en cada corrida. Existe por algo que él
 * planteó bien: no tiene por qué copiar y pegar código cada vez que cambia el
 * informe, y menos código que no entiende. Así, cuando esto cambia, su planilla
 * lo tiene sin que toque nada.
 *
 * Va con el mismo token que los datos. No porque el código sea secreto —no lo
 * es— sino porque el cargador ya lo manda y no vale la pena tener dos puertas
 * con reglas distintas.
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
    req.nextUrl.searchParams.get("token") ?? req.headers.get("x-informe-token") ?? "";
  if (token !== esperado) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  return new NextResponse(INFORME_GS, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
