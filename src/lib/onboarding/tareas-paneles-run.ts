/**
 * Las tareas de cada pestaña del onboarding, contra la base (24/10/2026).
 *
 * Qué tareas van lo decide `tareas-paneles.ts` (puro). Acá:
 *  - `faltantesDePaneles`: qué pasos le faltan a cada pestaña, leído con el
 *    admin, igual que las pantallas del onboarding.
 *  - `asegurarTareasDePaneles`: crea las que faltan (una sola vez por pestaña,
 *    aunque se archive) y cierra solas las de las pestañas completas.
 *  - `runTareasDePaneles`: lo de arriba para cada cuenta en arranque, en el cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOnboarding, type Stage } from "@/app/(app)/clientes/[id]/onboarding/_shared";
import { cargarCuentasCreativas } from "@/lib/creativa/cargar";
import { AREA_PM } from "@/lib/tareas/puerta";
import { sumarDias } from "@/lib/retencion/onboarding-15";
import { diasEntre, DIAS_PARA_ARRANCAR } from "@/lib/retencion/onboarding-pendiente";
import type { PanelOnboarding } from "./paneles";
import { descripcionConFaltantes, tareasDePaneles } from "./tareas-paneles";

type Admin = SupabaseClient;

/** Los pasos de la pestaña de publicidad (los mismos de AdsOnboardingChecklist). */
const PASOS_PAUTA: [string, string][] = [
  ["accesos_fb_at", "Pedir accesos a Facebook del cliente"],
  ["pagina_fb_at", "Página de Facebook vinculada a su Instagram"],
  ["socio_business_at", "Acceso como socio al Business del cliente"],
  ["ads_manager_at", "Business Manager / Administrador de anuncios"],
  ["su_adaccount_at", "Asignar la cuenta publicitaria al system user"],
  ["su_pagina_at", "Asignar la página de Facebook al system user"],
  ["su_ig_at", "Asignar la cuenta de Instagram al system user y conectarla"],
  ["dolar_app_at", "Cliente descarga Dólar App"],
  ["tarjeta_vinculada_at", "Vincular tarjeta global de Dólar App"],
  ["campanas_definidas_at", "Definir y armar las campañas clave"],
  ["campanas_publicadas_at", "Publicar las campañas"],
];
/** Se marcan solos cuando la plataforma trae datos del Instagram. */
const PAUTA_VERIFICADOS = new Set(["su_pagina_at", "su_ig_at"]);

/** Los pasos de publicidad sin hacer. */
export function faltantesDePauta(fila: Record<string, unknown>, igOk: boolean): string[] {
  return PASOS_PAUTA.filter(([k]) => (PAUTA_VERIFICADOS.has(k) ? !igOk : !fila[k])).map(([, t]) => t);
}

/** Qué pasos le faltan a cada pestaña de la cuenta. */
export async function faltantesDePaneles(admin: Admin, clienteId: string, hoy: string): Promise<Partial<Record<PanelOnboarding, string[]>> | null> {
  const data = await loadOnboarding(clienteId, admin);
  if (!data) return null;
  const out: Partial<Record<PanelOnboarding, string[]>> = {};
  for (const st of ["inicial", "redes", "cm", "diseno"] as Stage[]) {
    out[st] = data.steps.filter((s) => s.stage === st && !s.done).map((s) => s.title);
  }
  const [c] = await cargarCuentasCreativas(admin, hoy, clienteId);
  out.creativa = c ? c.pasos.filter((p) => !p.hecho).map((p) => p.titulo) : [];

  const hace3 = sumarDias(hoy, -3);
  const [{ data: ads }, { count: snaps }] = await Promise.all([
    admin.from("client_ads_onboarding").select("*").eq("cliente_id", clienteId).maybeSingle(),
    admin.from("ig_snapshots").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId).gte("fecha", hace3),
  ]);
  const fila = (ads ?? {}) as Record<string, string | null>;
  const igOk = (snaps ?? 0) > 0;
  out.pauta = faltantesDePauta(fila, igOk);
  return out;
}

export interface ResultadoPaneles {
  creadas: number;
  cerradas: number;
}

export async function asegurarTareasDePaneles(
  admin: Admin,
  clienteId: string,
  hoy: string,
  opts: { crear?: boolean } = {}
): Promise<ResultadoPaneles> {
  const crear = opts.crear ?? true;
  const { data: cRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio, es_interno, cm_id, disenador_id, media_buyer_id, coordinador_id, responsable_id")
    .eq("id", clienteId)
    .maybeSingle();
  const c = cRaw as {
    id: string;
    nombre: string;
    fecha_inicio: string | null;
    es_interno: boolean | null;
    cm_id: string | null;
    disenador_id: string | null;
    media_buyer_id: string | null;
    coordinador_id: string | null;
    responsable_id: string | null;
  } | null;
  if (!c || c.es_interno) return { creadas: 0, cerradas: 0 };

  const [{ data: ya }, faltan] = await Promise.all([
    admin.from("tasks").select("id, rutina_key, estado, descripcion").like("rutina_key", `onb-panel:${clienteId}:%`),
    faltantesDePaneles(admin, clienteId, hoy),
  ]);
  if (!faltan) return { creadas: 0, cerradas: 0 };
  const existentes = new Map(((ya ?? []) as { id: string; rutina_key: string; estado: string; descripcion: string | null }[]).map((t) => [t.rutina_key, t]));

  let creadas = 0;
  let cerradas = 0;

  // Cerrar las de las pestañas que ya están completas.
  for (const [k, t] of Array.from(existentes)) {
    const panel = k.split(":")[2] as PanelOnboarding;
    if (t.estado === "completada" || t.estado === "archivada") continue;
    if ((faltan[panel] ?? []).length === 0) {
      await admin.from("tasks").update({ estado: "completada" }).eq("id", t.id);
      cerradas++;
    }
  }
  if (!crear) return { creadas, cerradas };

  const { data: svcRaw } = await admin.from("client_services").select("tipo").eq("cliente_id", clienteId).eq("activo", true);
  const tipos = ((svcRaw ?? []) as { tipo: string }[]).map((s) => s.tipo);
  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria, email").eq("activo", true);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null; email: string | null }[];
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? users.find((u) => u.rol === "admin")?.id;
  if (!pm) return { creadas, cerradas };
  const dueno = users.find((u) => u.email === "joaquin@jdmedia.com")?.id ?? users.find((u) => u.rol === "admin")?.id ?? null;

  const tareas = tareasDePaneles({
    clienteId,
    nombreCliente: c.nombre,
    servicios: {
      gestionRedes: tipos.includes("gestion_redes"),
      disenoGrafico: tipos.includes("diseno_grafico"),
      paidMedia: tipos.includes("paid_media"),
    },
    equipo: {
      dueno,
      coordinador_id: c.coordinador_id,
      director_creativo_id: c.responsable_id,
      cm_id: c.cm_id,
      disenador_id: c.disenador_id,
      media_buyer_id: c.media_buyer_id,
      fallback: pm,
    },
  });

  // Colgadas del ticket madre del arranque, si está.
  const { data: madre } = await admin
    .from("tasks")
    .select("id")
    .eq("cliente_id", clienteId)
    .like("titulo", "Onboarding 15 días — %")
    .limit(1)
    .maybeSingle();
  const inicio = (c.fecha_inicio ?? hoy).slice(0, 10);
  const nuevas = tareas
    .filter((t) => !existentes.has(t.rutina_key) && (faltan[t.panel] ?? []).length > 0)
    .map((t) => {
      const fecha = sumarDias(inicio, t.dia);
      return {
        titulo: t.titulo,
        descripcion: descripcionConFaltantes(t.descripcion, faltan[t.panel] ?? []),
        cliente_id: clienteId,
        asignado_a_id: t.asignado_a_id,
        creado_por_id: pm,
        area: t.area,
        prioridad: "alta",
        estado: "pendiente",
        // Si la cuenta ya venía andando, no nace vencida: 3 días para ponerse al día.
        fecha_limite: fecha > hoy ? fecha : sumarDias(hoy, 3),
        rutina_key: t.rutina_key,
        parent_id: (madre as { id: string } | null)?.id ?? null,
      };
    });
  // Una por una: si una falla, las otras igual nacen.
  for (const n of nuevas) {
    const { error } = await admin.from("tasks").insert(n);
    if (!error) creadas++;
  }
  return { creadas, cerradas };
}

/** Para el cron: cada cuenta en arranque tiene sus tareas, y las completas se cierran. */
export async function runTareasDePaneles(admin: Admin, hoy: string): Promise<ResultadoPaneles> {
  const { data } = await admin.from("clients").select("id, fecha_inicio, es_interno").eq("estado", "activo");
  const cuentas = ((data ?? []) as { id: string; fecha_inicio: string | null; es_interno: boolean | null }[]).filter((c) => !c.es_interno);
  // Las que ya tienen tarea abierta se siguen mirando aunque pasen los 30 días, para cerrarlas.
  const { data: abiertas } = await admin
    .from("tasks")
    .select("cliente_id")
    .like("rutina_key", "onb-panel:%")
    .not("estado", "in", "(completada,archivada)");
  const conAbiertas = new Set(((abiertas ?? []) as { cliente_id: string }[]).map((t) => t.cliente_id));
  const total: ResultadoPaneles = { creadas: 0, cerradas: 0 };
  for (const c of cuentas) {
    const enArranque = !!c.fecha_inicio && diasEntre(String(c.fecha_inicio).slice(0, 10), hoy) <= DIAS_PARA_ARRANCAR;
    if (!enArranque && !conAbiertas.has(c.id)) continue;
    try {
      const r = await asegurarTareasDePaneles(admin, c.id, hoy, { crear: enArranque });
      total.creadas += r.creadas;
      total.cerradas += r.cerradas;
    } catch {
      /* una cuenta que falla no frena al resto */
    }
  }
  return total;
}

/** Desde la pantalla de la pestaña: si quedó completa, su tarea se cierra al toque. */
export async function cerrarTareaDePanel(admin: Admin, clienteId: string, panel: PanelOnboarding): Promise<void> {
  await admin
    .from("tasks")
    .update({ estado: "completada" })
    .eq("rutina_key", `onb-panel:${clienteId}:${panel}`)
    .not("estado", "in", "(completada,archivada)");
}
