/**
 * El saludo de Mi día según la hora (18/10/2026): buen día, buenas tardes o
 * buenas noches, con el color del cielo de ese momento y una frase con lo más
 * importante. Puro y testeado; la hora llega en horario de Córdoba.
 */
export type Momento = "madrugada" | "manana" | "tarde" | "atardecer" | "noche";

export function momentoDelDia(hora: number): Momento {
  if (hora < 6) return "madrugada";
  if (hora < 12) return "manana";
  if (hora < 18) return "tarde";
  if (hora < 20) return "atardecer";
  return "noche";
}

export const SALUDO: Record<Momento, { saludo: string; emoji: string }> = {
  madrugada: { saludo: "Qué hacés despierto", emoji: "🌙" },
  manana: { saludo: "Buen día", emoji: "☀️" },
  tarde: { saludo: "Buenas tardes", emoji: "🌤️" },
  atardecer: { saludo: "Buenas tardes", emoji: "🌇" },
  noche: { saludo: "Buenas noches", emoji: "🌙" },
};

/** Lo más importante del día, en una frase. */
export function fraseDelDia(d: {
  vencidas: number;
  hoy: number;
  reunion: { titulo: string; hora: string } | null;
  piezasHoy: number;
}): string {
  const partes: string[] = [];
  if (d.vencidas > 0) partes.push(`${d.vencidas} tarea${d.vencidas === 1 ? "" : "s"} vencida${d.vencidas === 1 ? "" : "s"} para ponerte al día`);
  if (d.hoy > 0) partes.push(`${d.hoy} que vence${d.hoy === 1 ? "" : "n"} hoy`);
  if (d.reunion) partes.push(`la reunión «${d.reunion.titulo}» a las ${d.reunion.hora}`);
  if (d.piezasHoy > 0) partes.push(`${d.piezasHoy} pieza${d.piezasHoy === 1 ? "" : "s"} que sale${d.piezasHoy === 1 ? "" : "n"} hoy`);
  if (!partes.length) return "Día tranquilo: buen momento para adelantar lo de la semana.";
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
  return `Lo importante: ${lista}.`;
}
