/**
 * "Trabajo real" de la web de JD Media (12/10/2026): lo último que publicamos
 * en el Instagram de cada cuenta, para mostrar contenido de verdad arriba de
 * todo, como hacen las agencias grandes. Se actualiza solo.
 *
 * Reglas:
 * - Solo cuentas marcadas `mostrar_en_web` (si un cliente no quiere, se saca).
 * - Solo lo publicado desde que la cuenta trabaja con nosotros: lo anterior no
 *   lo hicimos nosotros.
 * - Se intercalan las cuentas (una de cada una) para que no sea todo de la misma.
 *
 * Puro: entra lo que trajo Instagram por cuenta, sale la lista para la web.
 */

export interface PiezaIg {
  id: string;
  media_type: string;
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
}

export interface CuentaConPiezas {
  nombre: string;
  usuario: string | null;
  /** "YYYY-MM-DD": desde cuándo la manejamos. */
  desde: string | null;
  piezas: PiezaIg[];
}

export interface TrabajoWeb {
  id: string;
  cuenta: string;
  usuario: string | null;
  imagen: string;
  link: string;
  tipo: "reel" | "carrusel" | "post";
  fecha: string;
}

const TIPO: Record<string, TrabajoWeb["tipo"]> = {
  VIDEO: "reel",
  CAROUSEL_ALBUM: "carrusel",
  IMAGE: "post",
};

export function elegirTrabajos(cuentas: CuentaConPiezas[], max = 24, porCuenta = 6): TrabajoWeb[] {
  const listas = cuentas.map((c) =>
    c.piezas
      .filter((p) => p.thumbnail_url && p.permalink && p.timestamp)
      .filter((p) => !c.desde || p.timestamp!.slice(0, 10) >= c.desde)
      .sort((a, b) => b.timestamp!.localeCompare(a.timestamp!))
      .slice(0, porCuenta)
      .map(
        (p): TrabajoWeb => ({
          id: p.id,
          cuenta: c.nombre,
          usuario: c.usuario,
          imagen: p.thumbnail_url!,
          link: p.permalink!,
          tipo: TIPO[p.media_type] ?? "post",
          fecha: p.timestamp!.slice(0, 10),
        })
      )
  );
  // Intercalar: la más nueva de cada cuenta, después la segunda de cada una…
  const out: TrabajoWeb[] = [];
  for (let i = 0; out.length < max && listas.some((l) => l.length > i); i++) {
    for (const l of listas) if (l[i] && out.length < max) out.push(l[i]);
  }
  return out;
}
