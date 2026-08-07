/**
 * Corrida de la conciliación Instagram ↔ calendario.
 *
 * De dónde salen los datos: NO llama a la API de Instagram. El sync diario ya
 * guarda todo el feed del mes en `ig_snapshots.detalle.media`, así que esto es
 * una lectura de la base — se puede correr en cada carga de la pantalla sin
 * gastar cuota de Meta.
 *
 * Qué aplica solo: únicamente los cruces de confianza alta (mismo identificador
 * de Instagram, o el copy y el caption son el mismo texto). Lo dudoso queda
 * para que una persona confirme con un clic.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import {
  conciliar,
  matchesAutomaticos,
  matchesADudar,
  resumirConciliacion,
  type Conciliacion,
  type MatchConciliado,
  type MediaIg,
  type PiezaConciliable,
} from "./conciliar";

type Admin = ReturnType<typeof createAdmin>;

export interface ResultadoCuenta {
  clienteId: string;
  clienteNombre: string;
  /** Fecha del snapshot del que salió el feed. */
  fechaSnapshot: string | null;
  rango: { desde: string; hasta: string };
  conciliacion: Conciliacion;
  /** Cruces de confianza alta que quedaron marcados en esta corrida. */
  aplicados: MatchConciliado[];
  /** Cruces que necesitan confirmación humana. */
  dudosos: MatchConciliado[];
  resumen: ReturnType<typeof resumirConciliacion>;
  nota?: string;
}

function primerDiaDelMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function finDeMes(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ymd.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * El feed del mes que dejó el último snapshot de la cuenta.
 *
 * `confiable` responde a: si el feed vino vacío, ¿es que no publicaron nada o
 * que la API no nos dejó ver? Se resuelve mirando `media_count` (el total de
 * publicaciones de la cuenta): si no se movió desde el primer snapshot del mes,
 * el vacío es real y las piezas que figuran publicadas son fantasmas de verdad.
 */
async function feedDelSnapshot(
  admin: Admin,
  clienteId: string,
): Promise<{ fecha: string; media: MediaIg[]; confiable: boolean } | null> {
  const { data } = await admin
    .from("ig_snapshots")
    .select("fecha, media_count, detalle")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as
    | { fecha: string; media_count: number | null; detalle: unknown }
    | undefined;
  if (!row) return null;
  const detalle = (row.detalle ?? {}) as { media?: MediaIg[] };
  const media = Array.isArray(detalle.media) ? detalle.media : [];
  if (media.length > 0) return { fecha: row.fecha, media, confiable: true };

  // Ojo: tiene que ser un snapshot ANTERIOR. Comparar la fila con sí misma
  // (cuenta recién conectada, o el 1° del mes) no prueba nada.
  const { data: primeros } = await admin
    .from("ig_snapshots")
    .select("fecha, media_count")
    .eq("cliente_id", clienteId)
    .gte("fecha", primerDiaDelMes(row.fecha))
    .lt("fecha", row.fecha)
    .order("fecha", { ascending: true })
    .limit(1);
  const primero = (primeros ?? [])[0] as { media_count: number | null } | undefined;
  const confiable =
    primero != null &&
    row.media_count != null &&
    primero.media_count != null &&
    row.media_count === primero.media_count;
  return { fecha: row.fecha, media, confiable };
}

/**
 * Concilia una cuenta. `aplicar` marca como publicadas las de confianza alta.
 */
export async function conciliarCuenta(
  admin: Admin,
  cliente: { id: string; nombre: string },
  opts: { aplicar?: boolean } = {},
): Promise<ResultadoCuenta> {
  const hoy = hoyYmd();
  const feed = await feedDelSnapshot(admin, cliente.id);
  const fechaSnapshot = feed?.fecha ?? null;
  // El snapshot trae el feed desde el 1° del mes en el que se tomó.
  const base = fechaSnapshot ?? hoy;
  const desde = primerDiaDelMes(base);
  const hasta = base < hoy ? base : hoy;

  const { data: pubsRaw } = await admin
    .from("publications")
    .select("id, titulo, copy, tipo, red, estado, fecha_publicacion, ig_media_id")
    .eq("cliente_id", cliente.id)
    .gte("fecha_publicacion", desde)
    .lte("fecha_publicacion", `${finDeMes(base)}T23:59:59`);

  const piezas = (pubsRaw ?? []) as PiezaConciliable[];
  const c = conciliar(piezas, feed?.media ?? [], {
    desde,
    hasta,
    feedConfiable: feed?.confiable ?? false,
  });

  // Un cruce ya descartado a mano no vuelve a proponerse (si la migración 0152
  // todavía no está aplicada, simplemente no hay descartes).
  const descartados = await descartesDe(admin, cliente.id);
  const dudosos = matchesADudar(c).filter((m) => !descartados.has(`${m.piezaId}::${m.mediaId}`));
  // Un posteo descartado sin pieza ("esto no lo hicimos nosotros") se guarda con
  // publication_id vacío y deja de aparecer en la lista de huérfanos.
  const sinPieza = c.sinPieza.filter((m) => !descartados.has(`::${m.id}`));

  const automaticos = matchesAutomaticos(c);
  let aplicados: MatchConciliado[] = [];
  if (opts.aplicar && automaticos.length > 0) {
    aplicados = await aplicarMatches(admin, automaticos);
  }

  return {
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    fechaSnapshot,
    rango: { desde, hasta },
    conciliacion: { ...c, sinPieza },
    aplicados: opts.aplicar ? aplicados : automaticos,
    dudosos,
    resumen: resumirConciliacion(c),
    nota: !feed
      ? "Todavía no hay datos de Instagram de esta cuenta (falta que corra el sync diario)."
      : feed.media.length === 0
        ? feed.confiable
          ? "Esta cuenta no publicó NADA en el mes: el total de publicaciones de su Instagram no se movió."
          : "Instagram no devolvió posteos de esta cuenta y no se puede confirmar que sea porque no publicó. No se marca nada."
        : undefined,
  };
}

/** Marca las piezas como publicadas y les guarda el link real del posteo. */
export async function aplicarMatches(
  admin: Admin,
  matches: MatchConciliado[],
): Promise<MatchConciliado[]> {
  const hechos: MatchConciliado[] = [];
  for (const m of matches) {
    const { error } = await admin
      .from("publications")
      .update({
        estado: "publicado",
        ig_media_id: m.mediaId,
        ig_permalink: m.permalink,
        link_instagram: m.permalink,
      })
      .eq("id", m.piezaId);
    // `published_at` se deja como está a propósito: ese campo significa "la
    // publicó el robot", y estas salieron a mano.
    if (!error) hechos.push(m);
  }
  return hechos;
}

/** Cruces que alguien descartó a mano, como claves "piezaId::mediaId". */
async function descartesDe(admin: Admin, clienteId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("ig_conciliacion_descartes")
    .select("publication_id, ig_media_id")
    .eq("cliente_id", clienteId);
  if (error) return new Set();
  return new Set(
    ((data ?? []) as { publication_id: string | null; ig_media_id: string }[]).map(
      (d) => `${d.publication_id ?? ""}::${d.ig_media_id}`,
    ),
  );
}

/**
 * Concilia todas las cuentas activas con Instagram conectado.
 * La usa el cron (aplicando) y la pantalla (solo mirando).
 */
export async function runConciliacionDiaria(
  opts: { aplicar?: boolean; admin?: Admin } = {},
): Promise<{ cuentas: ResultadoCuenta[]; aplicados: number; dudosos: number; fantasmas: number }> {
  const admin = opts.admin ?? createAdmin();
  const { data } = await admin
    .from("clients")
    .select("id, nombre")
    .eq("estado", "activo")
    .not("ig_user_id", "is", null)
    .order("nombre");

  const cuentas: ResultadoCuenta[] = [];
  for (const c of (data ?? []) as { id: string; nombre: string }[]) {
    try {
      cuentas.push(await conciliarCuenta(admin, c, { aplicar: opts.aplicar }));
    } catch {
      /* una cuenta rota no tira abajo la corrida */
    }
  }
  return {
    cuentas,
    aplicados: cuentas.reduce((a, c) => a + c.aplicados.length, 0),
    dudosos: cuentas.reduce((a, c) => a + c.dudosos.length, 0),
    fantasmas: cuentas.reduce((a, c) => a + c.conciliacion.fantasmas.length, 0),
  };
}
