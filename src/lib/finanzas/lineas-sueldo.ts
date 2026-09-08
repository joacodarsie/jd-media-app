/**
 * Junta las líneas calculadas con los ajustes que las compensan, para mostrar
 * UNA fila por concepto.
 *
 * Por qué: para "quitar" una línea que calculó el sistema no se toca el
 * cálculo — se crea un ajuste negativo que la compensa, así queda trazable y
 * solo afecta a ese mes. El total sale bien, pero la pantalla mostraba las dos
 * filas (los $2.000 y los −$2.000) y parecía un error. Acá se resuelven contra
 * la línea original: se ve una sola, tachada si se quitó o con el monto nuevo
 * si se corrigió.
 *
 * Puro y testeado.
 */

export interface LineaAuto {
  cliente: string | null;
  clienteId: string | null;
  concepto: string;
  monto: number;
}

export interface ItemManual {
  id: string;
  tipo: "comision" | "extra" | "ajuste";
  concepto: string;
  monto: number;
  cliente: string | null;
  clienteId: string | null;
}

export interface LineaMostrada {
  cliente: string | null;
  clienteId: string | null;
  concepto: string;
  /** Lo que suma de verdad, ya compensado. */
  monto: number;
  /** Lo que había calculado el sistema, si se corrigió o quitó. */
  montoOriginal: number | null;
  quitada: boolean;
  /** El ajuste que la modificó, para poder deshacerlo desde la fila. */
  ajusteId: string | null;
}

const PREFIJO_QUITA = "Se quita: ";
const PREFIJO_CORRECCION = "Corrección: ";

/** ¿Este ítem manual es la compensación de una línea calculada? */
export function conceptoCompensado(concepto: string): string | null {
  if (concepto.startsWith(PREFIJO_QUITA)) return concepto.slice(PREFIJO_QUITA.length);
  if (concepto.startsWith(PREFIJO_CORRECCION)) return concepto.slice(PREFIJO_CORRECCION.length);
  return null;
}

/**
 * Devuelve las líneas a mostrar y los extras que NO son compensaciones.
 * Un ajuste suelto (un adelanto, un descuento) sigue siendo su propia fila.
 */
export function resolverLineas(
  autoLines: LineaAuto[],
  manualItems: ItemManual[],
): { lineas: LineaMostrada[]; extras: ItemManual[] } {
  const usados = new Set<string>();

  const lineas: LineaMostrada[] = autoLines.map((l) => {
    const comp = manualItems.find(
      (m) =>
        !usados.has(m.id) &&
        conceptoCompensado(m.concepto) === l.concepto &&
        // El ajuste tiene que ser de la misma cuenta: la misma persona puede
        // tener el mismo concepto en dos clientes distintos.
        (m.clienteId ?? null) === (l.clienteId ?? null),
    );
    if (!comp) {
      return {
        cliente: l.cliente,
        clienteId: l.clienteId,
        concepto: l.concepto,
        monto: l.monto,
        montoOriginal: null,
        quitada: false,
        ajusteId: null,
      };
    }
    usados.add(comp.id);
    const monto = l.monto + comp.monto;
    return {
      cliente: l.cliente,
      clienteId: l.clienteId,
      concepto: l.concepto,
      monto,
      montoOriginal: l.monto,
      quitada: monto === 0,
      ajusteId: comp.id,
    };
  });

  return { lineas, extras: manualItems.filter((m) => !usados.has(m.id)) };
}

/** El total, que tiene que dar lo mismo que sumar todo por separado. */
export function totalDeLineas(
  lineas: LineaMostrada[],
  extras: { monto: number }[],
): number {
  return (
    lineas.reduce((a, l) => a + l.monto, 0) + extras.reduce((a, e) => a + e.monto, 0)
  );
}
