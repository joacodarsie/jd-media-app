/** El ejecutor del hito de los 3 meses (ver hito-tres-meses.ts). Idempotente por rutina_key. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarCrecimiento } from "@/lib/crecimiento/cargar";
import { claveHito, enHitoTresMeses, frase, limiteHito, mensajeHito, tareaHito } from "./hito-tres-meses";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jd-media-app.vercel.app";
const AREA_DC = "Coordinación de Diseño";

export async function runHitoTresMeses(admin: SupabaseClient, hoy: string): Promise<{ creadas: string[] }> {
  const { data: cRaw } = await admin
    .from("clients")
    .select("id, nombre, contacto_nombre, fecha_inicio, fecha_activado, responsable_id")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const cuentas = ((cRaw ?? []) as {
    id: string;
    nombre: string;
    contacto_nombre: string | null;
    fecha_inicio: string | null;
    fecha_activado: string | null;
    responsable_id: string | null;
  }[])
    .map((c) => ({ ...c, inicio: c.fecha_inicio ?? c.fecha_activado?.slice(0, 10) ?? null }))
    .filter((c) => enHitoTresMeses(c.inicio, hoy));
  if (!cuentas.length) return { creadas: [] };

  const { data: ya } = await admin.from("tasks").select("rutina_key").in("rutina_key", cuentas.map((c) => claveHito(c.id)));
  const hechas = new Set(((ya ?? []) as { rutina_key: string }[]).map((t) => t.rutina_key));
  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const dc = users.find((u) => u.area === AREA_DC || u.area_secundaria === AREA_DC)?.id;
  const dueno = users.find((u) => u.rol === "admin")?.id;

  const creadas: string[] = [];
  for (const c of cuentas) {
    if (hechas.has(claveHito(c.id))) continue;
    const quien = c.responsable_id ?? dc ?? dueno;
    if (!quien) continue;
    const [crec, { data: tk }] = await Promise.all([
      cargarCrecimiento(admin, c.id).catch(() => null),
      admin.from("client_portal_tokens").select("token").eq("cliente_id", c.id).is("revoked_at", null).limit(1),
    ]);
    const antes = crec?.inicio?.seguidores ?? crec?.seguidores[0]?.followers ?? null;
    const ahora = crec?.seguidores[crec.seguidores.length - 1]?.followers ?? crec?.hoy?.seguidores ?? null;
    const token = ((tk ?? []) as { token: string }[])[0]?.token;
    const mensaje = mensajeHito({
      contacto: c.contacto_nombre,
      cuenta: c.nombre,
      crecimiento: frase(antes, ahora),
      link: token ? `${SITIO}/c/${token}#crecimiento` : null,
    });
    const t = tareaHito({ cuenta: c.nombre, clienteId: c.id, mensaje });
    const { error } = await admin.from("tasks").insert({
      titulo: t.titulo,
      descripcion: t.descripcion,
      cliente_id: c.id,
      asignado_a_id: quien,
      creado_por_id: dueno ?? quien,
      area: AREA_DC,
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: limiteHito(c.inicio as string, hoy),
      rutina_key: claveHito(c.id),
    });
    if (!error) creadas.push(c.nombre);
  }
  return { creadas };
}
