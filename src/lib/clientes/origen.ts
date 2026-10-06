/**
 * De dónde vino cada cliente (0191, 6/10/2026).
 *
 * Sin este dato no se sabe dónde poner la plata: en septiembre entraron 9
 * cuentas y no había forma de saber si vinieron por la pauta, por un referido
 * o por la prospección. Se completa solo cuando el cliente nace de un contacto
 * de prospección o de un lead de la web; en el resto es un selector.
 *
 * Puro, para probarlo sin base.
 */

export const ORIGENES = [
  { value: "referido", label: "Referido" },
  { value: "pauta", label: "Pauta (anuncios)" },
  { value: "prospeccion", label: "Prospección" },
  { value: "redes", label: "Nos escribió por redes" },
  { value: "web", label: "Web" },
  { value: "contacto_propio", label: "Contacto propio" },
  { value: "otro", label: "Otro" },
] as const;

export type Origen = (typeof ORIGENES)[number]["value"];

const VALORES = new Set<string>(ORIGENES.map((o) => o.value));

export function esOrigen(v: unknown): v is Origen {
  return typeof v === "string" && VALORES.has(v);
}

export function labelOrigen(v: string | null | undefined): string {
  return ORIGENES.find((o) => o.value === v)?.label ?? "Sin dato";
}

/**
 * El origen de un lead del pipeline (texto libre: "web", "Instagram",
 * "referido de Juan", "anuncio"...) llevado a la lista cerrada.
 */
export function origenDeLead(texto: string | null | undefined): Origen | null {
  const t = (texto ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "web" || t.includes("formulario") || t.includes("sitio")) return "web";
  if (/(referid|recomend|boca)/.test(t)) return "referido";
  if (/(pauta|anuncio|ads|campa)/.test(t)) return "pauta";
  if (/(prospec|fr[ií]o|mail)/.test(t)) return "prospeccion";
  if (/(insta|^ig$|facebook|tiktok|redes|whats|^wa$)/.test(t)) return "redes";
  return "otro";
}

export interface ClienteConOrigen {
  origen: string | null;
  monto_mensual: number | null;
}

export interface FilaOrigen {
  origen: Origen | null;
  label: string;
  cuentas: number;
  monto: number;
}

/** Cuántas cuentas y cuánta facturación trae cada origen, de mayor a menor. */
export function resumenOrigenes(clientes: ClienteConOrigen[]): FilaOrigen[] {
  const m = new Map<Origen | null, FilaOrigen>();
  for (const c of clientes) {
    const o = esOrigen(c.origen) ? c.origen : null;
    const f = m.get(o) ?? { origen: o, label: labelOrigen(o), cuentas: 0, monto: 0 };
    f.cuentas++;
    f.monto += Number(c.monto_mensual ?? 0);
    m.set(o, f);
  }
  // "Sin dato" al final: no es un canal.
  return [...m.values()].sort(
    (a, b) => Number(a.origen === null) - Number(b.origen === null) || b.monto - a.monto
  );
}
