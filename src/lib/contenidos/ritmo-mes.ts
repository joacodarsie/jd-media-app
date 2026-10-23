/**
 * Ritmo del mes por cuenta (23/10/2026).
 *
 * El «a tiempo %» del Director mira para atrás. Esto mira el mes entero: de lo
 * que tenía que salir hasta ayer, cuánto salió, y qué de lo que viene esta
 * semana todavía no arrancó. Al 23/10, CATCH llevaba 10 de 21 y tenía 6 piezas
 * de la semana sin arrancar: el cliente lo iba a notar antes que nosotros.
 *
 * Puro: entran las piezas del mes de cada cuenta, sale el ritmo.
 */

export interface PubRitmo {
  clienteId: string;
  cliente: string;
  estado: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  frenadoCliente: boolean;
}

export type EstadoRitmo = "atrasada" | "en_riesgo" | "al_dia";

export interface RitmoCuenta {
  clienteId: string;
  cliente: string;
  /** Piezas del mes (sin las rechazadas). */
  plan: number;
  /** Las que tenían fecha hasta ayer. */
  deberian: number;
  salieron: number;
  /** Fecha pasada, sin salir, y la pelota es nuestra. */
  atrasadas: number;
  /** Fecha pasada, sin salir, esperando al cliente. */
  esperandoCliente: number;
  /** De acá a una semana y todavía sin arrancar (o en diseño a 2 días). */
  enRiesgo: number;
  estado: EstadoRitmo;
}

/** Sin arrancar: todavía no hay diseño ni edición. */
const SIN_ARRANCAR = ["idea", "guion"];
/** Arrancadas pero lejos de estar listas. */
const EN_PRODUCCION = ["en_diseno", "edicion", "revision_creativa"];

const diaUtc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const diasHasta = (hoy: string, fecha: string) => Math.round((diaUtc(fecha) - diaUtc(hoy)) / 86_400_000);

export function ritmoCuenta(pubs: PubRitmo[], hoy: string): RitmoCuenta {
  const vivas = pubs.filter((p) => p.estado !== "rechazado");
  let deberian = 0;
  let salieron = 0;
  let atrasadas = 0;
  let esperandoCliente = 0;
  let enRiesgo = 0;
  for (const p of vivas) {
    const publicada = p.estado === "publicado";
    if (publicada) salieron++;
    const dias = diasHasta(hoy, p.fecha);
    if (dias < 0) {
      deberian++;
      if (!publicada) {
        if (p.frenadoCliente || p.estado === "revision_cliente") esperandoCliente++;
        else atrasadas++;
      }
    } else if (!publicada && !p.frenadoCliente) {
      if ((SIN_ARRANCAR.includes(p.estado) && dias <= 6) || (EN_PRODUCCION.includes(p.estado) && dias <= 1)) enRiesgo++;
    }
  }
  // Una sola atrasada es el día a día (12 de 16 cuentas la tenían al 23/10): se
  // ve en la fila, pero la cuenta no se pinta de rojo.
  const estado: EstadoRitmo = atrasadas >= 2 ? "atrasada" : enRiesgo >= 2 ? "en_riesgo" : "al_dia";
  return {
    clienteId: vivas[0]?.clienteId ?? pubs[0]?.clienteId ?? "",
    cliente: vivas[0]?.cliente ?? pubs[0]?.cliente ?? "",
    plan: vivas.length,
    deberian,
    salieron,
    atrasadas,
    esperandoCliente,
    enRiesgo,
    estado,
  };
}

/** Todas las cuentas, la peor primero. Las que no tienen nada cargado no entran. */
export function ritmoDelMes(pubs: PubRitmo[], hoy: string): RitmoCuenta[] {
  const porCuenta = new Map<string, PubRitmo[]>();
  for (const p of pubs) porCuenta.set(p.clienteId, [...(porCuenta.get(p.clienteId) ?? []), p]);
  const orden: Record<EstadoRitmo, number> = { atrasada: 0, en_riesgo: 1, al_dia: 2 };
  return [...porCuenta.values()]
    .map((l) => ritmoCuenta(l, hoy))
    .filter((r) => r.plan > 0)
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.atrasadas - a.atrasadas || b.enRiesgo - a.enRiesgo || a.cliente.localeCompare(b.cliente));
}
