/**
 * «Tu contenido, en vivo» (19/10/2026): la línea de producción de cada pieza
 * que viene, para que el cliente vea que se está trabajando aunque todavía no
 * haya salido nada. Es lo que más pesa en las bajas del arranque: «no sé qué
 * están haciendo».
 */
export const ETAPAS = ["Planificada", "Producción", "Revisión", "Lista"] as const;

/** En qué etapa está la pieza: 0 idea, 1 producción, 2 revisión, 3 lista. -1 = no va. */
export function etapaDe(estado: string): number {
  switch (estado) {
    case "idea":
      return 0;
    case "guion":
    case "en_diseno":
    case "edicion":
      return 1;
    case "revision_creativa":
    case "revision_cliente":
      return 2;
    case "aprobado":
      return 3;
    default:
      return -1; // publicado, rechazado
  }
}

export interface PiezaProduccion {
  id: string;
  titulo: string | null;
  tipo: string;
  fecha_publicacion: string | null;
  estado: string;
}

/** Las próximas piezas sin publicar, la más cercana primero. */
export function lineaDeProduccion(pubs: PiezaProduccion[], hoy: string, max = 8) {
  const piezas = pubs
    .filter((p) => p.fecha_publicacion && p.fecha_publicacion.slice(0, 10) >= hoy && etapaDe(p.estado) >= 0)
    .sort((a, b) => (a.fecha_publicacion ?? "").localeCompare(b.fecha_publicacion ?? ""))
    .slice(0, max)
    .map((p) => ({ ...p, etapa: etapaDe(p.estado) }));
  return {
    piezas,
    enProduccion: piezas.filter((p) => p.etapa > 0 && p.etapa < 3).length,
    listas: piezas.filter((p) => p.etapa === 3).length,
  };
}
