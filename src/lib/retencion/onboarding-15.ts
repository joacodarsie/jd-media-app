/**
 * El onboarding de 15 días, como ticket madre con su desglose.
 *
 * Por qué existe: el botón "generar tareas iniciales" se apretó **una sola vez
 * en toda la historia de la app** (Boxescar, 23/6/2026) y ni esa vez dejó
 * tareas vivas. Las 12 cuentas activas arrancaron con CERO tareas de
 * onboarding. No es que el arranque salga mal: no ocurre.
 *
 * Y ahí es donde se mueren las cuentas. Ninguna de las 7 bajas de los últimos
 * 3 meses pasó de 3,2 meses, y 8 de las 12 activas están hoy en esa ventana.
 * Ver [[project-jd-media-retencion]].
 *
 * Por eso esto NO es otra lista de casillas para tildar —eso ya se probó con
 * `client_onboarding` y no se llena— sino **tickets de verdad**: con número, con
 * responsable y con fecha, que es lo único que la app sabe recordar sola (el
 * aviso diario mira `tasks`).
 *
 * El orden lo dictó el dueño en la reunión del 13/9/2026. Todo el módulo es
 * PURO: entra el cliente y su equipo, sale el plan. Sin base ni red.
 */

/** Cuántos días dura el arranque. Dos semanas de preparación (acuerdo del 13/9). */
import { MARCA_REAL } from "@/lib/pack-marca-real";

export const DIAS_ONBOARDING = 15;

export interface EquipoDelCliente {
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  /** A quién cae lo que no tiene dueño claro: la project manager. */
  fallback: string;
}

export interface PasoOnboarding {
  titulo: string;
  descripcion: string;
  area: string;
  asignado_a_id: string;
  /** Días desde el arranque. El día 1 es el primer día hábil de la cuenta. */
  dia: number;
}

export interface PlanOnboarding {
  madre: { titulo: string; descripcion: string; area: string; asignado_a_id: string; dia: number };
  pasos: PasoOnboarding[];
}

/** Suma días a "YYYY-MM-DD" leyendo los dígitos (sin `new Date`, sin zona horaria). */
export function sumarDias(ymd: string, dias: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Título del ticket madre. Es la clave de deduplicación. */
export function tituloMadre(nombreCliente: string): string {
  return `Onboarding 15 días — ${nombreCliente}`;
}

/**
 * El plan de arranque de una cuenta.
 *
 * `servicios` decide qué bloques entran: una cuenta de solo pauta no lleva
 * calendario ni manual de marca, y meterle esos tickets sería ruido que el
 * equipo aprende a ignorar.
 *
 * **Ningún paso queda sin responsable**: si la cuenta no tiene diseñador o
 * editor cargado, cae en el fallback. Una tarea sin dueño es invisible — es
 * exactamente lo que pasó con las 57 tareas sin fecha de septiembre.
 */
export function planOnboarding(input: {
  nombreCliente: string;
  servicios: string[];
  equipo: EquipoDelCliente;
}): PlanOnboarding {
  const { nombreCliente, servicios, equipo } = input;
  const svc = new Set(servicios);
  // Pack Marca Real solo: es un proyecto de diez días, no una cuenta de redes.
  if (svc.has("marca_real") && !svc.has("gestion_redes")) return planMarcaReal(nombreCliente, equipo);
  const cm = equipo.cm_id ?? equipo.fallback;
  const dis = equipo.disenador_id ?? equipo.fallback;
  const av = equipo.audiovisual_id ?? equipo.fallback;
  const mb = equipo.media_buyer_id ?? equipo.fallback;

  const pasos: PasoOnboarding[] = [];
  const add = (
    dia: number,
    titulo: string,
    descripcion: string,
    area: string,
    asignado_a_id: string
  ) => pasos.push({ dia, titulo, descripcion, area, asignado_a_id });

  // ── Común a toda cuenta nueva ──
  // Si la cuenta arranca sin equipo cargado, TODO el onboarding cae en una sola
  // persona por el fallback y además los sueldos no saben a quién pagarle. Va
  // primero porque condiciona a los otros once pasos.
  const faltaEquipo =
    !equipo.cm_id ||
    (svc.has("gestion_redes") && (!equipo.disenador_id || !equipo.audiovisual_id)) ||
    (svc.has("paid_media") && !equipo.media_buyer_id);
  if (faltaEquipo) {
    add(
      1,
      "Asignar el equipo de la cuenta",
      `${nombreCliente} arrancó sin equipo completo cargado, así que por ahora todo el onboarding quedó a tu nombre. Cargá CM, diseñador, editor y media buyer en la ficha del cliente y reasigná las tareas de abajo. Sin esto los sueldos tampoco saben a quién pagarle la cuenta.`,
      "Coordinación",
      equipo.fallback
    );
  }

  add(
    1,
    "Reunión de diagnóstico",
    `Primera reunión con ${nombreCliente}. Presentar al equipo, entender el negocio y qué espera de estos 15 días. De acá sale todo lo demás.`,
    "Coordinación",
    cm
  );

  if (svc.has("gestion_redes")) {
    add(
      3,
      "Manual de marca",
      "Paleta, tipografías, tono de voz y lineamientos visuales. Es lo que hace que las piezas de los 15 días salgan parejas.",
      "Coordinación de Diseño",
      dis
    );
    add(
      3,
      "Lista del contenido crudo que necesitamos",
      `Armar la lista, punto por punto, de TODO el material que hay que pedirle a ${nombreCliente}: fotos, videos, logos, productos, personas. Cuanto más específica, menos idas y vueltas. Se le manda apenas esté.`,
      "Community Manager",
      cm
    );
    add(
      5,
      "Calendario de contenidos para aprobar",
      `El calendario de los 15 días, con copys, formatos y referencias. Lo aprueba ${nombreCliente} antes de que nadie produzca nada.`,
      "Community Manager",
      cm
    );
    add(
      5,
      "Día 5: ¿ya hay contenido?",
      "Hito de control. Si al día 5 no hay material con el que trabajar, el arranque ya se está atrasando: hay que reclamarlo o resolverlo con una jornada de producción.",
      "Coordinación",
      cm
    );
    add(
      6,
      "¿Hace falta jornada de producción?",
      `Definir con ${nombreCliente} si se hace jornada. Si sí: fecha, locación, lista de tomas y briefing. Si no, queda cerrado y no se vuelve a preguntar.`,
      "Edición Audiovisual",
      av
    );
    add(
      7,
      "Contenido crudo ordenado en carpetas",
      "Todo el material que mandó el cliente, ordenado en el Drive de la cuenta. Sin esto el diseñador y el editor no pueden arrancar.",
      "Community Manager",
      cm
    );
    add(
      7,
      "Optimizar el perfil: bio, accesos y destacadas",
      "Biografía, foto, links y accesos. Las portadas de las destacadas van en su propio ticket, que lo abre el CM con el detalle de cuáles son.",
      "Community Manager",
      cm
    );
    add(
      12,
      "Portadas de las destacadas",
      "Las portadas que pidió el CM en su ticket, más las placas que van adentro de cada destacada.",
      "Diseño",
      dis
    );
    add(
      13,
      "Piezas gráficas de los 15 días",
      "Todas las placas y carruseles del calendario aprobado, con el archivo final cargado en cada posteo.",
      "Diseño",
      dis
    );
    add(
      13,
      "Videos de los 15 días",
      "Todos los reels y videos del calendario aprobado, con el archivo final cargado en cada posteo.",
      "Edición Audiovisual",
      av
    );
    add(
      14,
      "Aprobación del cliente y programación",
      `Mostrarle todo a ${nombreCliente}, aplicar los cambios que pida y dejar las piezas programadas. El día 15 tiene que estar publicando.`,
      "Community Manager",
      cm
    );
    // El primer mes el cliente paga el abono entero y ve la mitad del contenido:
    // la puesta en marcha va incluida (decisión del dueño, 26/9/2026). Si nadie
    // le muestra lo que se hizo en estas dos semanas, siente que pagó y no vio
    // nada, justo en los meses en que se fueron todas las bajas.
    add(
      15,
      "Entrega del arranque al cliente",
      `Reunión corta (20-30 minutos) con ${nombreCliente} para entregarle lo que se hizo en estas dos semanas: el diagnóstico, el manual de marca, el perfil optimizado con sus destacadas y el calendario aprobado. Contarle qué va a salir el resto del mes y agendar la primera reunión mensual. Participa el director creativo de la cuenta.`,
      "Coordinación",
      equipo.fallback
    );
  }

  if (svc.has("paid_media")) {
    add(
      3,
      "Accesos al Business Manager y píxel",
      "Pedir acceso a Meta Business Manager y Google Ads, y verificar que el píxel y las conversiones midan de verdad. Sin esto la campaña corre a ciegas.",
      "Paid Media",
      mb
    );
    add(
      7,
      "Objetivos y presupuesto acordados",
      "Acordar con el cliente qué se persigue (consultas, ventas, ROAS), con qué presupuesto y cómo se va a medir.",
      "Paid Media",
      mb
    );
    add(
      10,
      "Primera campaña al aire",
      "Estructura, segmentaciones, presupuestos y creatividades. Al aire antes de que termine el arranque.",
      "Paid Media",
      mb
    );
  }

  if (svc.has("desarrollo_web")) {
    add(
      5,
      "Relevamiento del sitio",
      "Funcionalidades, integraciones, contenidos y plazos.",
      "Desarrollo Web",
      equipo.fallback
    );
  }

  if (svc.has("botly")) {
    add(
      5,
      "Definir el flujo del bot",
      "Mapear conversaciones, intenciones e integraciones.",
      "Botly",
      equipo.fallback
    );
  }

  const madre = {
    titulo: tituloMadre(nombreCliente),
    descripcion: `Los primeros 15 días de **${nombreCliente}**.

El desglose de abajo es el arranque completo, en orden y con fecha. **El avance se mide por las subtareas terminadas**, no por el estado de este ticket.

Por qué importa tanto: de las últimas 7 cuentas que se fueron, **ninguna pasó de 3 meses**, y hasta hoy **ninguna cuenta de la agencia arrancó con un onboarding cargado**. El mes 1 es donde se decide si la cuenta se queda.

Al día 15 el cliente tiene que estar publicando, con el perfil optimizado y el calendario aprobado por él.`,
    area: "Coordinación",
    asignado_a_id: equipo.fallback,
    dia: DIAS_ONBOARDING,
  };

  pasos.sort((a, b) => a.dia - b.dia || a.titulo.localeCompare(b.titulo));
  return { madre, pasos };
}

/**
 * El arranque del Pack Marca Real (24/9): brief, dos propuestas de logo, las
 * rondas de cambios y la entrega en diez días hábiles, lo mismo que promete la
 * carta acuerdo (lib/pack-marca-real.ts). Antes le caía el onboarding de redes
 * de 15 días, con calendario, jornada y publicación, que no aplica.
 */
function planMarcaReal(nombreCliente: string, equipo: EquipoDelCliente): PlanOnboarding {
  const dis = equipo.disenador_id ?? equipo.fallback;
  const pm = equipo.fallback;
  const m = MARCA_REAL;
  const pasos: PasoOnboarding[] = [];
  const add = (dia: number, titulo: string, descripcion: string, area: string, asignado_a_id: string) =>
    pasos.push({ dia, titulo, descripcion, area, asignado_a_id });

  if (!equipo.disenador_id) {
    add(
      1,
      "Asignar quién diseña la marca",
      `${nombreCliente} arrancó sin diseñador cargado: todo quedó a tu nombre. Cargalo en la ficha del cliente y reasigná las tareas de abajo.`,
      "Coordinación",
      pm
    );
  }
  add(
    1,
    "Mandar el brief de marca",
    `Las 10 preguntas del brief de identidad a ${nombreCliente}: qué hace la marca, a quién le vende, cómo la describiría, referencias que le gustan y qué no quiere. El plazo de ${m.diasHabilesEntrega} días hábiles corre desde que lo devuelve completo.`,
    "Coordinación",
    pm
  );
  add(
    3,
    "Brief recibido y material ordenado",
    "El brief completo, el logo actual si tiene y sus referencias, en el Drive de la cuenta. Si falta algo, reclamarlo hoy: el plazo de entrega depende de esto.",
    "Coordinación",
    pm
  );
  add(
    5,
    `${m.propuestasLogo} propuestas de logo`,
    `Dos propuestas de logo distintas entre sí, presentadas con su paleta y tipografías, para que ${nombreCliente} elija una.`,
    "Diseño",
    dis
  );
  add(
    7,
    "Logo final, paleta y tipografías",
    `Ajustes sobre la propuesta elegida (entran ${m.rondasCambios} rondas de cambios). Logo con y sin fondo, paleta de colores y tipografías definidas.`,
    "Diseño",
    dis
  );
  add(
    9,
    "Plantillas y perfil de Instagram",
    `${m.plantillasPosteo} plantillas de posteo y ${m.plantillasHistoria} de historia editables en Canva, foto de perfil, biografía y portadas de destacadas.`,
    "Diseño",
    dis
  );
  add(
    9,
    "Plantilla de calendario y manual de 30 ideas",
    "La plantilla para organizar las publicaciones y el manual de regalo: 10 ideas para vender, 10 para generar confianza y 10 educativas, con el formato de cada una.",
    "Community Manager",
    equipo.cm_id ?? pm
  );
  add(
    10,
    "Entrega final",
    `Mandarle a ${nombreCliente} los archivos finales (PNG y PDF), el acceso a las plantillas y el manual. Es buen momento para ofrecerle la gestión de redes.`,
    "Coordinación",
    pm
  );

  pasos.sort((a, b) => a.dia - b.dia || a.titulo.localeCompare(b.titulo));
  return {
    madre: {
      titulo: tituloMadre(nombreCliente),
      descripcion: `El Pack Marca Real de **${nombreCliente}**: identidad, plantillas, perfil de Instagram, calendario y el manual de 30 ideas.

Se entrega en **${m.diasHabilesEntrega} días hábiles** desde que el cliente devuelve el brief. El desglose de abajo sigue ese plazo.`,
      area: "Coordinación",
      asignado_a_id: pm,
      dia: m.diasHabilesEntrega,
    },
    pasos,
  };
}

/** Las filas listas para insertar, con la fecha resuelta desde el arranque. */
export function filasDelPlan(
  plan: PlanOnboarding,
  fechaInicio: string
): {
  madre: { titulo: string; descripcion: string; area: string; asignado_a_id: string; fecha_limite: string };
  pasos: (PasoOnboarding & { fecha_limite: string })[];
} {
  return {
    madre: {
      titulo: plan.madre.titulo,
      descripcion: plan.madre.descripcion,
      area: plan.madre.area,
      asignado_a_id: plan.madre.asignado_a_id,
      fecha_limite: sumarDias(fechaInicio, plan.madre.dia),
    },
    pasos: plan.pasos.map((p) => ({ ...p, fecha_limite: sumarDias(fechaInicio, p.dia) })),
  };
}
