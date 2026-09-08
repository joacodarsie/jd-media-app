/**
 * Quién llevaba una cuenta en un mes dado.
 *
 * Por qué existe: el sueldo se calculaba con el responsable ACTUAL de la ficha,
 * así que pasar una cuenta de una persona a otra reescribía el pasado. Caso
 * real: Magic y Amelia pasaron de Milena a Belén el 2 de septiembre de 2026 y
 * agosto —ya cerrado— cambió solo: a Belén le aparecieron $100.000 que no
 * trabajó y a Milena le desaparecieron.
 *
 * Con el historial, cada mes se liquida con quien realmente la llevó. Si el
 * pase cayó a mitad de mes, se reparte por días: el que la llevó 21 de 31 días
 * cobra esa proporción.
 *
 * Puro y testeado: acá se decide plata.
 */

export type RolDeCuenta = "cm" | "disenador" | "audiovisual" | "media_buyer" | "coordinador";

export interface Asignacion {
  clienteId: string;
  rol: RolDeCuenta;
  userId: string;
  /** "YYYY-MM-DD". Desde cuándo la lleva. */
  desde: string;
  /** "YYYY-MM-DD" o null si sigue vigente. Inclusive: ese día todavía la llevó. */
  hasta: string | null;
}

export interface Tenencia {
  userId: string;
  /** Días del mes en que la llevó. */
  dias: number;
  /** Proporción del mes, de 0 a 1. */
  fraccion: number;
}

/** Días que tiene el mes de un período "YYYY-MM". */
export function diasDelMes(periodo: string): number {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function primerDia(periodo: string): string {
  return periodo + "-01";
}

function ultimoDia(periodo: string): string {
  return periodo + "-" + String(diasDelMes(periodo)).padStart(2, "0");
}

/** Días de solapamiento entre [aDesde,aHasta] y [bDesde,bHasta], inclusive. */
function diasEnComun(aDesde: string, aHasta: string, bDesde: string, bHasta: string): number {
  const desde = aDesde > bDesde ? aDesde : bDesde;
  const hasta = aHasta < bHasta ? aHasta : bHasta;
  if (desde > hasta) return 0;
  const d1 = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const d2 = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((d2 - d1) / 86_400_000) + 1;
}

/**
 * Quiénes llevaron la cuenta en ese rol durante el período, con su proporción.
 * Ordenado de mayor a menor tenencia. Vacío si nadie la llevó ese mes.
 */
export function quienLlevaba(
  asignaciones: Asignacion[],
  clienteId: string,
  rol: RolDeCuenta,
  periodo: string
): Tenencia[] {
  const ini = primerDia(periodo);
  const fin = ultimoDia(periodo);
  const total = diasDelMes(periodo);

  const porUsuario = new Map<string, number>();
  for (const a of asignaciones) {
    if (a.clienteId !== clienteId || a.rol !== rol) continue;
    const dias = diasEnComun(a.desde, a.hasta ?? "9999-12-31", ini, fin);
    if (dias <= 0) continue;
    porUsuario.set(a.userId, (porUsuario.get(a.userId) ?? 0) + dias);
  }

  return [...porUsuario.entries()]
    .map(([userId, d]) => {
      const dias = Math.min(d, total);
      return { userId, dias, fraccion: dias / total };
    })
    .sort((a, b) => b.dias - a.dias || a.userId.localeCompare(b.userId));
}

/**
 * Igual que `quienLlevaba`, pero cae al responsable actual de la ficha cuando
 * esa cuenta nunca registró un pase en ese rol.
 *
 * Es lo que hace que el cambio sea seguro: las cuentas que nunca cambiaron de
 * mano liquidan exactamente igual que antes.
 */
export function responsablesDelPeriodo(
  asignaciones: Asignacion[],
  clienteId: string,
  rol: RolDeCuenta,
  periodo: string,
  actual: string | null
): Tenencia[] {
  const hist = quienLlevaba(asignaciones, clienteId, rol, periodo);
  if (hist.length > 0) return hist;
  // Con historial cargado pero sin tenencia ese mes, no cobra nadie: la cuenta
  // todavía no existía, o en ese momento no la llevaba nadie.
  const hayHistorial = asignaciones.some((a) => a.clienteId === clienteId && a.rol === rol);
  if (hayHistorial) return [];
  return actual ? [{ userId: actual, dias: diasDelMes(periodo), fraccion: 1 }] : [];
}

/** Reparte un monto entre los que llevaron la cuenta, sin perder ni un peso. */
export function repartir(
  monto: number,
  tenencias: Tenencia[]
): { userId: string; monto: number; tenencia: Tenencia }[] {
  if (tenencias.length === 0) return [];
  if (tenencias.length === 1) {
    return [{ userId: tenencias[0].userId, monto, tenencia: tenencias[0] }];
  }
  const out = tenencias.map((t) => ({
    userId: t.userId,
    monto: Math.round(monto * t.fraccion),
    tenencia: t,
  }));
  // El sobrante del redondeo va al que más días tuvo, así la suma da exacto.
  const dif = monto - out.reduce((a, x) => a + x.monto, 0);
  if (dif !== 0) out[0].monto += dif;
  return out;
}
