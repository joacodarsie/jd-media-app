/**
 * Steps del tour de bienvenida. Cada step navega a una ruta y muestra un
 * mensaje. NO usa selectores CSS (que se rompen al rediseñar) — apunta a
 * pantallas enteras con un overlay centrado.
 *
 * Los steps base son para todos los roles. Los específicos por rol se
 * agregan despues con `extraStepsForRole(rol)`.
 */

export interface TourStep {
  title: string;
  body: string;
  route: string;
  /** Texto del CTA secundario (ej: "Ir a Mi perfil"). Opcional. */
  ctaHref?: string;
  ctaLabel?: string;
}

const BASE_STEPS: TourStep[] = [
  {
    title: "¡Bienvenido a JD Media!",
    body: "Te voy a mostrar las pantallas que más vas a usar. Toma 2 minutos. Cuando quieras volver a verlo, podés desde Mi perfil.",
    route: "/dashboard",
  },
  {
    title: "Mi día",
    body: "Tu vista principal al entrar. Tareas de hoy, próxima reunión, alertas, publicaciones que salen hoy y un resumen por cliente. Si dudás de algo: arrancá acá.",
    route: "/dashboard",
  },
  {
    title: "Tareas",
    body: "Todo lo que tenés que hacer vive como tarea. Las podés crear desde el botón Nueva tarea, o pidiéndoselas a JDmedIA (el chat con IA).",
    route: "/tareas",
  },
  {
    title: "Calendario de contenidos",
    body: "Acá planificamos todas las publicaciones de los clientes. Vistas mes/lista/kanban, filtros, y un asistente de IA para sugerir copy, hashtags y guion.",
    route: "/contenidos",
  },
  {
    title: "JDmedIA — el asistente con IA",
    body: "Le podés preguntar lo que sea de la agencia: '¿qué tareas tiene Luz?', 'creá una tarea para Bri', 'pasá el plan de Nico al calendario'. Conoce el contexto real.",
    route: "/jdmedia",
  },
  {
    title: "Chat interno",
    body: "Canales por tema y mensajes directos. La idea: que el grueso de la comunicación del equipo viva acá, no en WhatsApp suelto.",
    route: "/chat",
  },
  {
    title: "Clientes",
    body: "Cada cliente tiene su ficha con todo: equipo, servicios, redes, accesos, onboarding, diagnóstico, plan mensual, portal y reportes. Es el centro de control de cada cuenta.",
    route: "/clientes",
  },
];

const STEPS_BY_ROLE: Record<string, TourStep[]> = {
  admin: [
    {
      title: "Equipo y Capacidad",
      body: "Como admin, mirá quién está sobrecargado y quién disponible antes de asignar trabajo nuevo. La heurística te ayuda, pero confiá en tu juicio.",
      route: "/equipo/capacity",
    },
    {
      title: "Finanzas",
      body: "Cobros, pagos al equipo, gastos y balance neto. Pregúntaselo a JDmedIA si querés un resumen rápido del mes.",
      route: "/finanzas",
    },
  ],
  coordinador: [
    {
      title: "Equipo y Capacidad",
      body: "Mirá quién está sobrecargado y quién disponible antes de asignar trabajo nuevo.",
      route: "/equipo/capacity",
    },
  ],
  comercial: [
    {
      title: "Pipeline Comercial",
      body: "Tus leads en stages: nuevo → contactado → calificado → propuesta → negociación → ganado/perdido. Mové con drag & drop.",
      route: "/comercial",
    },
  ],
  prospecting: [
    {
      title: "Pipeline Comercial",
      body: "Los leads que prospectaste viven acá. Cargá la próxima acción siempre.",
      route: "/comercial",
    },
  ],
};

const FINAL_STEP: TourStep = {
  title: "Listo. Una última cosa.",
  body: "Cada `(?)` que veas en la app abre la guía específica. En el sidebar tenés Ayuda (todas las páginas) y Novedades (qué cambió últimamente). Si dudás de algo, preguntá en #general del chat interno.",
  route: "/ayuda",
  ctaHref: "/ayuda",
  ctaLabel: "Ir al centro de ayuda",
};

export function getTourSteps(rol: string): TourStep[] {
  return [...BASE_STEPS, ...(STEPS_BY_ROLE[rol] ?? []), FINAL_STEP];
}

export const TOUR_STORAGE_KEY = "jd_tour_completed_v1";
