/**
 * El plan de arranque de Administración y Personas (noviembre 2026): lo que el
 * dueño delega para dejar de ocuparse. Cada punto se vuelve una tarea con
 * `rutina_key` «adm:<clave>» cuando la persona a cargo tiene usuario, y se marca
 * hecho cuando la tarea se completa.
 */
export type AreaPlan = "plata" | "legal" | "personas" | "metricas";

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
  { area: "metricas", titulo: "Métricas", emoji: "📊" },
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
  { clave: "calidad", area: "personas", titulo: "Medir la calidad de diseño y edición", hecho: "Un mes de piezas puntuadas con Santi, por persona." },
  { clave: "seniors", area: "personas", titulo: "Definir el equipo de diseño y edición", hecho: "Propuesta de un senior y un apoyo por área, con costo y prueba de 30 días, aprobada por dirección." },
  { clave: "grupos", area: "personas", titulo: "Dejar a la CM como contacto con el cliente", hecho: "Diseño y edición fuera de los grupos, con pedidos por tarea." },
  { clave: "metricas-mes", area: "metricas", titulo: "Armar el análisis de métricas del mes", hecho: "Cada mes: cuentas, facturación, margen, bajas, cobranza, entrega y qué se hace al respecto." },
  { clave: "margen", area: "metricas", titulo: "Medir el margen real", hecho: "Margen por cuenta y total, con sueldos y gastos reales cargados." },
];
