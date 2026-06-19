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
] as const;

export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABEL: Record<Feature, string> = {
  finanzas: "Finanzas (cobros, pagos, gastos, rentabilidad)",
  global: "Global (KPIs de toda la agencia)",
  equipo_compensacion: "Ver compensaciones del equipo",
  clientes_credenciales: "Ver credenciales de los clientes",
  documentos_globales: "Editar documentos generales de la agencia",
  comercial: "Vender (pipeline comercial)",
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
};
