/**
 * Los procesos de JD Media, en pasos (21/10/2026). Pedido del dueño: «armame
 * todos los procesos, bien gráficos y bien entendibles, sobre todo el uso de
 * la plataforma, que sean parte de cada puesto operativo», pensando en la gente
 * nueva que entra. Antes eran páginas de texto largo en `agency_pages`.
 *
 * Cada proceso es una fila de pasos: un ícono, una frase, quién lo hace y dónde
 * se hace en la plataforma (con link). Los roles que lo usan lo ven en su
 * ficha. Las fechas del mes no van acá: viven en «Cómo trabajamos»
 * (`/procesos/como-trabajamos`), que sale del ciclo quincenal.
 */

export interface Paso {
  icono: string;
  titulo: string;
  detalle?: string;
  /** Área que lo hace, o «cliente». Si falta, lo hace quien sigue el proceso. */
  quien?: string;
  donde?: { nombre: string; href: string };
}

export interface Proceso {
  slug: string;
  titulo: string;
  emoji: string;
  /** Una línea: para qué sirve. */
  para: string;
  /** Áreas que lo usan (lo ven en la ficha de su rol). */
  roles: string[];
  /** Cuándo se usa. */
  cuando: string;
  tipo: "plataforma" | "trabajo";
  pasos: Paso[];
  /** Cómo te das cuenta de que salió bien. */
  listo: string;
}

const TODOS = [
  "Estrategia/Dirección",
  "Coordinación General",
  "Coordinación",
  "Coordinación de Diseño",
  "Comercial",
  "Community Manager",
  "Diseño",
  "Edición Audiovisual",
  "Coordinación de Paid Media",
  "Paid Media",
  "Desarrollo Web",
  "Botly",
];
const PRODUCCION = ["Community Manager", "Diseño", "Edición Audiovisual"];

const MI_DIA = { nombre: "Mi día", href: "/dashboard" };
const MI_PERFIL = { nombre: "Mi perfil", href: "/mi-perfil" };
const TAREAS = { nombre: "Tareas", href: "/tareas" };
const CONTENIDOS = { nombre: "Contenidos", href: "/contenidos" };
const CLIENTES = { nombre: "Clientes", href: "/clientes" };

export const PROCESOS: Proceso[] = [
  // ── Para todos: usar la plataforma ────────────────────────────────────────
  {
    slug: "primer-dia",
    titulo: "Tu primer día en la plataforma",
    emoji: "👋",
    para: "Dejar tu perfil listo y saber dónde está cada cosa.",
    roles: TODOS,
    cuando: "El día que entrás",
    tipo: "plataforma",
    pasos: [
      { icono: "🔑", titulo: "Entrá con tu mail", detalle: "Te llega un link al mail que diste. No hay contraseña.", donde: { nombre: "Ingresar", href: "/login" } },
      { icono: "📸", titulo: "Subí tu foto", detalle: "Aparece en el equipo, en el organigrama y en la web.", donde: MI_PERFIL },
      { icono: "🪪", titulo: "Completá tus datos", detalle: "Teléfono, cumpleaños y cómo cobrás (CBU o alias).", donde: MI_PERFIL },
      { icono: "🧭", titulo: "Mirá tu rol", detalle: "Qué te toca, con quién trabajás y cómo se mide.", donde: { nombre: "Equipo", href: "/equipo" } },
      { icono: "📅", titulo: "Leé «Cómo trabajamos»", detalle: "Las fechas del mes que mueven a todo el equipo.", donde: { nombre: "Cómo trabajamos", href: "/procesos/como-trabajamos" } },
      { icono: "☀️", titulo: "Abrí Mi día", detalle: "Desde mañana arrancás siempre por acá.", donde: MI_DIA },
    ],
    listo: "Tu foto se ve en el organigrama y Mi perfil no tiene el punto amarillo.",
  },
  {
    slug: "mi-dia",
    titulo: "Tu día con Mi día",
    emoji: "☀️",
    para: "Saber qué hacer hoy sin buscar en ningún otro lado.",
    roles: TODOS,
    cuando: "Todos los días, al empezar",
    tipo: "plataforma",
    pasos: [
      { icono: "☀️", titulo: "Abrí Mi día", detalle: "Es la primera pantalla al entrar.", donde: MI_DIA },
      { icono: "🔴", titulo: "Primero lo vencido", detalle: "Lo que está en rojo ya pasó su fecha: va antes que todo." },
      { icono: "📌", titulo: "Después lo de hoy", detalle: "Las tareas con fecha de hoy, de arriba hacia abajo." },
      { icono: "🎯", titulo: "Mirá tus objetivos", detalle: "Cuánto llevás hoy, esta semana y este mes." },
      { icono: "✅", titulo: "Marcá lo que terminás", detalle: "Si no se marca, para la plataforma no se hizo.", donde: TAREAS },
    ],
    listo: "Terminás el día sin nada en rojo.",
  },
  {
    slug: "tarea",
    titulo: "Una tarea, de punta a punta",
    emoji: "🎫",
    para: "Cómo se mueve una tarea hasta que queda cerrada.",
    roles: TODOS,
    cuando: "Cada vez que te asignan algo",
    tipo: "plataforma",
    pasos: [
      { icono: "📥", titulo: "Te llega asignada, con fecha", quien: "Coordinación", detalle: "La reparte la PM. Toda tarea tiene dueño y fecha." },
      { icono: "▶️", titulo: "Pasala a «En progreso»", detalle: "Así el equipo sabe que la estás haciendo.", donde: TAREAS },
      { icono: "🔗", titulo: "Pegá el link del trabajo", detalle: "Drive o Canva. Sin link no se puede revisar ni programar." },
      { icono: "👀", titulo: "Mandala a «En revisión»", detalle: "Le llega a quien aprueba." },
      { icono: "✅", titulo: "Aprobada o con cambios", quien: "Coordinación de Diseño", detalle: "Si piden cambios, vuelve a vos con el comentario." },
      { icono: "🏁", titulo: "Queda completada", detalle: "Cuenta para tus objetivos y para el «a tiempo»." },
    ],
    listo: "La tarea cerró antes de su fecha y sin volver dos veces.",
  },
  {
    slug: "trabada",
    titulo: "Si algo se traba",
    emoji: "🚧",
    para: "Pedir ayuda antes de que la fecha se pase.",
    roles: TODOS,
    cuando: "Apenas ves que no llegás",
    tipo: "plataforma",
    pasos: [
      { icono: "🎫", titulo: "Abrí la tarea", donde: TAREAS },
      { icono: "🧱", titulo: "Tocá «¿Trabada?»", detalle: "Elegí qué te frena y escribilo en una línea." },
      { icono: "⏸️", titulo: "Si espera al cliente", quien: "cliente", detalle: "Se frena el reloj, lo ve en su portal y la fecha se corre los días en pausa." },
      { icono: "🙋", titulo: "Si espera a alguien del equipo", detalle: "Le llega el aviso a esa persona. No cuenta como atraso." },
      { icono: "▶️", titulo: "«Ya me destrabé»", detalle: "Apenas tenés lo que faltaba, y seguís." },
    ],
    listo: "Nadie se entera de un atraso el día de la entrega.",
  },
  {
    slug: "cambiar-fecha",
    titulo: "Mover una fecha",
    emoji: "📆",
    para: "Cambiar una fecha sin que se pierda el porqué.",
    roles: ["Coordinación", "Coordinación de Diseño", ...PRODUCCION],
    cuando: "Solo cuando no queda otra",
    tipo: "plataforma",
    pasos: [
      { icono: "🗣️", titulo: "Avisale a la PM", quien: "Coordinación", detalle: "Las fechas las mueve la PM, no cada uno." },
      { icono: "📆", titulo: "Se cambia en la tarea", quien: "Coordinación", donde: TAREAS },
      { icono: "🧾", titulo: "Queda registrado", detalle: "Quién la movió, de qué fecha a cuál. Cuenta en los objetivos de la PM." },
    ],
    listo: "Pocos cambios de fecha en el mes.",
  },

  // ── El contenido de cada quincena ─────────────────────────────────────────
  {
    slug: "calendario",
    titulo: "Armar el calendario de la quincena",
    emoji: "🗓️",
    para: "Que cada cuenta sepa qué se publica las próximas dos semanas.",
    roles: ["Community Manager", "Coordinación de Diseño", "Coordinación"],
    cuando: "Del 1 al 2 y del 15 al 17",
    tipo: "trabajo",
    pasos: [
      { icono: "🔍", titulo: "Mirá referencias", detalle: "Cuentas reales del rubro y lo que funcionó el mes pasado.", donde: { nombre: "Inspo", href: "/contenidos/inspo" } },
      { icono: "✍️", titulo: "Cargá cada pieza", detalle: "Gancho escrito, llamado a la acción y público. Sin hashtags.", donde: CONTENIDOS },
      { icono: "🎬", titulo: "Guiones de los reels", detalle: "Todos en una hoja, para que el cliente sepa qué grabar.", donde: { nombre: "Guiones", href: "/contenidos/guiones" } },
      { icono: "✨", titulo: "Lo aprueba el director creativo", quien: "Coordinación de Diseño", detalle: "El 3-4 o el 19, en la vista «Aprobar».", donde: CONTENIDOS },
      { icono: "🙋", titulo: "Lo aprueba el cliente", quien: "cliente", detalle: "El 5 o el 20. Si no contesta, se da por aprobado." },
      { icono: "🎫", titulo: "Nacen las tareas", detalle: "Al aprobar cada idea se crea la tarea de diseño o edición." },
    ],
    listo: "El 5 y el 20 el calendario está aprobado y las tareas repartidas.",
  },
  {
    slug: "aprobar",
    titulo: "Aprobar calendarios y piezas",
    emoji: "✨",
    para: "Que nada salga sin pasar por el director creativo.",
    roles: ["Coordinación de Diseño"],
    cuando: "3-4 y 19 (calendarios) · 14 y 29 (piezas)",
    tipo: "plataforma",
    pasos: [
      { icono: "☀️", titulo: "Abrí «Para aprobar» en Mi día", detalle: "Ahí está todo lo que espera tu visto bueno.", donde: MI_DIA },
      { icono: "🗓️", titulo: "Calendario: vista «Aprobar»", detalle: "Todo el mes de una cuenta en una sola pantalla.", donde: CONTENIDOS },
      { icono: "👀", titulo: "Abrí el link de cada pieza", detalle: "Mirá estrategia y estética: ¿se entiende el porqué?" },
      { icono: "✅", titulo: "Aprobar o pedir cambios", detalle: "Si pedís cambios, escribí qué. Vuelve a quien la hizo." },
      { icono: "⏱️", titulo: "En menos de 24 h hábiles", detalle: "Si te demorás, se corre la fecha del cliente." },
    ],
    listo: "«Para aprobar» vacío el 4, el 14, el 19 y el 29.",
  },
  {
    slug: "pieza",
    titulo: "Producir y entregar una pieza",
    emoji: "🎨",
    para: "De la idea aprobada a la pieza lista para publicar.",
    roles: ["Diseño", "Edición Audiovisual"],
    cuando: "Del 5 al 13 y del 20 al 28",
    tipo: "trabajo",
    pasos: [
      { icono: "🎫", titulo: "Te llega la tarea", detalle: "Con la idea, el gancho y la fecha.", donde: MI_DIA },
      { icono: "📦", titulo: "Material del cliente", quien: "cliente", detalle: "Llega el 7 o el 22. Si no llegó, «¿Trabada?»." },
      { icono: "🎨", titulo: "Producí en Canva o en el editor", detalle: "Respetá el kit de marca de la cuenta." },
      { icono: "🔗", titulo: "Pegá el link y mandá a revisión", detalle: "Drive o Canva, con permiso para ver.", donde: TAREAS },
      { icono: "✨", titulo: "Revisión del director creativo", quien: "Coordinación de Diseño", detalle: "14 o 29." },
      { icono: "🙋", titulo: "Revisión del cliente", quien: "cliente", detalle: "15 o 30." },
    ],
    listo: "Todo en revisión el 14 y el 29, sin cambios pedidos dos veces.",
  },
  {
    slug: "publicar",
    titulo: "Programar y publicar",
    emoji: "📣",
    para: "Que todo lo aprobado salga en su fecha.",
    roles: ["Community Manager"],
    cuando: "Desde el 16 y desde el 1",
    tipo: "trabajo",
    pasos: [
      { icono: "✅", titulo: "Buscá lo aprobado", detalle: "Columna «Programada» del kanban.", donde: CONTENIDOS },
      { icono: "⏰", titulo: "Programalo en Meta", detalle: "Con el texto del calendario y en la fecha de la pieza." },
      { icono: "📣", titulo: "Sale publicado", detalle: "La plataforma lo detecta sola en Instagram y lo marca." },
      { icono: "💬", titulo: "Atendé la comunidad", detalle: "Mensajes y comentarios, a la mañana y antes de cerrar." },
    ],
    listo: "Lo publicado coincide con lo pactado en el pack.",
  },

  // ── Cuentas ────────────────────────────────────────────────────────────────
  {
    slug: "arranque",
    titulo: "Arranque de una cuenta nueva",
    emoji: "🚀",
    para: "Del pago a la primera publicación, en 15 días.",
    roles: ["Coordinación", "Community Manager", "Diseño", "Coordinación de Diseño", "Coordinación de Paid Media", "Edición Audiovisual"],
    cuando: "Cuando entra un cliente",
    tipo: "trabajo",
    pasos: [
      { icono: "💳", titulo: "El cliente paga", quien: "Comercial", detalle: "Se carga en Clientes y se crean solas las tareas del arranque.", donde: CLIENTES },
      { icono: "🩺", titulo: "Día 1 · Reunión de diagnóstico", quien: "Coordinación", detalle: "Con la guía: marca, público, precios y promociones.", donde: { nombre: "Project Manager", href: "/onboarding" } },
      { icono: "🔗", titulo: "Día 2 · Página de Facebook", quien: "Coordinación de Paid Media", detalle: "Vinculada al Instagram del cliente." },
      { icono: "🎨", titulo: "Día 3 · Bio, calendario y kit de marca", quien: "Community Manager", detalle: "Diseño arma el kit; la CM la bio y el primer calendario." },
      { icono: "✨", titulo: "Día 4 · Aprueba el director creativo", quien: "Coordinación de Diseño" },
      { icono: "🙋", titulo: "Día 5 · Aprueba el cliente", quien: "cliente" },
      { icono: "📦", titulo: "Día 7 · Material crudo y perfiles", quien: "Community Manager" },
      { icono: "📣", titulo: "Día 15 · Primera publicación", quien: "Community Manager", detalle: "Después la cuenta entra al ciclo de quincenas." },
    ],
    listo: "La cuenta publica el día 15 y el cliente ya tuvo su diagnóstico.",
  },
  {
    slug: "reunion-mensual",
    titulo: "La reunión mensual con el cliente",
    emoji: "🤝",
    para: "Lo que más retiene: que el cliente vea lo hecho y lo que viene.",
    roles: ["Coordinación de Diseño", "Coordinación"],
    cuando: "Del 1 al 7 de cada mes",
    tipo: "trabajo",
    pasos: [
      { icono: "📅", titulo: "Agendala con día y hora", detalle: "Le llega el aviso al cliente.", donde: { nombre: "Agenda", href: "/agenda" } },
      { icono: "📊", titulo: "Llevá los números", detalle: "Crecimiento del Instagram y lo publicado.", donde: CLIENTES },
      { icono: "🗣️", titulo: "Hacé la reunión", detalle: "Qué funcionó, qué no y qué viene el mes que sigue." },
      { icono: "✅", titulo: "Marcá «Se dio»", detalle: "Si no se marca, la cuenta queda en riesgo.", donde: { nombre: "Calidad", href: "/clientes/calidad" } },
      { icono: "⭐", titulo: "Pedí la encuesta", detalle: "Una pregunta: qué tan conforme está." },
    ],
    listo: "Todas tus cuentas con la reunión del mes marcada antes del 7.",
  },
  {
    slug: "vincular-instagram",
    titulo: "Vincular un Instagram",
    emoji: "🔗",
    para: "Que la plataforma mida el crecimiento y se pueda pautar.",
    roles: ["Coordinación de Paid Media", "Community Manager"],
    cuando: "En el arranque, o si una cuenta aparece «sin medir»",
    tipo: "plataforma",
    pasos: [
      { icono: "📋", titulo: "Mirá cuáles faltan", donde: { nombre: "Conectar Instagram", href: "/clientes/conectar-instagram" } },
      { icono: "📘", titulo: "Página de Facebook vinculada", quien: "cliente", detalle: "El Instagram tiene que ser profesional y estar unido a su página." },
      { icono: "🤝", titulo: "Compartila con JD MEDIA", quien: "cliente", detalle: "Desde el Business Manager del cliente, como socio." },
      { icono: "✅", titulo: "Aparece como medida", detalle: "Al día siguiente ya hay foto del Instagram." },
    ],
    listo: "La cuenta deja de figurar «sin medir».",
  },

  // ── Comercial ──────────────────────────────────────────────────────────────
  {
    slug: "prospectar",
    titulo: "Prospectar todos los días",
    emoji: "📨",
    para: "Escribirle a gente nueva y que cuente para tu objetivo.",
    roles: ["Comercial"],
    cuando: "Todos los días",
    tipo: "plataforma",
    pasos: [
      { icono: "📋", titulo: "Abrí los contactos del día", donde: { nombre: "Prospección", href: "/prospeccion" } },
      { icono: "💬", titulo: "Escribile por Instagram o WhatsApp", detalle: "El mensaje sale armado; ajustalo a cada uno." },
      { icono: "✅", titulo: "Marcalo «Contactado»", detalle: "Si no lo marcás, no cuenta para tu objetivo del día." },
      { icono: "🔁", titulo: "Seguimiento a los 3 días", detalle: "A los que no respondieron." },
      { icono: "🙌", titulo: "Si responde: «Interesado»", detalle: "Y proponé una reunión." },
    ],
    listo: "Tu contador del día en Mi día llega a la meta.",
  },
  {
    slug: "cerrar",
    titulo: "Del interesado al cliente",
    emoji: "🤝",
    para: "Pasar de una charla a una cuenta que arranca.",
    roles: ["Comercial", "Coordinación"],
    cuando: "Cada vez que alguien se interesa",
    tipo: "trabajo",
    pasos: [
      { icono: "📅", titulo: "Reunión con día y hora", detalle: "Al cliente le llega el aviso.", donde: { nombre: "Reuniones", href: "/comercial/reuniones" } },
      { icono: "📄", titulo: "Propuesta en 48 horas", detalle: "Desde el cotizador, con el pack correcto. Te avisa cuando la abren.", donde: { nombre: "Comercial", href: "/comercial" } },
      { icono: "📞", titulo: "Seguimiento", detalle: "A los 2 días de abierta, si no contestó." },
      { icono: "💳", titulo: "Paga y se carga el cliente", detalle: "Si lo cerraron entre dos, marcá con quién: la comisión va 50 y 50.", donde: CLIENTES },
      { icono: "🚀", titulo: "Pasa a la PM", quien: "Coordinación", detalle: "Arranca el proceso de cuenta nueva." },
    ],
    listo: "El cliente está cargado y su arranque tiene fecha de diagnóstico.",
  },

  // ── Administración ─────────────────────────────────────────────────────────
  {
    slug: "cobros",
    titulo: "Cobros del 1 al 5",
    emoji: "💰",
    para: "Que todos los clientes paguen y quede marcado.",
    roles: ["Coordinación General", "Estrategia/Dirección"],
    cuando: "Del 1 al 5 de cada mes",
    tipo: "plataforma",
    pasos: [
      { icono: "🧾", titulo: "Generá el mes", detalle: "Crea el cobro de cada cliente activo.", donde: { nombre: "Cuentas por cobrar", href: "/finanzas/cobros" } },
      { icono: "📲", titulo: "Mandá el recordatorio", detalle: "El link de WhatsApp de cada cliente ya sale armado.", donde: { nombre: "Recordatorios", href: "/finanzas/recordatorios" } },
      { icono: "✅", titulo: "Marcá cada cobro", detalle: "Apenas entra la plata, con la fecha.", donde: { nombre: "¿Quién me pagó?", href: "/cobros" } },
      { icono: "🔴", titulo: "El 6, los que faltan", detalle: "Se llama a cada uno; si sigue sin pagar, avisale a Dirección." },
    ],
    listo: "El 5 a la noche no queda ningún cobro sin marcar.",
  },
  {
    slug: "sueldos",
    titulo: "Sueldos del 7",
    emoji: "💸",
    para: "Que el equipo cobre el mes trabajado el día 7.",
    roles: ["Coordinación General", "Estrategia/Dirección"],
    cuando: "Del 1 al 7 de cada mes",
    tipo: "plataforma",
    pasos: [
      { icono: "📊", titulo: "Revisá la nómina", detalle: "Sale sola de lo publicado y de las tareas de cada uno.", donde: { nombre: "Sueldos", href: "/coordinacion/sueldos" } },
      { icono: "✍️", titulo: "Ajustá lo que haga falta", detalle: "Extras, jornadas o descuentos acordados." },
      { icono: "🧭", titulo: "La aprueba Dirección", quien: "Estrategia/Dirección" },
      { icono: "💸", titulo: "Pagá el 7 y marcá «Pagado»", detalle: "El recibo de cada uno sale de Sueldos.", donde: { nombre: "Pagos al equipo", href: "/finanzas/pagos" } },
    ],
    listo: "El 7 todos los pagos del equipo están marcados.",
  },
];

export function procesoDe(slug: string): Proceso | null {
  return PROCESOS.find((p) => p.slug === slug) ?? null;
}

/** Los procesos de un rol: primero los de trabajo propio, después los de todos. */
export function procesosDe(area: string | null | undefined): Proceso[] {
  if (!area) return [];
  const suyos = PROCESOS.filter((p) => p.roles.includes(area));
  const propios = suyos.filter((p) => p.roles.length < TODOS.length);
  const comunes = suyos.filter((p) => p.roles.length >= TODOS.length);
  return [...propios, ...comunes];
}
