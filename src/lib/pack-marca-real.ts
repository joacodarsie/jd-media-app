// Pack Marca Real: identidad básica de marca como proyecto de única vez.
//
// Nació con el posteo de lanzamiento del 26/8/2026 en @jdmedia.digital:
// "Logo · Identidad · Plantillas · Perfil de Instagram armado · Calendario · Y
// de regalo: Manual con 30 ideas de contenido". Precio de lanzamiento $99.000,
// cupos limitados.
//
// Se carga como un servicio `branding` con `pack = "Marca Real"` y cobro
// único. La carta acuerdo toma de acá el alcance y las condiciones, que son
// las que el posteo no dice y conviene dejar por escrito (propuestas de logo,
// rondas de cambios, plazo, formatos, qué NO incluye).

export const PACK_MARCA_REAL = "Marca Real";

export const MARCA_REAL = {
  precio: 99000,
  propuestasLogo: 2,
  rondasCambios: 2,
  plantillasPosteo: 3,
  plantillasHistoria: 3,
  diasHabilesEntrega: 10,
} as const;

/** ¿Este servicio es el Pack Marca Real? */
export function esMarcaReal(s: { tipo: string; pack?: string | null }): boolean {
  return s.tipo === "branding" && s.pack === PACK_MARCA_REAL;
}

export function marcaRealDeliverables(): string[] {
  const m = MARCA_REAL;
  return [
    "## Identidad",
    `Logo: ${m.propuestasLogo} propuestas para elegir, y la elegida se ajusta hasta la versión final.`,
    "Paleta de colores y tipografías de la marca.",
    "## Redes",
    `Plantillas editables en Canva para publicar: ${m.plantillasPosteo} de posteo y ${m.plantillasHistoria} de historia, con la identidad de la marca.`,
    "Perfil de Instagram armado: foto de perfil, biografía y portadas de destacadas.",
    "## Contenido",
    "Plantilla de calendario para organizar las publicaciones.",
    "De regalo: manual con 30 ideas de contenido para el negocio (10 para vender, 10 para generar confianza y 10 educativas), con el formato indicado para cada una.",
    "## Condiciones",
    `Incluye ${m.rondasCambios} rondas de cambios sobre la propuesta elegida. Los cambios adicionales o los pedidos fuera de este alcance se cotizan aparte.`,
    `Entrega en ${m.diasHabilesEntrega} días hábiles desde que el Cliente completa el brief de marca y envía el material pedido.`,
    "Se entregan los archivos finales en PNG y PDF (logo con fondo y sin fondo), y el acceso a las plantillas editables.",
    "No incluye la publicación de contenido, la gestión de las redes ni la pauta: se contratan aparte.",
  ];
}

/**
 * Los tipos de servicio de una cuenta, sumando "marca_real" cuando tiene el
 * pack. El onboarding y la bienvenida razonan por tipo, y el pack es un
 * branding con `pack = "Marca Real"`: sin esto le caía el arranque de redes.
 */
export function tiposDeServicio(services: { tipo: string; pack?: string | null }[]): string[] {
  const tipos = services.map((s) => s.tipo);
  if (services.some((s) => esMarcaReal(s))) tipos.push("marca_real");
  return tipos;
}
