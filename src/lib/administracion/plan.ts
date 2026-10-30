/**
 * El plan de arranque de Administración y Personas (noviembre 2026): lo que el
 * dueño delega para dejar de ocuparse. Cada punto se vuelve una tarea con
 * `rutina_key` «adm:<clave>» cuando la persona a cargo tiene usuario, y se marca
 * hecho cuando la tarea se completa.
 */
export type AreaPlan = "plata" | "legal" | "personas";

export interface PuntoPlan {
  clave: string;
  area: AreaPlan;
  titulo: string;
  /** Qué significa que quedó hecho. */
  hecho: string;
}

export const AREAS_PLAN: { area: AreaPlan; titulo: string; emoji: string }[] = [
  { area: "plata", titulo: "Plata", emoji: "💰" },
  { area: "legal", titulo: "Legal y contratos", emoji: "📄" },
  { area: "personas", titulo: "Personas", emoji: "🤝" },
];

export const PLAN_ADMINISTRACION: PuntoPlan[] = [
  { clave: "cobranza", area: "plata", titulo: "Hacerse cargo de la cobranza del 1 al 5", hecho: "Todos los cobros del mes marcados en la plataforma el día que entran." },
  { clave: "deudas", area: "plata", titulo: "Ordenar las deudas de clientes", hecho: "Cada deuda con monto, responsable y fecha de resolución." },
  { clave: "pagos", area: "plata", titulo: "Hacerse cargo de los pagos del equipo", hecho: "Sueldos listos el 5 y pagados el 7, con el detalle de cada persona." },
  { clave: "contaduria", area: "plata", titulo: "Ordenar la contaduría de la agencia", hecho: "Circuito de facturación definido y contador a cargo." },
  { clave: "sas", area: "legal", titulo: "Definir el paso a SAS", hecho: "Decisión tomada con contador y escribano: costos, plazos y socios." },
  { clave: "arca", area: "legal", titulo: "Revisar la situación en ARCA", hecho: "Situación impositiva de la agencia por escrito, sin vencimientos abiertos." },
  { clave: "contratos-clientes", area: "legal", titulo: "Completar los contratos de los clientes", hecho: "Todas las cuentas activas con carta acuerdo y CUIT cargado." },
  { clave: "contratos-equipo", area: "legal", titulo: "Completar los contratos del equipo", hecho: "Cada persona con su acuerdo firmado y cargado." },
  { clave: "seleccion", area: "personas", titulo: "Hacerse cargo de la selección", hecho: "Proceso escrito: perfil, búsqueda, entrevistas y decisión." },
  { clave: "onboarding", area: "personas", titulo: "Armar el ingreso de cada persona nueva", hecho: "Cada ingreso con accesos, contrato y primera semana definidos." },
];
