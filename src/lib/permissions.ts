/**
 * Features que se pueden otorgar individualmente a cada usuario.
 * Admin siempre las tiene todas. /accesos siempre es admin-only y no es feature.
 */

export const FEATURES = [
  "finanzas",            // toda la sección /finanzas y subpages
  "global",              // /global (KPIs de toda la agencia)
  "equipo_compensacion", // ver compensaciones del equipo en /equipo
  "clientes_credenciales", // ver credenciales del cliente en su detalle
  "documentos_globales", // crear/editar documentos generales en /documentos
  "comercial",           // acceso al pipeline comercial (vender) sin ser del rol comercial
  "leads_ia",            // usar el buscador de leads con IA (Prospección/Reclutamiento) — consume tokens
  "contactos_ia",        // usar "Sacar contactos" con IA en Contactos (rápido) — consume tokens
  "jdmedia_live",        // usar JDmedIA en vivo (comparte pantalla) — consume tokens
] as const;

export type Feature = (typeof FEATURES)[number];

/**
 * Features que NO se tienen por ser admin: hay que otorgarlas a dedo. Son las
 * que gastan tokens, así que "ser admin" no puede habilitar el gasto solo (ver
 * `hasFeatureStrict` en auth.ts). Para el resto, admin = acceso total y el
 * checkbox es informativo.
 */
export const STRICT_FEATURES: readonly Feature[] = [
  "leads_ia",
  "contactos_ia",
  "jdmedia_live",
];

export const isStrictFeature = (f: Feature): boolean => STRICT_FEATURES.includes(f);

export const FEATURE_LABEL: Record<Feature, string> = {
  finanzas: "Finanzas (cobros, pagos, gastos, rentabilidad)",
  global: "Global (KPIs de toda la agencia)",
  equipo_compensacion: "Ver compensaciones del equipo",
  clientes_credenciales: "Ver credenciales de los clientes",
  documentos_globales: "Editar documentos generales de la agencia",
  comercial: "Vender (pipeline comercial)",
  leads_ia: "Buscador de leads con IA (caro en tokens)",
  contactos_ia: "IA de prospección (contactos, mensajes de campaña, sectores)",
  jdmedia_live: "JDmedIA en vivo · comparte pantalla (caro en tokens)",
};

export const FEATURE_DESCRIPTION: Record<Feature, string> = {
  finanzas:
    "Acceso completo a /finanzas: cobros a clientes, pagos al equipo, gastos, rentabilidad. Solo darle a alguien de confianza.",
  global: "Ver los KPIs y carga de trabajo de toda la agencia en /global.",
  equipo_compensacion:
    "Permite ver montos de compensación de cada miembro del equipo.",
  clientes_credenciales:
    "Ver las contraseñas y accesos guardados en cada ficha de cliente.",
  documentos_globales:
    "Subir/eliminar los documentos generales de la agencia (manuales, plantillas).",
  comercial:
    "Permite usar el pipeline comercial y cerrar ventas, aunque su rol principal sea otro.",
  leads_ia:
    "Usar el buscador de leads con IA (el botón 'Buscar leads con IA' de Prospección) y el análisis de CVs de Reclutamiento. Es la función MÁS cara en tokens: dáselo solo a quien lo use de verdad.",
  contactos_ia:
    "La IA de prospección del día a día: sacar contactos, generar los mensajes de la campaña y sugerir sectores. Consume tokens (poco por uso, pero suma). NO incluye el buscador de leads con IA, que se otorga aparte por ser el más caro.",
  jdmedia_live:
    "Usar JDmedIA en vivo (la guía que comparte pantalla y responde en tiempo real). Consume muchos tokens: dáselo solo a quien lo necesite.",
};
