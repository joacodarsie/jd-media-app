/**
 * «Estoy trabado» (19/10/2026, 0206): lo puro. Qué se le avisa a quien
 * destraba y cómo se muestra la tarea mientras espera.
 */
export type TipoTraba = "cliente" | "persona";

export function avisoTrabada(i: {
  quien: string;
  tarea: string;
  cuenta: string | null;
  tipo: TipoTraba;
  detalle: string | null;
}): string {
  const en = i.cuenta ? `«${i.tarea}» (${i.cuenta})` : `«${i.tarea}»`;
  const porque = i.detalle?.trim() ? ` Dice: «${i.detalle.trim().slice(0, 140)}»` : "";
  return i.tipo === "cliente"
    ? `🧱 ${i.quien} no puede avanzar con ${en}: espera al cliente.${porque} Apurá al cliente.`
    : `🧱 ${i.quien} te está esperando para avanzar con ${en}.${porque}`;
}

/**
 * La pausa por el cliente (20/10/2026): mientras se espera al cliente el reloj
 * no corre, así que al reanudar la fecha límite se corre los días que estuvo
 * en pausa. Se cuentan días de calendario de Córdoba entre que se pausó y hoy;
 * si se reanuda el mismo día, no se mueve. Fechas en «YYYY-MM-DD».
 */
export function fechaAlReanudar(fechaLimite: string | null, pausadaDesdeYmd: string | null, hoyYmd: string): string | null {
  if (!fechaLimite || !pausadaDesdeYmd) return fechaLimite;
  const dia = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const dias = Math.round((dia(hoyYmd) - dia(pausadaDesdeYmd)) / 86_400_000);
  if (dias <= 0) return fechaLimite;
  const nueva = new Date(dia(fechaLimite.slice(0, 10)) + dias * 86_400_000).toISOString().slice(0, 10);
  // Si la fecha tenía hora (timestamptz), se conserva la parte de la hora.
  return fechaLimite.length > 10 ? nueva + fechaLimite.slice(10) : nueva;
}

export function etiquetaTrabada(tipo: TipoTraba | null | undefined, quien: string | null | undefined): string | null {
  if (tipo === "cliente") return "En pausa: espera al cliente";
  if (tipo === "persona") return quien ? `Esperando a ${quien.split(" ")[0]}` : "Esperando a un compañero";
  return null;
}
