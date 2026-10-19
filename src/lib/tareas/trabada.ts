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

export function etiquetaTrabada(tipo: TipoTraba | null | undefined, quien: string | null | undefined): string | null {
  if (tipo === "cliente") return "Esperando al cliente";
  if (tipo === "persona") return quien ? `Esperando a ${quien.split(" ")[0]}` : "Esperando a un compañero";
  return null;
}
