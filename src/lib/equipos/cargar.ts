/**
 * Lo que necesita la sección Equipos (24/10/2026): cada equipo con su gente,
 * sus cuentas y cómo viene cada una, más la capacidad contra la meta de 50.
 * Las cuentas son las activas; la salud sale de computeAccountHealth.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAccountHealth, type Semaforo } from "@/lib/director/health";
import { META_CLIENTES } from "@/lib/comercial/machine-kpis";
import { sumarDias } from "@/lib/retencion/onboarding-15";
import {
  capacidad,
  cargaPorPersona,
  diferencias,
  equipoSugerido,
  lugares,

  type Capacidad,
  type CargaPersona,
  type CuentaDeEquipo,
  type EquipoBase,
  type Lugar,
} from "./equipos";

export interface CuentaVista extends CuentaDeEquipo {
  semaforo: Semaforo | null;
  alertas: string[];
  planHechas: number;
  planMeta: number;
  piezasAtrasadas: number;
  ideasSinAprobar: number;
  tareasVencidas: number;
  diferencias: string[];
}

export interface Persona {
  id: string;
  nombre: string;
  avatar_url: string | null;
  vencidas: number;
}

export interface EquipoVista extends EquipoBase {
  notas: string | null;
  miembros: { id: string; rol: string }[];
  cuentas: CuentaVista[];
  lugar: Lugar;
}

export interface DatosEquipos {
  equipos: EquipoVista[];
  fuera: CuentaVista[];
  personas: Map<string, Persona>;
  capacidad: Capacidad;
  sugerido: Lugar | null;
  carga: CargaPersona[];
}

export async function cargarEquipos(admin: SupabaseClient, hoy: string): Promise<DatosEquipos> {
  const desdeMes = `${hoy.slice(0, 7)}-01`;
  const [{ data: tRaw }, { data: cRaw }, { data: uRaw }, { data: pubsRaw }, { data: tareasRaw }, salud] = await Promise.all([
    admin.from("teams").select("id, nombre, orden, tope, cm_id, disenador_id, audiovisual_id, media_buyer_id, extra_ids, notas").order("orden"),
    admin.from("clients").select("id, nombre, team_id, cm_id, disenador_id, audiovisual_id, media_buyer_id").eq("estado", "activo").eq("es_interno", false).order("nombre"),
    admin.from("users").select("id, nombre, avatar_url").eq("activo", true),
    admin
      .from("publications")
      .select("cliente_id, estado, fecha_publicacion")
      .gte("fecha_publicacion", desdeMes)
      .lte("fecha_publicacion", sumarDias(hoy, 14))
      .neq("estado", "publicado")
      .limit(1000),
    admin.from("tasks").select("cliente_id, asignado_a_id").not("estado", "in", "(completada,archivada)").lt("fecha_limite", hoy).limit(1000),
    computeAccountHealth(admin as never).catch(() => null),
  ]);

  const equiposBase = ((tRaw ?? []) as (EquipoBase & { notas: string | null; extra_ids: string[] | null; tope: number | null })[]).map((e) => ({
    ...e,
    tope: e.tope ?? 8,
    extra_ids: e.extra_ids ?? [],
  }));
  const cuentasBase = (cRaw ?? []) as CuentaDeEquipo[];
  const nombres = new Map(((uRaw ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const nombre = (id: string) => (nombres.get(id) ?? "alguien que ya no está").split(" ")[0];

  const atrasadas = new Map<string, number>();
  const ideas = new Map<string, number>();
  for (const p of (pubsRaw ?? []) as { cliente_id: string; estado: string; fecha_publicacion: string | null }[]) {
    const f = (p.fecha_publicacion ?? "").slice(0, 10);
    if (!f) continue;
    if (f < hoy) atrasadas.set(p.cliente_id, (atrasadas.get(p.cliente_id) ?? 0) + 1);
    else if (p.estado === "idea") ideas.set(p.cliente_id, (ideas.get(p.cliente_id) ?? 0) + 1);
  }
  const vencidasCuenta = new Map<string, number>();
  const vencidasPersona = new Map<string, number>();
  for (const t of (tareasRaw ?? []) as { cliente_id: string | null; asignado_a_id: string | null }[]) {
    if (t.cliente_id) vencidasCuenta.set(t.cliente_id, (vencidasCuenta.get(t.cliente_id) ?? 0) + 1);
    if (t.asignado_a_id) vencidasPersona.set(t.asignado_a_id, (vencidasPersona.get(t.asignado_a_id) ?? 0) + 1);
  }
  const saludDe = new Map((salud?.cuentas ?? []).map((c) => [c.id, c]));

  const porEquipo = new Map(equiposBase.map((e) => [e.id, e]));
  const vista = (c: CuentaDeEquipo): CuentaVista => {
    const s = saludDe.get(c.id);
    const e = c.team_id ? porEquipo.get(c.team_id) : undefined;
    return {
      ...c,
      semaforo: s?.semaforo ?? null,
      alertas: s?.alertas ?? [],
      planHechas: s?.planHechas ?? 0,
      planMeta: s?.planMeta ?? 0,
      piezasAtrasadas: atrasadas.get(c.id) ?? 0,
      ideasSinAprobar: ideas.get(c.id) ?? 0,
      tareasVencidas: vencidasCuenta.get(c.id) ?? 0,
      diferencias: e ? diferencias(c, e, nombre) : [],
    };
  };

  const l = lugares(equiposBase, cuentasBase);
  const lugarDe = new Map(l.map((x) => [x.id, x]));
  const equipos: EquipoVista[] = equiposBase.map((e) => ({
    ...e,
    miembros: [
      ...(e.cm_id ? [{ id: e.cm_id, rol: "CM" }] : []),
      ...(e.disenador_id ? [{ id: e.disenador_id, rol: "Diseño" }] : []),
      ...e.extra_ids.map((id) => ({ id, rol: "También" })),
      ...(e.audiovisual_id ? [{ id: e.audiovisual_id, rol: "Edición" }] : []),
      ...(e.media_buyer_id ? [{ id: e.media_buyer_id, rol: "Pauta" }] : []),
    ],
    cuentas: cuentasBase.filter((c) => c.team_id === e.id).map(vista),
    lugar: lugarDe.get(e.id)!,
  }));

  const personas = new Map<string, Persona>();
  for (const u of (uRaw ?? []) as { id: string; nombre: string; avatar_url: string | null }[])
    personas.set(u.id, { ...u, vencidas: vencidasPersona.get(u.id) ?? 0 });

  return {
    equipos,
    fuera: cuentasBase.filter((c) => !c.team_id).map(vista),
    personas,
    capacidad: capacidad(l, cuentasBase.length, META_CLIENTES),
    sugerido: equipoSugerido(l),
    carga: cargaPorPersona(equiposBase, l),
  };
}
