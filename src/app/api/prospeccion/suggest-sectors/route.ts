import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { suggestSectors } from "@/lib/prospecting/suggest";
import { friendlyAiError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Sugiere sectores/nichos para una campaña nueva, mirando los clientes actuales.
 *
 * Abierto a cualquiera que pueda entrar a Prospección, no solo al director: es
 * la función más barata de todas (Haiku, sin búsqueda web, una llamada por
 * campaña nueva) y es justo la que necesita quien está por armar una campaña.
 * Tenerla detrás del permiso hacía que el resto tuviera que pedirle los rubros
 * al dueño. Las caras (buscar leads, mensajes) siguen con su permiso.
 */
const ROLES_PROSPECCION = ["admin", "coordinador", "comercial", "prospecting"];

export async function POST() {
  const me = await requireUser();
  const puede =
    ROLES_PROSPECCION.includes(me.rol) ||
    (!!me.rol_secundario && ROLES_PROSPECCION.includes(me.rol_secundario));
  if (!puede)
    return NextResponse.json(
      { error: "No tenés acceso a Prospección." },
      { status: 403 }
    );

  const admin = createAdmin();

  // Clientes actuales (activos), para entender el perfil que funciona.
  const { data: cli } = await admin
    .from("clients")
    .select("nombre, rubro, descripcion, estado")
    .neq("estado", "perdido")
    .limit(80);
  const clientes = ((cli ?? []) as {
    nombre: string;
    rubro: string | null;
    descripcion: string | null;
  }[]).map((c) => ({ nombre: c.nombre, rubro: c.rubro, descripcion: c.descripcion }));

  // Rubros de campañas existentes, para no repetir.
  const { data: camps } = await admin
    .from("prospecting_campaigns")
    .select("rubro");
  const rubrosExistentes = ((camps ?? []) as { rubro: string }[])
    .map((c) => c.rubro)
    .filter(Boolean);

  try {
    const sugerencias = await suggestSectors({ clientes, rubrosExistentes });
    if (sugerencias.length === 0)
      return NextResponse.json(
        { error: "No pude generar sugerencias. Probá de nuevo." },
        { status: 400 }
      );
    return NextResponse.json({ sugerencias });
  } catch (e) {
    console.error("suggestSectors:", e);
    return NextResponse.json({ error: friendlyAiError(e) }, { status: 400 });
  }
}
