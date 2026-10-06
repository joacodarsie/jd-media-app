/**
 * El aviso diario al director creativo con las ideas del calendario que
 * esperan su aprobación.
 *
 * Por qué existe (29/9/2026): el director creativo aprueba los calendarios
 * antes de que se produzca nada, y nadie le avisaba que había calendarios
 * esperando. Ese día había 46 ideas que salían en las dos semanas siguientes
 * sin aprobar (Catch y Nazar Hogar recién cargados) y 43 que ya habían pasado
 * de fecha sin que nadie las mirara. Sin el OK, diseño y edición no arrancan.
 *
 * Solo cuenta lo que sale en los próximos días: lo que ya pasó de fecha es un
 * problema de limpieza del calendario, no algo para aprobar.
 *
 * Puro, para probarlo sin base.
 */

/** Cuántos días para adelante mira: el calendario va con dos semanas de ventaja. */
export const DIAS_ADELANTE = 14;

export interface IdeaPendiente {
  cliente_id: string;
  /** "YYYY-MM-DD" o ISO. */
  fecha_publicacion: string;
}

export interface CuentaActiva {
  id: string;
  nombre: string;
  estado: string;
}

function sumarDias(ymd: string, dias: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/** El texto del aviso, o null si no hay nada que aprobar. */
export function avisoIdeasParaAprobar(
  ideas: IdeaPendiente[],
  cuentas: CuentaActiva[],
  hoy: string
): string | null {
  const hasta = sumarDias(hoy, DIAS_ADELANTE);
  const activas = new Map(cuentas.filter((c) => c.estado === "activo").map((c) => [c.id, c.nombre]));
  const porCuenta = new Map<string, number>();
  for (const i of ideas) {
    const dia = i.fecha_publicacion.slice(0, 10);
    const nombre = activas.get(i.cliente_id);
    if (!nombre || dia < hoy || dia > hasta) continue;
    porCuenta.set(nombre, (porCuenta.get(nombre) ?? 0) + 1);
  }
  const total = [...porCuenta.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const orden = [...porCuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lista = orden
    .slice(0, 4)
    .map(([n, c]) => `${n} ${c}`)
    .join(", ");
  const resto = orden.length > 4 ? ` y ${orden.length - 4} cuenta${orden.length - 4 === 1 ? "" : "s"} más` : "";
  return `📅 Calendarios para aprobar: ${total} idea${total === 1 ? "" : "s"} de las próximas dos semanas (${lista}${resto}). Sin tu OK no se producen.`;
}

/**
 * Cuántos días antes de la fecha se le avisa también a la PM.
 *
 * Cómo se reparten (dueño, 7/10/2026): **el calendario lo aprueba siempre el
 * director creativo; los tiempos son de la PM.** Ella lo apura y, si por algo
 * él no puede, es su suplente y las aprueba ella.
 *
 * Pedido del dueño (5/10/2026): desde que la tarea de diseño nace al aprobar la
 * idea (0187), si el director creativo no llega a aprobar, a diseño y edición
 * no les llega nada. Ese día había 30 ideas que salían en la semana sin
 * aprobar. A 5 días de la fecha la PM se entera y puede aprobarlas ella.
 */
export const DIAS_URGENTE = 5;

/** Las ideas que salen en los próximos DIAS_URGENTE días, por cuenta. */
function urgentes(ideas: IdeaPendiente[], cuentas: CuentaActiva[], hoy: string) {
  const hasta = sumarDias(hoy, DIAS_URGENTE);
  const activas = new Map(cuentas.filter((c) => c.estado === "activo").map((c) => [c.id, c.nombre]));
  const porCuenta = new Map<string, number>();
  for (const i of ideas) {
    const dia = i.fecha_publicacion.slice(0, 10);
    const nombre = activas.get(i.cliente_id);
    if (!nombre || dia < hoy || dia > hasta) continue;
    porCuenta.set(nombre, (porCuenta.get(nombre) ?? 0) + 1);
  }
  const total = [...porCuenta.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const orden = [...porCuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lista = orden
    .slice(0, 4)
    .map(([n, c]) => `${n} ${c}`)
    .join(", ");
  const resto = orden.length > 4 ? ` y ${orden.length - 4} cuenta${orden.length - 4 === 1 ? "" : "s"} más` : "";
  return { total, detalle: `${lista}${resto}` };
}

const primerNombre = (n: string | null, si: string) => (n ? n.split(" ")[0] : si);

/** El aviso a la PM con las ideas que salen ya y siguen sin aprobar, o null. */
export function avisoIdeasUrgentes(
  ideas: IdeaPendiente[],
  cuentas: CuentaActiva[],
  hoy: string,
  director: string | null
): string | null {
  const u = urgentes(ideas, cuentas, hoy);
  if (!u) return null;
  const quien = primerNombre(director, "el director creativo");
  const las = u.total === 1 ? "la" : "las";
  return `⏰ ${u.total} idea${u.total === 1 ? "" : "s"} sale${u.total === 1 ? "" : "n"} en los próximos ${DIAS_URGENTE} días y ${quien} todavía no ${las} aprobó (${u.detalle}). Apurá a ${quien} para que ${las} apruebe hoy; si no puede, aprobalas vos como suplente desde Aprobar.`;
}

/**
 * Lo urgente, para el director creativo: va arriba de su aviso de cada día
 * cuando hay ideas que salen en 5 días sin su OK. Le dice que la PM es su
 * suplente, así sabe a quién pasarle la posta si no llega.
 */
export function avisoUrgenteDirector(
  ideas: IdeaPendiente[],
  cuentas: CuentaActiva[],
  hoy: string,
  pm: string | null
): string | null {
  const u = urgentes(ideas, cuentas, hoy);
  if (!u) return null;
  const quien = primerNombre(pm, "la PM");
  return `⏰ Urgente: ${u.total} idea${u.total === 1 ? "" : "s"} sale${u.total === 1 ? "" : "n"} en los próximos ${DIAS_URGENTE} días sin tu OK (${u.detalle}). Si hoy no llegás, avisale a ${quien}: es tu suplente y ${u.total === 1 ? "la" : "las"} aprueba ella.`;
}
