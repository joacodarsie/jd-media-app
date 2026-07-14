/**
 * Un plan mensual activo cuyo periodo ya pasó ("Junio 2026" mirado en julio)
 * confunde al cliente: lo lee como el contenido vigente del portal aunque el
 * calendario de abajo ya tenga el mes nuevo. Solo consideramos "viejo" un plan
 * cuyo label nombra claramente un único mes anterior al actual; labels libres
 * ("Q2 2026", "Lanzamiento del álbum") se siguen mostrando.
 */

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

export function isPlanOfPastMonth(
  periodoLabel: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!periodoLabel) return false;
  const m = periodoLabel
    .trim()
    .toLowerCase()
    .match(/^([a-záéíóú]+)\s+(?:de\s+)?(\d{4})$/i);
  if (!m) return false;
  const mes = MESES[m[1]];
  if (mes === undefined) return false;
  const anio = Number(m[2]);
  return anio * 12 + mes < now.getFullYear() * 12 + now.getMonth();
}
