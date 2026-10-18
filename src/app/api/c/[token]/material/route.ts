import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AREA_PM } from "@/lib/tareas/puerta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/c/[token]/material — el cliente avisa desde su portal que ya subió
 * sus fotos y videos (18/10/2026). Sin esto el aviso iba por WhatsApp y se
 * perdía: el arranque quedaba trabado esperando un material que ya estaba.
 * Le arma a la CM (o a la PM) una tarea para revisarlo, una por día como mucho.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const admin = createAdmin();
  const { data: tok } = await admin
    .from("client_portal_tokens")
    .select("cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();
  const t = tok as { cliente_id: string; revoked_at: string | null; expires_at: string | null } | null;
  if (!t || t.revoked_at || (t.expires_at && new Date(t.expires_at) < new Date())) {
    return NextResponse.json({ error: "El link no es válido." }, { status: 404 });
  }

  const { data: c } = await admin
    .from("clients")
    .select("id, nombre, cm_id, drive_url")
    .eq("id", t.cliente_id)
    .maybeSingle();
  const cliente = c as { id: string; nombre: string; cm_id: string | null; drive_url: string | null } | null;
  if (!cliente) return NextResponse.json({ error: "No encontramos la cuenta." }, { status: 404 });

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
  const clave = `material:${cliente.id}:${hoy}`;
  const { data: ya } = await admin.from("tasks").select("id").eq("rutina_key", clave).limit(1);
  if (ya?.length) return NextResponse.json({ ok: true });

  const { data: us } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const lista = (us ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = lista.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? lista.find((u) => u.rol === "admin")?.id ?? null;
  const quien = cliente.cm_id ?? pm;
  if (!quien) return NextResponse.json({ ok: true });

  const manana = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
  await admin.from("tasks").insert({
    titulo: `${cliente.nombre} avisó que subió su material`,
    descripcion: `${cliente.nombre} marcó en su plataforma que ya subió fotos y videos${cliente.drive_url ? ` a su carpeta (${cliente.drive_url})` : ""}. Revisalo hoy: ordenalo en carpetas, avisale qué sirve y qué falta, y usalo para las primeras piezas.`,
    cliente_id: cliente.id,
    asignado_a_id: quien,
    creado_por_id: pm ?? quien,
    area: "Community Manager",
    prioridad: "alta",
    estado: "pendiente",
    fecha_limite: manana,
    rutina_key: clave,
  });
  return NextResponse.json({ ok: true });
}
