/**
 * El sueldo de una persona ordenado como la planilla: una fila por cuenta y
 * una columna por concepto.
 *
 * Por qué: el dueño lleva los sueldos en un Excel con esa forma exacta
 * (cuentas en las filas; Directora / CM / Jornada / Creativa / Editora en las
 * columnas) y necesita comparar de un vistazo si lo que dice la app coincide.
 * La lista plana de la tarjeta no se puede cruzar contra eso sin ir línea por
 * línea.
 *
 * Puro: la tabla se arma acá y se testea sin pantalla.
 */

export interface LineaSueldo {
  cliente: string | null;
  concepto: string;
  monto: number;
}

export interface FilaDesglose {
  cliente: string;
  /** Monto por concepto. Los conceptos sin monto no aparecen. */
  valores: Record<string, number>;
  total: number;
}

export interface Desglose {
  /** Columnas, en el orden en que conviene leerlas. */
  conceptos: string[];
  filas: FilaDesglose[];
  totalPorConcepto: Record<string, number>;
  total: number;
}

/** Lo que no está atado a una cuenta va agrupado al final, como los "Extras". */
export const SIN_CUENTA = "Extras / sin cuenta";

/**
 * Nombre corto del concepto para que entre como encabezado de columna.
 * Los conceptos de la app son descriptivos ("Coordinación gestión de redes
 * (10%)") y como título de columna no entran.
 */
export function tituloConcepto(concepto: string): string {
  const c = concepto.toLowerCase();
  if (c.includes("coordinaci")) return "Coordinación";
  if (c.includes("media buyer") || c.includes("pauta")) return "Pauta";
  if (c.includes("jornada")) return "Jornada";
  if (c.includes("manual de marca")) return "Manual de marca";
  if (c.includes("portada")) return "Portadas";
  if (c.includes("edici") || c.includes("editor")) return "Edición";
  if (c.includes("carrusel") || c.includes("post") || c.includes("diseñ")) return "Diseño";
  if (c.includes("community") || c.includes("cm ")) return "CM";
  if (c.includes("comisi")) return "Comisión";
  if (c.includes("gestión completa") || c.includes("gestion completa")) return "Gestión completa";
  // Si no se reconoce, se usa el concepto tal cual pero recortado.
  return concepto.length > 22 ? concepto.slice(0, 21) + "…" : concepto;
}

/** Orden de columnas: primero lo recurrente, después lo puntual. */
const ORDEN = [
  "Gestión completa",
  "Coordinación",
  "CM",
  "Pauta",
  "Diseño",
  "Edición",
  "Manual de marca",
  "Portadas",
  "Jornada",
  "Comisión",
];

export function armarDesglose(lineas: LineaSueldo[]): Desglose {
  const porCliente = new Map<string, Record<string, number>>();
  const totalPorConcepto: Record<string, number> = {};
  let total = 0;

  for (const l of lineas) {
    const monto = Number(l.monto) || 0;
    if (!monto) continue;
    const cliente = l.cliente?.trim() && l.cliente !== "—" ? l.cliente.trim() : SIN_CUENTA;
    const col = tituloConcepto(l.concepto);
    const fila = porCliente.get(cliente) ?? {};
    fila[col] = (fila[col] ?? 0) + monto;
    porCliente.set(cliente, fila);
    totalPorConcepto[col] = (totalPorConcepto[col] ?? 0) + monto;
    total += monto;
  }

  const conceptos = Object.keys(totalPorConcepto).sort((a, b) => {
    const ia = ORDEN.indexOf(a);
    const ib = ORDEN.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const filas: FilaDesglose[] = [...porCliente.entries()]
    .map(([cliente, valores]) => ({
      cliente,
      valores,
      total: Object.values(valores).reduce((a, b) => a + b, 0),
    }))
    // Alfabético como la planilla, con los "Extras" siempre al final.
    .sort((a, b) => {
      if (a.cliente === SIN_CUENTA) return 1;
      if (b.cliente === SIN_CUENTA) return -1;
      return a.cliente.localeCompare(b.cliente);
    });

  return { conceptos, filas, totalPorConcepto, total };
}
