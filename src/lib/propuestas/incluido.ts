/**
 * Qué incluye el servicio de Gestión de Redes, además del volumen del pack.
 *
 * ⚠️ FUENTE: https://jdmedia.com.ar/servicios/gestion-redes/ (leído 2026-08-07).
 * Los precios y los volúmenes de los packs SÍ se sincronizan solos con la web
 * (tabla `agency_packs`), pero este listado todavía no: si la web cambia lo que
 * incluye el servicio, hay que tocarlo acá. Está en un archivo aparte para que
 * se vea de una que es contenido comercial, no lógica.
 *
 * Por qué existe: el user lo pidió textual — los packs se leían como si fueran
 * "tantos reels por tanta plata", cuando en realidad el precio cubre el servicio
 * entero (manual de marca, estrategia, gestión de la pauta, reportes). Sin esta
 * aclaración la propuesta se compara contra un freelance que cobra por pieza.
 */

export const INCLUIDO_EN_TODOS: { titulo: string; items: string[] }[] = [
  {
    titulo: "Estrategia y marca",
    items: [
      "Manual de marca y moodboard de la cuenta",
      "Informe de diagnóstico y plan de acción",
      "Estrategia mensual personalizada con calendario de contenidos",
      "Rediseño del perfil y optimización de la bio en todas las cuentas",
    ],
  },
  {
    titulo: "Producción y publicación",
    items: [
      "Creación del contenido: reels, posts y historias según el plan",
      "Publicación con copywriting propio y repost de historias",
      "Publicamos en Instagram, Facebook y TikTok",
      "Carpetas de Drive organizadas con todo el material",
    ],
  },
  {
    titulo: "Publicidad en Meta",
    items: [
      "Definición del objetivo de la campaña (visibilidad, tráfico, ventas, contactos)",
      "Configuración y puesta en marcha de la campaña en Meta Ads",
      "Seguimiento semanal y ajustes de optimización",
      "Reporte mensual con las métricas clave",
    ],
  },
  {
    titulo: "Equipo y seguimiento",
    items: [
      "Community manager, editor audiovisual y diseñador gráfico asignados",
      "Grupo de WhatsApp directo con el equipo",
      "Reporte mensual de resultados",
      "Acceso a la plataforma de JD MEDIA para aprobar y ver todo",
    ],
  },
];

/** Adicionales del servicio que no entran en el abono. Misma fuente. */
export const ADICIONALES: string[] = [
  "Sesión de producción en locación: $50.000 la hora (más traslado si es fuera de la ciudad) y $25.000 cada hora adicional.",
];

/**
 * Las condiciones que evitan la conversación incómoda a mitad de camino.
 * La del presupuesto de pauta es la más importante: gestionamos las campañas,
 * pero la plata que se invierte en Meta la pone el cliente.
 */
export const LETRA_CHICA: { titulo: string; texto: string }[] = [
  {
    titulo: "El presupuesto de pauta va aparte",
    texto:
      "El abono cubre armar, configurar y optimizar tus campañas de Meta. La plata que se invierte en los anuncios la ponés vos y la definimos juntos según el objetivo. Google Ads y las campañas de mayor escala son nuestro servicio de Publicidad Online, que se cotiza por separado.",
  },
  {
    titulo: "Acuerdo mínimo de 3 meses",
    texto:
      "El primer trimestre es el tiempo mínimo real para ordenar la cuenta y que el trabajo se note. Cumplido ese plazo seguís mes a mes, sin ataduras.",
  },
  {
    titulo: "Las cuentas y el material son tuyos",
    texto:
      "Los accesos quedan a tu nombre y todo lo que producimos —fotos, videos, piezas, manual de marca— es tuyo, pase lo que pase con la relación.",
  },
];
