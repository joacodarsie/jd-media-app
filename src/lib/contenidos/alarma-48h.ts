/**
 * Alarma 48 h antes de cada pieza atrasada (19/10/2026). La causa principal
 * del rojo es «plan atrasado», y ahora el cliente ve en vivo las piezas que no
 * arrancaron. En vez de medir el atraso después, se avisa antes:
 * - idea o revisión creativa a 2 días o menos → la tiene que aprobar el
 *   director creativo: tarea urgente para él;
 * - en producción (guion, diseño, edición) a 1 día o menos → su tarea pasa a
 *   urgente y le llega el aviso a quien la produce.
 */
export type Alarma = "aprobar" | "producir";

const dias = (hoy: string, fecha: string) =>
  Math.round((Date.parse(`${fecha.slice(0, 10)}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000);

export function alarmaDe(p: { estado: string; fecha_publicacion: string | null }, hoy: string): Alarma | null {
  if (!p.fecha_publicacion) return null;
  const d = dias(hoy, p.fecha_publicacion);
  if (d < 0) return null; // ya pasó: eso lo mide el semáforo
  if ((p.estado === "idea" || p.estado === "revision_creativa") && d <= 2) return "aprobar";
  if ((p.estado === "guion" || p.estado === "en_diseno" || p.estado === "edicion") && d <= 1) return "producir";
  return null;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function cuandoSale(fecha: string, hoy: string): string {
  const d = dias(hoy, fecha);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  return `el ${DIAS[new Date(`${fecha.slice(0, 10)}T12:00:00Z`).getUTCDay()]}`;
}

export function tareaAprobar(i: { titulo: string; cuenta: string; fecha: string; hoy: string; estado: string }) {
  const sale = cuandoSale(i.fecha, i.hoy);
  const que = i.estado === "idea" ? "la idea" : "la pieza en revisión creativa";
  return {
    titulo: `⏰ Aprobar ya: «${i.titulo}» de ${i.cuenta} sale ${sale}`,
    descripcion: [
      `Sale **${sale}** y todavía falta que apruebes ${que}. Sin tu aprobación nadie la puede producir y el cliente la ve atrasada en su plataforma.`,
      "",
      "**Qué hacer:** aprobala en Contenidos (o pedí el cambio hoy mismo).",
      "",
      "**Quién lo hace:** el director creativo.",
      "**Está hecho cuando:** la pieza sale de «idea» o de «revisión creativa». Se cierra sola.",
    ].join("\n"),
  };
}

export function avisoProducir(i: { titulo: string; cuenta: string; fecha: string; hoy: string; estado: string }): string {
  const etapa = i.estado === "edicion" ? "en edición" : i.estado === "guion" ? "en guion" : "en diseño";
  return `⏰ «${i.titulo}» de ${i.cuenta} sale ${cuandoSale(i.fecha, i.hoy)} y sigue ${etapa}. Tu tarea pasó a urgente.`;
}
