import { AGENCY } from "@/lib/agency";

/**
 * Pedirle la reseña de Google a un cliente contento (12/10/2026). Solo a quien
 * puntuó 4 o 5 en la encuesta del mes: es el momento justo, y a un 1-3 no se
 * le pide una reseña, se le resuelve el problema.
 */
export const PUNTAJE_PARA_RESENA = 4;

export function corresponderPedirResena(puntaje: number | null | undefined): boolean {
  return puntaje != null && puntaje >= PUNTAJE_PARA_RESENA;
}

export function mensajeResena(input: { contactoNombre?: string | null; deParte?: string | null }): string {
  const nombre = input.contactoNombre?.trim().split(/\s+/)[0];
  const firma = input.deParte?.trim().split(/\s+/)[0];
  return [
    `¡Hola${nombre ? ` ${nombre}` : ""}! Gracias por responder la encuesta, nos alegra muchísimo que estés contento con el trabajo 🙌`,
    `¿Nos harías un favor? Si nos dejás una reseña en Google, nos ayuda un montón a que otras marcas nos conozcan. Es un minuto:`,
    AGENCY.resena_google,
    firma ? `¡Gracias! ${firma} de ${AGENCY.brand}` : `¡Gracias! Equipo de ${AGENCY.brand}`,
  ].join("\n\n");
}
