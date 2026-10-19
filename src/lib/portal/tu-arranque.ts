/**
 * «Tu arranque» en el portal de las cuentas nuevas (19/10/2026). Ninguna baja
 * pasó de los 3 meses: el problema es el arranque. El cliente ve los 6 pasos,
 * cuáles están listos y cuáles le tocan a él.
 */
export interface DatosArranque {
  accesosCompletos: boolean;
  materialAvisado: boolean;
  /** El paso «Contenido crudo ordenado en carpetas» del onboarding está cerrado. */
  materialOrdenado: boolean;
  diagnosticoHecho: boolean;
  calendarioAprobado: boolean;
  tieneLogo: boolean;
  primeraPublicada: boolean;
}

export interface PasoArranque {
  clave: string;
  titulo: string;
  hecho: boolean;
  /** Lo tiene que hacer el cliente. */
  teToca: boolean;
}

export function pasosArranque(d: DatosArranque): PasoArranque[] {
  return [
    { clave: "diagnostico", titulo: "Reunión de diagnóstico", hecho: d.diagnosticoHecho, teToca: false },
    { clave: "accesos", titulo: "Cargar los accesos de tus redes", hecho: d.accesosCompletos, teToca: true },
    { clave: "material", titulo: "Subir tus fotos y videos", hecho: d.materialAvisado || d.materialOrdenado, teToca: true },
    { clave: "logo", titulo: "Tu marca en la plataforma", hecho: d.tieneLogo, teToca: false },
    { clave: "calendario", titulo: "Aprobar tu primer calendario", hecho: d.calendarioAprobado, teToca: true },
    { clave: "primera", titulo: "Tu primera publicación al aire", hecho: d.primeraPublicada, teToca: false },
  ];
}

/** Se muestra el primer mes y medio, o hasta que esté todo listo. */
export function mostrarArranque(fechaInicio: string | null, hoy: string, pasos: PasoArranque[]): boolean {
  if (!fechaInicio) return false;
  const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fechaInicio.slice(0, 10)}T12:00:00Z`)) / 86_400_000;
  if (dias < 0 || dias > 45) return false;
  return pasos.some((p) => !p.hecho) || dias <= 20; // completo: queda unos días para festejar
}
