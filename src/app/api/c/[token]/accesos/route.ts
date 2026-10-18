import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AREA_PM } from "@/lib/tareas/puerta";
import { REDES, unirCredenciales, type CargaDelCliente, type Credencial } from "@/lib/accesos/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/c/[token]/accesos — el cliente carga sus cuentas desde el portal
 * (17/10/2026, pedido de Luz). El token del portal es la credencial.
 *
 * Body: { items: [{ red, tiene, usuario?, password? }] }
 * Guarda en `clients.credenciales` (donde el equipo ya las tenía) y, por cada
 * red que el cliente NO tiene, crea UNA tarea: Facebook y Business Suite a
 * paid media, Instagram y TikTok a la community. Nunca devuelve contraseñas.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
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

  let body: { items?: CargaDelCliente[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const items = (body.items ?? []).filter((i) => REDES.some((r) => r.clave === i.red)).slice(0, REDES.length);
  if (!items.length) return NextResponse.json({ error: "No hay nada para guardar." }, { status: 400 });

  const { data: c } = await admin
    .from("clients")
    .select("id, nombre, credenciales, cm_id, media_buyer_id")
    .eq("id", t.cliente_id)
    .maybeSingle();
  const cliente = c as { id: string; nombre: string; credenciales: Credencial[] | null; cm_id: string | null; media_buyer_id: string | null } | null;
  if (!cliente) return NextResponse.json({ error: "No encontramos la cuenta." }, { status: 404 });

  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" });
  const credenciales = unirCredenciales(cliente.credenciales ?? [], items, hoy);
  const { error } = await admin.from("clients").update({ credenciales }).eq("id", cliente.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo." }, { status: 500 });

  // Las cuentas que no tiene: una tarea a quien la crea (una sola vez por red).
  const faltan = items.filter((i) => !i.tiene);
  if (faltan.length) {
    const { data: us } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
    const lista = (us ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
    const pm = lista.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? lista.find((u) => u.rol === "admin")?.id ?? null;
    const paid = cliente.media_buyer_id ?? lista.find((u) => u.rol === "paid_media")?.id ?? pm;
    const limite = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
    for (const f of faltan) {
      const def = REDES.find((r) => r.clave === f.red)!;
      const quien = def.quienCrea === "paid" ? paid : cliente.cm_id ?? pm;
      if (!quien) continue;
      await admin.from("tasks").insert({
        titulo: `Crear la cuenta de ${def.nombre} de ${cliente.nombre}`,
        descripcion: `${cliente.nombre} marcó en su plataforma que no tiene ${def.nombre}. Creala con la identidad de la marca, cargá el usuario y la contraseña en la ficha del cliente (Credenciales) y avisale por el grupo.`,
        cliente_id: cliente.id,
        asignado_a_id: quien,
        creado_por_id: pm ?? quien,
        area: def.quienCrea === "paid" ? "Paid Media" : "Community Manager",
        prioridad: "alta",
        estado: "pendiente",
        fecha_limite: limite,
        rutina_key: `crear-cuenta:${cliente.id}:${f.red}`,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
