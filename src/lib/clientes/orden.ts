/**
 * El "Ordenar por" de la lista de clientes.
 *
 * Por qué existe (2/10/2026): la lista iba siempre por nombre, y el dueño
 * quiere verla por cuándo entró cada cuenta o por cuál fue la última en irse.
 *
 * - Alta: la fecha de inicio cargada; si falta, cuando se activó; si no, cuando
 *   se creó la ficha.
 * - Baja: cuándo pasó a inactiva. Las que no tienen baja van al final.
 *
 * Puro, para probarlo sin base.
 */

export type OrdenClientes = "nombre" | "nuevos" | "antiguos" | "baja";

export const ORDENES: { value: OrdenClientes; label: string }[] = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "nuevos", label: "Más nuevos primero" },
  { value: "antiguos", label: "Más antiguos primero" },
  { value: "baja", label: "Última baja primero" },
];

export interface ClienteOrdenable {
  nombre: string;
  fecha_inicio?: string | null;
  fecha_activado?: string | null;
  fecha_inactivado?: string | null;
  created_at?: string | null;
}

/** "YYYY-MM-DD" del alta, o null si no hay ninguna fecha. */
export function fechaAlta(c: ClienteOrdenable): string | null {
  const f = c.fecha_inicio ?? c.fecha_activado ?? c.created_at ?? null;
  return f ? f.slice(0, 10) : null;
}

/** "YYYY-MM-DD" de la baja, o null si nunca se fue. */
export function fechaBaja(c: ClienteOrdenable): string | null {
  return c.fecha_inactivado ? c.fecha_inactivado.slice(0, 10) : null;
}

/** Más reciente primero; los que no tienen fecha, al final. */
function porFechaDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}

export function ordenarClientes<T extends ClienteOrdenable>(lista: T[], orden: OrdenClientes): T[] {
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  const copia = [...lista];
  switch (orden) {
    case "nuevos":
      return copia.sort((a, b) => porFechaDesc(fechaAlta(a), fechaAlta(b)) || porNombre(a, b));
    case "antiguos":
      return copia.sort((a, b) => {
        const fa = fechaAlta(a);
        const fb = fechaAlta(b);
        if (fa === fb) return porNombre(a, b);
        if (!fa) return 1;
        if (!fb) return -1;
        return fa < fb ? -1 : 1;
      });
    case "baja":
      return copia.sort(
        (a, b) =>
          porFechaDesc(fechaBaja(a), fechaBaja(b)) ||
          porFechaDesc(fechaAlta(a), fechaAlta(b)) ||
          porNombre(a, b)
      );
    default:
      return copia.sort(porNombre);
  }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmt(ymd: string): string {
  return `${+ymd.slice(8, 10)} ${MESES[+ymd.slice(5, 7) - 1]} ${ymd.slice(0, 4)}`;
}

/** La fecha que se muestra en la tarjeta según el orden elegido, o null. */
export function detalleFecha(c: ClienteOrdenable, orden: OrdenClientes): string | null {
  if (orden === "nombre") return null;
  const baja = fechaBaja(c);
  if (orden === "baja" && baja) return `se fue el ${fmt(baja)}`;
  const alta = fechaAlta(c);
  return alta ? `entró el ${fmt(alta)}` : null;
}
