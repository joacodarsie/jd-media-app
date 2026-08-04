/**
 * Reabastecimiento automático de contactos.
 *
 * El equipo tiene que mandar 100 mensajes por día. A ese ritmo, cualquier lista
 * cargada a mano se termina en una semana y la máquina se frena — que es
 * exactamente lo que venía pasando. Este job mira cada campaña activa y, si le
 * quedan pocos contactos sin escribir, trae más de Google Places.
 *
 * Lee el rubro y la zona **de la campaña**, así que una campaña nueva entra sola
 * sin tocar código. Cuando la campaña no tiene zona, rota por ciudades grandes
 * de Argentina para no pedir siempre lo mismo (Google devuelve casi los mismos
 * negocios ante la misma consulta).
 *
 * Plata: cada búsqueda es 1 llamada = hasta 20 negocios. Google regala 1.000 por
 * mes y `searchPlaces` corta solo en el tope de la app (500). Con este job
 * corriendo todos los días hábiles el gasto real es US$0.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchPlaces, filtrarContactables, placesConfigured } from "./places";

/** Si a una campaña le quedan menos que esto sin escribir, se reabastece. */
export const PISO_SIN_ESCRIBIR = 40;
/** Cuántos contactos pedir por campaña en cada reabastecimiento. */
export const LOTE = 40;
/** Tope de campañas a reabastecer por corrida (cada una gasta llamadas). */
export const MAX_CAMPANAS_POR_DIA = 3;

/** Ciudades para rotar cuando la campaña no tiene zona propia. */
export const CIUDADES = [
  "Córdoba, Argentina",
  "Rosario, Argentina",
  "Buenos Aires, Argentina",
  "Mendoza, Argentina",
  "Mar del Plata, Argentina",
  "Tucumán, Argentina",
  "Salta, Argentina",
  "Santa Fe, Argentina",
];

/** Índice de día estable: el mismo día siempre da el mismo número. */
function indiceDelDia(hoy: string): number {
  const [y, m, d] = hoy.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Qué zona pedir hoy.
 *
 * La zona propia de la campaña va primero, pero NO siempre: una ciudad se
 * agota. Probado contra Google: la campaña de arquitectura en Córdoba ya solo
 * devolvía 11 negocios nuevos, contra 38 de una recién empezada. Por eso se rota
 * entre la zona propia y las demás ciudades, y así el pozo se renueva.
 *
 * Determinístico por día: si el cron corre dos veces el mismo día pide lo mismo
 * (y lo repetido se descarta por nombre de empresa), en vez de duplicar gasto.
 */
export function zonaDelDia(ubicacion: string | null, hoy: string): string {
  const propia = ubicacion?.trim();
  const zonas = propia
    ? [propia, ...CIUDADES.filter((c) => c.toLowerCase() !== propia.toLowerCase())]
    : CIUDADES;
  return zonas[indiceDelDia(hoy) % zonas.length];
}

export interface CampanaRefill {
  id: string;
  nombre: string | null;
  rubro: string | null;
  ubicacion: string | null;
  estado: string | null;
}

/**
 * Cuáles reabastecer: activas, con rubro cargado y con pocos contactos sin
 * escribir. Se ordena por la más vacía primero, para que el presupuesto de
 * búsquedas vaya a la que de verdad se está quedando sin nada.
 */
export function campanasAReabastecer(
  campanas: CampanaRefill[],
  sinEscribirPorCampana: Record<string, number>,
  max = MAX_CAMPANAS_POR_DIA
): CampanaRefill[] {
  return campanas
    .filter((c) => c.estado === "activa" && !!c.rubro?.trim())
    .filter((c) => (sinEscribirPorCampana[c.id] ?? 0) < PISO_SIN_ESCRIBIR)
    .sort(
      (a, b) => (sinEscribirPorCampana[a.id] ?? 0) - (sinEscribirPorCampana[b.id] ?? 0)
    )
    .slice(0, max);
}

export interface RefillResultado {
  configurado: boolean;
  campanas: { nombre: string; zona: string; traidos: number; error?: string }[];
  nuevos: number;
}

export async function runRefillContactos(
  admin: SupabaseClient,
  hoy: string
): Promise<RefillResultado> {
  if (!placesConfigured()) return { configurado: false, campanas: [], nuevos: 0 };

  const [{ data: campRaw }, { data: contRaw }] = await Promise.all([
    admin.from("prospecting_campaigns").select("id, nombre, rubro, ubicacion, estado"),
    admin.from("prospecting_contacts").select("campaign_id, empresa, estado"),
  ]);

  const contactos = (contRaw ?? []) as {
    campaign_id: string;
    empresa: string;
    estado: string | null;
  }[];

  const sinEscribir: Record<string, number> = {};
  for (const c of contactos) {
    if (c.estado === "nuevo") sinEscribir[c.campaign_id] = (sinEscribir[c.campaign_id] ?? 0) + 1;
  }

  const elegidas = campanasAReabastecer((campRaw ?? []) as CampanaRefill[], sinEscribir);
  const out: RefillResultado = { configurado: true, campanas: [], nuevos: 0 };

  for (const c of elegidas) {
    const zona = zonaDelDia(c.ubicacion, hoy);
    // Las empresas que ya tenemos (de CUALQUIER campaña) no se vuelven a pedir:
    // escribirle dos veces a la misma empresa desde dos campañas queda pésimo.
    const yaTengo = contactos.map((x) => x.empresa);
    try {
      const encontrados = await searchPlaces({
        rubro: c.rubro!,
        ubicacion: zona,
        cantidad: LOTE,
        excludeEmpresas: yaTengo,
      });
      const contactables = filtrarContactables(encontrados);
      let traidos = 0;
      for (const ct of contactables) {
        const row: Record<string, unknown> = {
          campaign_id: c.id,
          empresa: ct.empresa,
          telefono: ct.telefono,
          sitio_web: ct.sitio_web,
          notas: ct.direccion,
          fuente: "places",
        };
        let err = (await admin.from("prospecting_contacts").insert(row)).error;
        if (err && (err as { code?: string }).code === "42703") {
          delete row.sitio_web;
          err = (await admin.from("prospecting_contacts").insert(row)).error;
        }
        if (!err) {
          traidos++;
          contactos.push({ campaign_id: c.id, empresa: ct.empresa, estado: "nuevo" });
        }
      }
      out.campanas.push({ nombre: c.nombre ?? c.id, zona, traidos });
      out.nuevos += traidos;
    } catch (e) {
      // El tope mensual de Google llega acá como error: se corta y se avisa.
      out.campanas.push({
        nombre: c.nombre ?? c.id,
        zona,
        traidos: 0,
        error: e instanceof Error ? e.message : "falló",
      });
      break;
    }
  }

  return out;
}
