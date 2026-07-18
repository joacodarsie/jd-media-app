/**
 * Pausa de cuenta por mes. Un cliente puede pausar el servicio uno o más meses
 * (ej. Origen pausa agosto 2026). `pausas` es un array de períodos 'YYYY-MM'.
 * Un mes pausado se excluye de cobros, nómina del equipo y panorama, pero la
 * cuenta sigue activa (no se toca el equipo ni el historial).
 */
export function isClientPausedFor(
  pausas: string[] | null | undefined,
  periodo: string
): boolean {
  return Array.isArray(pausas) && pausas.includes(periodo);
}
