/**
 * Cómo trabaja cada rol de JD Media (21/10/2026). Pedido del dueño: los puestos
 * estaban «re simples» («el community manager lleva el día de sus cuentas, nada
 * más»). Esto es lo que alimenta la ficha visual de cada rol: misión, de qué
 * responde, sus momentos en la quincena (infografía), con quién trabaja (qué
 * recibe y qué entrega), su parte del arranque de una cuenta nueva, su ritmo y
 * sus herramientas. El detalle paso a paso sigue en `positions.procesos`.
 *
 * Fuente: el ciclo quincenal acordado con Luz (17/10), el arranque día a día,
 * los roles del 13-15/9 y la dirección creativa de Santi (22/9).
 */

export interface Hito {
  /** Días del mes en que pasa (las dos quincenas). */
  dias: number[];
  que: string;
}

export interface Vinculo {
  area: string;
  que: string;
}

export interface Herramienta {
  nombre: string;
  href: string;
  para: string;
}

export interface Rol {
  area: string;
  emoji: string;
  /** Tono del rol (clases de Tailwind ya escritas para que se generen). */
  tono: "amber" | "sky" | "violet" | "emerald" | "rose" | "orange" | "indigo" | "teal" | "slate";
  grupo: "Dirección" | "Coordinación" | "Producción" | "Crecimiento" | "Proyectos";
  mision: string;
  respondePor: { titulo: string; detalle: string }[];
  recibeDe: Vinculo[];
  entregaA: Vinculo[];
  /** Sus momentos fijos en la quincena. */
  ciclo: Hito[];
  /** Su parte en los primeros 15 días de una cuenta nueva. */
  arranque: { dia: number; que: string }[];
  ritmo: { cuando: "Todos los días" | "Cada semana" | "Cada mes"; que: string[] }[];
  herramientas: Herramienta[];
}

const H = {
  miDia: { nombre: "Mi día", href: "/dashboard", para: "Lo tuyo de hoy y tus objetivos" },
  tareas: { nombre: "Tareas", href: "/tareas", para: "Todo lo asignado, con fecha" },
  contenidos: { nombre: "Contenidos", href: "/contenidos", para: "Calendario y piezas de cada cuenta" },
  guiones: { nombre: "Guiones", href: "/contenidos/guiones", para: "Los guiones del mes en una hoja" },
  inspo: { nombre: "Inspo", href: "/contenidos/inspo", para: "Referencias de cada cuenta" },
  clientes: { nombre: "Clientes", href: "/clientes", para: "Ficha, accesos y semáforo de cada cuenta" },
  pm: { nombre: "Project Manager", href: "/onboarding", para: "Arranques de cuentas nuevas" },
  agenda: { nombre: "Agenda", href: "/agenda", para: "Reuniones y jornadas" },
  jornadas: { nombre: "Jornadas", href: "/jornadas", para: "El registro de cada jornada: cobros y pagos" },
  prospeccion: { nombre: "Prospección", href: "/prospeccion", para: "Contactos para escribir hoy" },
  comercial: { nombre: "Comercial", href: "/comercial", para: "Reuniones, propuestas y cierres" },
  paid: { nombre: "Paid Media", href: "/paid-media", para: "Campañas y resultados de pauta" },
  conectarIg: { nombre: "Conectar Instagram", href: "/clientes/conectar-instagram", para: "Cuentas vinculadas y sin medir" },
  direccion: { nombre: "Dirección", href: "/direccion", para: "El pulso de la agencia" },
  objetivos: { nombre: "Objetivos", href: "/objetivos/equipo", para: "Cómo viene cada uno" },
  finanzas: { nombre: "Finanzas", href: "/finanzas/resumen", para: "Números de la agencia" },
  cobros: { nombre: "Cobros", href: "/finanzas/cobros", para: "Quién pagó y quién no" },
  sueldos: { nombre: "Sueldos", href: "/coordinacion/sueldos", para: "La nómina del mes" },
  reclutamiento: { nombre: "Reclutamiento", href: "/reclutamiento", para: "CVs y búsquedas" },
  chat: { nombre: "Chat del equipo", href: "/chat", para: "Hablar con el equipo" },
} satisfies Record<string, Herramienta>;

export const ROLES: Rol[] = [
  {
    area: "Estrategia/Dirección",
    emoji: "🧭",
    tono: "amber",
    grupo: "Dirección",
    mision: "Que la agencia crezca, sea rentable y que los clientes se queden.",
    respondePor: [
      { titulo: "Rumbo y precios", detalle: "Qué servicios se venden, a qué precio y en qué condiciones." },
      { titulo: "Las personas", detalle: "Quién entra, qué hace cada rol y cómo cobra." },
      { titulo: "Los números", detalle: "Facturación, margen y que no haya bajas." },
      { titulo: "Las decisiones grandes", detalle: "Lo que ningún coordinador puede resolver solo." },
    ],
    recibeDe: [
      { area: "Coordinación", que: "Cómo vienen los tiempos y el equipo" },
      { area: "Coordinación de Diseño", que: "Calidad y clientes en riesgo" },
      { area: "Comercial", que: "Propuestas y cierres" },
      { area: "Coordinación General", que: "Cobros y sueldos del mes" },
    ],
    entregaA: [
      { area: "Coordinación", que: "Prioridades y decisiones" },
      { area: "Comercial", que: "Precios y condiciones autorizadas" },
      { area: "Coordinación General", que: "Acuerdos aprobados" },
    ],
    ciclo: [
      { dias: [1, 2, 3, 4, 5], que: "Cobros del mes (los marca Leo)" },
      { dias: [7], que: "Se paga la nómina" },
    ],
    arranque: [],
    ritmo: [
      { cuando: "Cada semana", que: ["Reunión con los coordinadores: cuentas, tareas y objetivos", "Mirar Dirección: semáforo de cuentas y objetivos del equipo"] },
      { cuando: "Cada mes", que: ["Estado de resultados", "Revisión de cada rol con Leo"] },
    ],
    herramientas: [H.direccion, H.objetivos, H.finanzas, H.clientes],
  },
  {
    area: "Coordinación General",
    emoji: "🗂️",
    tono: "slate",
    grupo: "Coordinación",
    mision: "Que los clientes paguen en fecha, que el equipo cobre el 7 y que lo legal y cada puesto estén en orden.",
    respondePor: [
      { titulo: "Cobranza", detalle: "Todos los clientes pagan del 1 al 5 y queda marcado." },
      { titulo: "Sueldos", detalle: "La nómina lista para pagar el 7." },
      { titulo: "Personas", detalle: "Búsquedas, altas y el acuerdo de cada rol." },
    ],
    recibeDe: [
      { area: "Estrategia/Dirección", que: "Acuerdos y búsquedas aprobadas" },
      { area: "Coordinación", que: "Quién entra y qué necesita" },
    ],
    entregaA: [
      { area: "Estrategia/Dirección", que: "Cobros y sueldos del mes" },
      { area: "Coordinación", que: "Gente nueva con su perfil completo" },
    ],
    ciclo: [
      { dias: [1, 2, 3, 4, 5], que: "Cobrar y marcar cada cobro" },
      { dias: [6, 7], que: "Revisar la nómina y pagar el 7" },
    ],
    arranque: [],
    ritmo: [
      { cuando: "Cada mes", que: ["Cobros del 1 al 5", "Sueldos el 7", "Seguimiento de cada rol con su coordinador"] },
    ],
    herramientas: [H.cobros, H.sueldos, H.reclutamiento, H.objetivos],
  },
  {
    area: "Coordinación",
    emoji: "🎯",
    tono: "sky",
    grupo: "Coordinación",
    mision: "Que todo salga en tiempo y forma: es la única puerta del equipo.",
    respondePor: [
      { titulo: "Repartir y poner fechas", detalle: "Cada tarea tiene dueño y fecha. Nadie trabaja sin saber para cuándo." },
      { titulo: "Los tiempos", detalle: "Que el calendario, las piezas y la publicación salgan en fecha." },
      { titulo: "Los arranques", detalle: "Que cada cuenta nueva publique el día 15." },
      { titulo: "Destrabar", detalle: "Lo que se frena en el equipo o con el cliente." },
    ],
    recibeDe: [
      { area: "Comercial", que: "La cuenta nueva que pagó" },
      { area: "Coordinación de Diseño", que: "Calendarios y piezas aprobadas" },
      { area: "Estrategia/Dirección", que: "Prioridades" },
    ],
    entregaA: [
      { area: "Community Manager", que: "Tareas y fechas" },
      { area: "Diseño", que: "Tareas y fechas" },
      { area: "Edición Audiovisual", que: "Tareas y fechas" },
      { area: "Coordinación de Paid Media", que: "Cuentas nuevas con pauta" },
    ],
    ciclo: [
      { dias: [2, 17], que: "Controlar que los calendarios estén" },
      { dias: [7, 22], que: "Controlar que llegó el material crudo" },
      { dias: [14, 29], que: "Controlar las entregas a revisión" },
      { dias: [16, 1], que: "Que todo se publique" },
      { dias: [25], que: "Carta acuerdo del mes siguiente a cada cliente" },
    ],
    arranque: [
      { dia: 1, que: "Cargar la fecha de la reunión de diagnóstico" },
      { dia: 2, que: "Página de Facebook vinculada (con Paid Media)" },
      { dia: 7, que: "Material crudo recibido" },
      { dia: 15, que: "La cuenta empieza a publicar" },
    ],
    ritmo: [
      { cuando: "Todos los días", que: ["Mirar lo atrasado y avisar a cada uno", "Responder las «¿Trabada?»", "Confirmar las jornadas que ya se hicieron: duración y viáticos de cada uno"] },
      { cuando: "Cada semana", que: ["Bajada de prioridades al equipo", "Revisar los arranques en Project Manager"] },
      { cuando: "Cada mes", que: ["Carta acuerdo el 25", "Que los clientes contesten la encuesta"] },
    ],
    herramientas: [H.miDia, H.tareas, H.pm, H.contenidos, H.jornadas, H.objetivos],
  },
  {
    area: "Coordinación de Diseño",
    emoji: "✨",
    tono: "violet",
    grupo: "Coordinación",
    mision: "Que todo lo que sale sea bueno y tenga estrategia, y que los clientes estén conformes y se queden.",
    respondePor: [
      { titulo: "Aprobar todo", detalle: "Calendarios y todas las piezas pasan por su aprobación." },
      { titulo: "La reunión mensual", detalle: "Con cada una de sus cuentas, del 1 al 7." },
      { titulo: "Clientes conformes", detalle: "Satisfacción y que renueven." },
      { titulo: "El criterio", detalle: "Lo estético y lo estratégico de la agencia." },
    ],
    recibeDe: [
      { area: "Community Manager", que: "El calendario de la quincena" },
      { area: "Diseño", que: "Piezas en revisión" },
      { area: "Edición Audiovisual", que: "Videos en revisión" },
    ],
    entregaA: [
      { area: "Community Manager", que: "Calendario aprobado o con cambios" },
      { area: "Diseño", que: "Pieza aprobada o con cambios" },
      { area: "Edición Audiovisual", que: "Video aprobado o con cambios" },
      { area: "Estrategia/Dirección", que: "Clientes en riesgo, el mismo día" },
    ],
    ciclo: [
      { dias: [1, 2, 3, 4, 5, 6, 7], que: "Reuniones mensuales con sus cuentas" },
      { dias: [3, 4, 19], que: "Aprobar los calendarios" },
      { dias: [14, 29], que: "Aprobar las piezas" },
    ],
    arranque: [{ dia: 4, que: "Aprobar el kit de marca y el primer calendario" }],
    ritmo: [
      { cuando: "Todos los días", que: ["Lo de «Para aprobar» en Mi día, en menos de 24 h hábiles"] },
      { cuando: "Cada mes", que: ["Reunión mensual con cada cuenta (del 1 al 7)", "Mirar la satisfacción de cada cliente"] },
    ],
    herramientas: [H.miDia, H.contenidos, H.agenda, H.clientes, H.inspo],
  },
  {
    area: "Comercial",
    emoji: "🤝",
    tono: "emerald",
    grupo: "Crecimiento",
    mision: "Que entren clientes nuevos todos los meses.",
    respondePor: [
      { titulo: "Prospectar", detalle: "Escribirle a contactos nuevos todos los días (la meta está en Mi día)." },
      { titulo: "Reuniones", detalle: "Convertir el interés en una reunión." },
      { titulo: "Propuestas", detalle: "En 48 horas, clara y con el pack correcto." },
      { titulo: "Cierres", detalle: "Acompañar hasta que pague y pasarlo al equipo." },
    ],
    recibeDe: [
      { area: "Estrategia/Dirección", que: "Precios y condiciones" },
      { area: "La web", que: "Consultas y diagnósticos de Instagram" },
    ],
    entregaA: [{ area: "Coordinación", que: "La cuenta nueva, apenas paga" }],
    ciclo: [],
    arranque: [],
    ritmo: [
      { cuando: "Todos los días", que: ["Escribirle a los contactos del día y marcarlos", "Seguimiento a los que no respondieron en 3 días"] },
      { cuando: "Cada semana", que: ["Reuniones con interesados", "Propuestas enviadas en 48 horas"] },
      { cuando: "Cada mes", que: ["Mirar tus objetivos: contactos, reuniones, propuestas y cierres"] },
    ],
    herramientas: [H.prospeccion, H.comercial, H.miDia, H.objetivos],
  },
  {
    area: "Community Manager",
    emoji: "📱",
    tono: "rose",
    grupo: "Producción",
    mision: "Que cada cuenta tenga su calendario a tiempo, publique todo lo pactado y tenga la comunidad atendida.",
    respondePor: [
      { titulo: "El calendario", detalle: "Cada quincena, con gancho, llamado a la acción y referencias." },
      { titulo: "Publicar", detalle: "Programar lo aprobado para que salga en fecha." },
      { titulo: "Las historias", detalle: "Los días que incluye el pack." },
      { titulo: "La comunidad", detalle: "Ningún mensaje ni comentario sin responder." },
    ],
    recibeDe: [
      { area: "Coordinación", que: "Tareas y fechas" },
      { area: "Coordinación de Diseño", que: "Calendario aprobado" },
      { area: "Diseño", que: "Piezas aprobadas" },
      { area: "Edición Audiovisual", que: "Videos aprobados" },
    ],
    entregaA: [
      { area: "Coordinación de Diseño", que: "El calendario para aprobar" },
      { area: "Coordinación", que: "Avisos de lo que se traba" },
    ],
    ciclo: [
      { dias: [1, 2, 15, 16, 17], que: "Armar el calendario" },
      { dias: [16, 1], que: "Programar: empieza a publicarse" },
    ],
    arranque: [
      { dia: 3, que: "Biografía, destacadas y primer calendario" },
      { dia: 7, que: "Perfiles rediseñados" },
    ],
    ritmo: [
      { cuando: "Todos los días", que: ["Mensajes y comentarios a la mañana y antes de cerrar", "Historias de los días del pack"] },
      { cuando: "Cada semana", que: ["Revisar que todo lo de la semana esté programado"] },
      { cuando: "Cada mes", que: ["Dos calendarios: el 2 y el 17"] },
    ],
    herramientas: [H.miDia, H.contenidos, H.guiones, H.inspo, H.clientes],
  },
  {
    area: "Diseño",
    emoji: "🎨",
    tono: "orange",
    grupo: "Producción",
    mision: "Que cada pieza se vea como la marca y salga a tiempo.",
    respondePor: [
      { titulo: "Piezas", detalle: "Posteos y carruseles del calendario." },
      { titulo: "Portadas", detalle: "Las portadas de los reels." },
      { titulo: "Kit de marca", detalle: "En cada cuenta nueva, el día 3." },
    ],
    recibeDe: [
      { area: "Coordinación", que: "Tareas y fechas" },
      { area: "Coordinación de Diseño", que: "Aprobación o cambios" },
    ],
    entregaA: [
      { area: "Coordinación de Diseño", que: "Piezas en revisión, con link" },
      { area: "Community Manager", que: "Piezas aprobadas para programar" },
    ],
    ciclo: [
      { dias: [5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27, 28], que: "Producir las piezas" },
      { dias: [14, 29], que: "Entregar todo a revisión" },
    ],
    arranque: [{ dia: 3, que: "Kit de marca (una sola versión completa)" }],
    ritmo: [
      { cuando: "Todos los días", que: ["Avanzar las piezas con fecha más cercana"] },
      { cuando: "Cada mes", que: ["Dos tandas de producción: del 5 al 13 y del 20 al 28"] },
    ],
    herramientas: [H.miDia, H.tareas, H.contenidos, H.inspo],
  },
  {
    area: "Edición Audiovisual",
    emoji: "🎬",
    tono: "indigo",
    grupo: "Producción",
    mision: "Que cada video se mire hasta el final y salga a tiempo.",
    respondePor: [
      { titulo: "Reels y videos", detalle: "Del calendario de sus cuentas." },
      { titulo: "Terminaciones", detalle: "Subtítulos, sonido, ritmo y gancho." },
      { titulo: "Jornadas", detalle: "Acompañar cuando se graba." },
    ],
    recibeDe: [
      { area: "Coordinación", que: "Tareas y fechas" },
      { area: "Coordinación de Diseño", que: "Aprobación o cambios" },
    ],
    entregaA: [
      { area: "Coordinación de Diseño", que: "Videos en revisión, con link" },
      { area: "Community Manager", que: "Videos aprobados para programar" },
    ],
    ciclo: [
      { dias: [7, 22], que: "Llega el material crudo del cliente" },
      { dias: [8, 9, 10, 11, 12, 13, 23, 24, 25, 26, 27, 28], que: "Editar" },
      { dias: [14, 29], que: "Entregar todo a revisión" },
    ],
    arranque: [{ dia: 7, que: "Material crudo del cliente recibido" }],
    ritmo: [
      { cuando: "Todos los días", que: ["Avanzar los videos con fecha más cercana"] },
      { cuando: "Cada mes", que: ["Dos tandas de edición: hasta el 13 y hasta el 28"] },
    ],
    herramientas: [H.miDia, H.tareas, H.contenidos, H.guiones],
  },
  {
    area: "Coordinación de Paid Media",
    emoji: "📈",
    tono: "teal",
    grupo: "Crecimiento",
    mision: "Que cada cuenta tenga su pauta conectada, corriendo y midiendo resultados.",
    respondePor: [
      { titulo: "Vincular", detalle: "Página e Instagram de cada cuenta compartidos con JD MEDIA." },
      { titulo: "Onboarding de pauta", detalle: "Accesos, cuenta publicitaria, pago y campañas." },
      { titulo: "Campañas activas", detalle: "Corriendo y optimizadas cada semana." },
      { titulo: "Resultados", detalle: "Informe de la pauta cada mes." },
    ],
    recibeDe: [
      { area: "Coordinación", que: "Cuentas nuevas con pauta" },
      { area: "Diseño", que: "Creatividades" },
      { area: "Edición Audiovisual", que: "Videos para anuncios" },
    ],
    entregaA: [
      { area: "Coordinación", que: "Cuentas vinculadas y campañas activas" },
      { area: "Estrategia/Dirección", que: "Resultados de la pauta" },
    ],
    ciclo: [{ dias: [16], que: "Las campañas nuevas arrancan desde la segunda quincena" }],
    arranque: [
      { dia: 2, que: "Página de Facebook vinculada al Instagram" },
      { dia: 3, que: "Compartir y conectar con JD MEDIA" },
    ],
    ritmo: [
      { cuando: "Todos los días", que: ["Mirar que ninguna cuenta se quedó sin pauta"] },
      { cuando: "Cada semana", que: ["Optimizar cada campaña"] },
      { cuando: "Cada mes", que: ["Informe de resultados de cada cuenta"] },
    ],
    herramientas: [H.paid, H.conectarIg, H.clientes, H.miDia],
  },
  {
    area: "Paid Media",
    emoji: "📣",
    tono: "teal",
    grupo: "Crecimiento",
    mision: "Que la pauta de sus cuentas traiga resultados.",
    respondePor: [
      { titulo: "Campañas", detalle: "Armar, lanzar y optimizar." },
      { titulo: "Medir", detalle: "Resultados contra el objetivo de cada campaña." },
    ],
    recibeDe: [{ area: "Coordinación de Paid Media", que: "Cuentas y objetivos" }],
    entregaA: [{ area: "Coordinación de Paid Media", que: "Campañas activas y resultados" }],
    ciclo: [{ dias: [16], que: "Las campañas nuevas arrancan desde la segunda quincena" }],
    arranque: [],
    ritmo: [{ cuando: "Cada semana", que: ["Optimizar cada campaña"] }],
    herramientas: [H.paid, H.clientes],
  },
  {
    area: "Desarrollo Web",
    emoji: "💻",
    tono: "sky",
    grupo: "Proyectos",
    mision: "Webs que convierten visitas en consultas.",
    respondePor: [
      { titulo: "El proyecto", detalle: "De la propuesta a la web publicada." },
      { titulo: "Tiempos", detalle: "Entregar en la fecha acordada." },
    ],
    recibeDe: [{ area: "Comercial", que: "El proyecto vendido y el brief" }],
    entregaA: [{ area: "Coordinación", que: "La web publicada" }],
    ciclo: [],
    arranque: [],
    ritmo: [{ cuando: "Cada semana", que: ["Avance del proyecto al cliente"] }],
    herramientas: [H.tareas, H.clientes],
  },
  {
    area: "Botly",
    emoji: "🤖",
    tono: "indigo",
    grupo: "Proyectos",
    mision: "Que el WhatsApp de cada cliente responda solo, bien y a cualquier hora.",
    respondePor: [
      { titulo: "Configurar", detalle: "El bot con la información del negocio." },
      { titulo: "Derivar", detalle: "Que pase a una persona cuando hace falta." },
    ],
    recibeDe: [{ area: "Comercial", que: "El cliente que contrató Botly" }],
    entregaA: [{ area: "Coordinación", que: "El bot funcionando" }],
    ciclo: [],
    arranque: [],
    ritmo: [{ cuando: "Cada semana", que: ["Revisar charlas y mejorar respuestas"] }],
    herramientas: [H.tareas, H.clientes],
  },
];

export function rolDe(area: string | null | undefined): Rol | null {
  return ROLES.find((r) => r.area === area) ?? null;
}

/** Nombre corto del rol para mostrar (el área tal cual suena rara: «Coordinación»). */
export const NOMBRE_ROL: Record<string, string> = {
  "Estrategia/Dirección": "Dirección",
  "Coordinación General": "Coordinación General",
  Coordinación: "Project Manager",
  "Coordinación de Diseño": "Dirección Creativa",
  Comercial: "Comercial",
  "Community Manager": "Community Manager",
  Diseño: "Diseño",
  "Edición Audiovisual": "Edición Audiovisual",
  "Coordinación de Paid Media": "Coordinación de Paid Media",
  "Paid Media": "Paid Media",
  "Desarrollo Web": "Desarrollo Web",
  Botly: "Botly",
};
