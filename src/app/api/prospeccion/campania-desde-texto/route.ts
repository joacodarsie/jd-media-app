import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { campaniaDesdeTexto } from "@/lib/prospecting/campania-desde-texto";
import { friendlyAiError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * "Tecno por Córdoba" → la ficha de la campaña completa.
 *
 * Mismo permiso que sugerir sectores: cualquiera que entre a Prospección. Es
 * una llamada corta a Haiku y es justo lo que necesita quien está armando la
 * campaña; dejarla detrás de un permiso obliga a llenar el formulario a mano.
 */
const ROLES_PROSPECCION = ["admin", "coordinador", "comercial", "prospecting"];

export async function POST(req: NextRequest) {
  const me = await requireUser();
  const puede =
    ROLES_PROSPECCION.includes(me.rol) ||
    (!!me.rol_secundario && ROLES_PROSPECCION.includes(me.rol_secundario));
  if (!puede)
    return NextResponse.json({ error: "No tenés acceso a Prospección." }, { status: 403 });

  const { texto } = (await req.json().catch(() => ({}))) as { texto?: string };
  const frase = (texto ?? "").trim();
  if (frase.length < 3)
    return NextResponse.json(
      { error: "Escribí o dictá a quién querés prospectar. Ej: tecno por Córdoba." },
      { status: 400 }
    );

  try {
    const campania = await campaniaDesdeTexto({ texto: frase });
    if (!campania)
      return NextResponse.json(
        { error: "No pude entender el rubro. Probá con algo más concreto." },
        { status: 400 }
      );
    return NextResponse.json({ campania });
  } catch (e) {
    console.error("campaniaDesdeTexto:", e);
    return NextResponse.json({ error: friendlyAiError(e) }, { status: 400 });
  }
}
