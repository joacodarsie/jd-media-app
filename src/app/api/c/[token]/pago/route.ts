import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { AREA_PM } from "@/lib/tareas/puerta";
import { periodLabel } from "@/lib/finanzas";
import { clavePago } from "@/lib/portal/tu-abono";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/c/[token]/pago — el cliente avisa desde su portal que ya pagó el
 * abono del mes (19/10/2026). A la PM le llega la tarea de confirmarlo y
 * marcarlo como cobrado. Una por cuenta y por mes.
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
  const hoy = hoyYmd();
  const periodo = hoy.slice(0, 7);
  const clave = clavePago(t.cliente_id, periodo);
  const { data: ya } = await admin.from("tasks").select("id").eq("rutina_key", clave).limit(1);
  if (ya?.length) return NextResponse.json({ ok: true });

  const [{ data: c }, { data: us }] = await Promise.all([
    admin.from("clients").select("nombre").eq("id", t.cliente_id).maybeSingle(),
    admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true),
  ]);
  const lista = (us ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = lista.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? lista.find((u) => u.rol === "admin")?.id;
  if (!pm) return NextResponse.json({ ok: true });
  const nombre = (c as { nombre?: string } | null)?.nombre ?? "Un cliente";
  await admin.from("tasks").insert({
    titulo: `💸 ${nombre} avisó que pagó ${periodLabel(periodo).toLowerCase()}`,
    descripcion: `${nombre} marcó en su plataforma que ya pagó el abono de ${periodLabel(periodo).toLowerCase()}.\n\n**Qué hacer:** fijate que haya entrado la transferencia en Mercado Pago y marcalo como cobrado en Cobros.\n\n**Está hecho cuando:** el cobro figura como cobrado en la plataforma.`,
    cliente_id: t.cliente_id,
    asignado_a_id: pm,
    creado_por_id: pm,
    area: AREA_PM,
    prioridad: "alta",
    estado: "pendiente",
    fecha_limite: hoy,
    rutina_key: clave,
  });
  return NextResponse.json({ ok: true });
}
