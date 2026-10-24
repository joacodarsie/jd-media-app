/** Lo que habla con la base para el Área Creativa (ver creativa.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/types";
import {
  estadoCalendario,
  mesesCreativos,
  pasosCreativos,
  vigencia,
  type DefinicionCreativa,
  type Entregable,
  type EstadoCalendario,
  type PasoCreativo,
  type Vigencia,
} from "./creativa";

export const AREA_CREATIVA = "Coordinación de Diseño";

/** Dirección, la coordinación de diseño y quien tenga esa área (Santi la tiene como secundaria). */
export function puedeCreativa(u: AppUser): boolean {
  return (
    u.rol === "admin" ||
    u.rol === "coordinador_diseno" ||
    u.rol_secundario === "coordinador_diseno" ||
    u.area === AREA_CREATIVA ||
    u.area_secundaria === AREA_CREATIVA
  );
}

export interface DocCampana {
  id: string;
  titulo: string;
  fileName: string;
  storagePath: string;
  entregable: Entregable;
  subido: string;
  subidoPor: string | null;
  inicio: string | null;
  dias: number | null;
  usarEnIa: boolean;
  vigencia: Vigencia;
}

export interface MesCalendario {
  mes: string;
  estado: EstadoCalendario;
  porAprobar: number;
  total: number;
}

export interface CuentaCreativa {
  id: string;
  nombre: string;
  rubro: string | null;
  logo: string | null;
  meses: MesCalendario[];
  docs: DocCampana[];
  /** El documento que vence primero (o ya venció). */
  proximoVencimiento: DocCampana | null;
  pasos: PasoCreativo[];
  definicion: DefinicionCreativa | null;
}

async function pubsDeMeses(admin: SupabaseClient, meses: string[], clienteId?: string) {
  const [ultimo] = meses.slice(-1);
  const [y, m] = ultimo.split("-").map(Number);
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const out: { cliente_id: string; estado: string; fecha_publicacion: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = admin
      .from("publications")
      .select("cliente_id, estado, fecha_publicacion")
      .gte("fecha_publicacion", `${meses[0]}-01`)
      .lt("fecha_publicacion", hasta)
      .range(desde, desde + 999);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    const { data } = await q;
    out.push(...((data ?? []) as typeof out));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function aDoc(d: Record<string, unknown>, nombres: Map<string, string>, hoy: string): DocCampana {
  const inicio = (d.campana_inicio as string | null) ?? null;
  const dias = (d.campana_dias as number | null) ?? null;
  return {
    id: String(d.id),
    titulo: String(d.titulo),
    fileName: String(d.file_name ?? ""),
    storagePath: String(d.storage_path ?? ""),
    entregable: ((d.entregable as Entregable | null) ?? "otro") as Entregable,
    subido: String(d.created_at).slice(0, 10),
    subidoPor: d.subido_por_id ? nombres.get(String(d.subido_por_id)) ?? null : null,
    inicio,
    dias,
    usarEnIa: d.usar_en_ia !== false,
    vigencia: vigencia(inicio, dias, hoy),
  };
}

const ordenVence = (a: DocCampana, b: DocCampana) => (a.vigencia.diasRestantes ?? 9999) - (b.vigencia.diasRestantes ?? 9999);

export async function cargarCuentasCreativas(admin: SupabaseClient, hoy: string, soloId?: string): Promise<CuentaCreativa[]> {
  const meses = mesesCreativos(hoy);
  let qc = admin.from("clients").select("id, nombre, rubro, logo_url").eq("estado", "activo").eq("es_interno", false).order("nombre");
  if (soloId) qc = admin.from("clients").select("id, nombre, rubro, logo_url").eq("id", soloId);
  const [{ data: cRaw }, pubs, { data: dRaw }, { data: oRaw }, { data: uRaw }] = await Promise.all([
    qc,
    pubsDeMeses(admin, meses, soloId),
    (soloId ? admin.from("documents").select("*").eq("cliente_id", soloId) : admin.from("documents").select("*").not("cliente_id", "is", null))
      .not("entregable", "is", null)
      .order("created_at", { ascending: false }),
    (soloId ? admin.from("client_onboarding").select("*").eq("cliente_id", soloId) : admin.from("client_onboarding").select("*")),
    admin.from("users").select("id, nombre"),
  ]);
  const nombres = new Map(((uRaw ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre.split(" ")[0]]));
  const docsPor = new Map<string, DocCampana[]>();
  for (const d of (dRaw ?? []) as Record<string, unknown>[]) {
    const k = String(d.cliente_id);
    docsPor.set(k, [...(docsPor.get(k) ?? []), aDoc(d, nombres, hoy)]);
  }
  const onbPor = new Map(((oRaw ?? []) as Record<string, unknown>[]).map((o) => [String(o.cliente_id), o]));
  return ((cRaw ?? []) as { id: string; nombre: string; rubro: string | null; logo_url: string | null }[]).map((c) => {
    const docs = docsPor.get(c.id) ?? [];
    const o = onbPor.get(c.id);
    const definicion: DefinicionCreativa | null = o
      ? {
          dc_identidad: (o.dc_identidad as string | null) ?? null,
          dc_tono: (o.dc_tono as string | null) ?? null,
          dc_medios: (o.dc_medios as DefinicionCreativa["dc_medios"]) ?? {},
          dc_urgencia: (o.dc_urgencia as DefinicionCreativa["dc_urgencia"]) ?? null,
          dc_objetivo: (o.dc_objetivo as string | null) ?? null,
        }
      : null;
    return {
      id: c.id,
      nombre: c.nombre,
      rubro: c.rubro,
      logo: c.logo_url,
      meses: meses.map((mes) => ({ mes, ...estadoCalendario(pubs.filter((p) => p.cliente_id === c.id && p.fecha_publicacion.startsWith(mes)).map((p) => p.estado)) })),
      docs,
      proximoVencimiento: [...docs].filter((d) => d.vigencia.vence).sort(ordenVence)[0] ?? null,
      pasos: pasosCreativos(definicion, new Set(docs.map((d) => d.entregable))),
      definicion,
    };
  });
}
