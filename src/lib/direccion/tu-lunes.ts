/**
 * «Tu lunes en 1 minuto» (19/10/2026): cada lunes, un aviso para el dueño con
 * lo que pasó en la semana, sin tener que entrar a buscar nada. Lo puro: con
 * los números arma el texto corto (va como notificación y push).
 */
export interface DatosLunes {
  rojas: string[];
  regulares: number;
  bien: number;
  reunionesHechas: number;
  reunionesAgendadas: number;
  encuestas: { cantidad: number; promedio: number | null; bajas: string[] };
  web: { visitas: number; whatsapp: number; diagnosticos: number; formularios: number };
  trabadas: number;
  mejorRacha: { nombre: string; dias: number } | null;
}

export const PREFIJO_LUNES = "☀️ Tu lunes:";

export function textoLunes(d: DatosLunes): string {
  const partes: string[] = [];
  partes.push(
    d.rojas.length
      ? `🚦 ${d.rojas.length} en rojo (${d.rojas.slice(0, 3).join(", ")}${d.rojas.length > 3 ? "…" : ""}), ${d.regulares} regulares, ${d.bien} bien`
      : `🚦 ninguna cuenta en rojo (${d.regulares} regulares, ${d.bien} bien)`
  );
  partes.push(`🗓️ ${d.reunionesHechas} reuniones hechas la semana pasada${d.reunionesAgendadas ? `, ${d.reunionesAgendadas} agendadas` : ""}`);
  if (d.encuestas.cantidad) {
    const prom = d.encuestas.promedio != null ? ` (promedio ${d.encuestas.promedio.toFixed(1)}/5)` : "";
    const ojo = d.encuestas.bajas.length ? ` ⚠️ ojo: ${d.encuestas.bajas.join(", ")}` : "";
    partes.push(`📝 ${d.encuestas.cantidad} encuesta${d.encuestas.cantidad === 1 ? "" : "s"}${prom}${ojo}`);
  }
  partes.push(
    `🌐 web: ${d.web.visitas} visitas, ${d.web.whatsapp} WhatsApp, ${d.web.diagnosticos} diagnósticos, ${d.web.formularios} formularios`
  );
  if (d.trabadas) partes.push(`🧱 ${d.trabadas} tarea${d.trabadas === 1 ? "" : "s"} trabada${d.trabadas === 1 ? "" : "s"}`);
  if (d.mejorRacha && d.mejorRacha.dias > 0) partes.push(`🔥 mejor racha: ${d.mejorRacha.nombre} (${d.mejorRacha.dias} ${d.mejorRacha.dias === 1 ? "día" : "días"})`);
  return `${PREFIJO_LUNES} ${partes.join(" · ")}.`;
}
