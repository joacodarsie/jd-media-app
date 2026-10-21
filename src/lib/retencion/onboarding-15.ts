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
/**
 * Quién hace cada paso y cuándo está hecho (19/10/2026, pedido del dueño: «que
 * sean lo más claros posible y se respeten todos los pasos»). Se agrega al final
 * de cada descripción. Los pasos que ya lo dicen adentro no están acá.
 */
const HECHO: Record<string, { quien: string; hecho: string }> = {
  "Página de Facebook vinculada al Instagram": { quien: "Paid media. La project manager lo sigue y apura.", hecho: "en la página de Facebook → Configuración → Cuentas vinculadas figura el Instagram." },
  "Asignar el equipo de la cuenta": { quien: "La project manager.", hecho: "en la ficha figuran CM, diseño, edición y media buyer, y las tareas del arranque quedaron reasignadas a cada uno." },
  "Reunión de diagnóstico": { quien: "La CM, con la project manager.", hecho: "la reunión está registrada en la ficha con lo que contó el cliente y ya mandó el material que tenía." },
  "Subir el logo de la cuenta a su ficha": { quien: "La project manager.", hecho: "el logo se ve en la ficha. Se marca sola al subirlo." },
  "Mandarle al cliente el link de su plataforma": { quien: "La project manager.", hecho: "en la ficha figura que el cliente abrió su link al menos una vez." },
  "Kit de marca": { quien: "Diseño. Lo revisa el director creativo el día 4.", hecho: "los 6 elementos están en el Drive de la cuenta y el cliente los aprobó por escrito." },
  "Lista del contenido crudo que necesitamos": { quien: "La CM.", hecho: "la lista se le mandó al cliente y está pegada en esta tarea." },
  "Calendario de contenidos para aprobar": { quien: "La CM. Lo revisa el director creativo.", hecho: "el calendario está cargado en Contenidos, pieza por pieza, aprobado por el director creativo y por el cliente." },
  "Día 7: ¿llegó el material?": { quien: "La project manager.", hecho: "el material está en el Drive de la cuenta, o hay jornada de producción con fecha." },
  "¿Hace falta jornada de producción?": { quien: "La project manager, con edición.", hecho: "quedó escrito en esta tarea «sí, el día X en Y» o «no hace falta»." },
  "Contenido crudo ordenado en carpetas": { quien: "La CM.", hecho: "el material está en carpetas por tipo en el Drive de la cuenta, con el link en esta tarea." },
  "Optimizar el perfil: bio, accesos y destacadas": { quien: "La CM.", hecho: "la bio, la foto, el link y las destacadas ya se ven en el Instagram (dejá una captura en esta tarea)." },
  "Plantillas de Canva para el cliente": { quien: "Diseño.", hecho: "el link de las plantillas está en la ficha y el cliente lo ve en su plataforma." },
  "Piezas gráficas de los 15 días": { quien: "Diseño.", hecho: "cada posteo del calendario tiene su archivo final cargado." },
  "Videos de los 15 días": { quien: "Edición.", hecho: "cada reel del calendario tiene su archivo final cargado." },
  "Aprobación del cliente y programación": { quien: "La CM.", hecho: "todas las piezas de los 15 días están aprobadas por el cliente y programadas: el día 15 sale la primera." },
  "Entrega del arranque al cliente": { quien: "La project manager, con el director creativo.", hecho: "la reunión está hecha y registrada, y quedó agendada la primera reunión mensual." },
  "Objetivos y presupuesto acordados": { quien: "Paid media.", hecho: "el objetivo, el presupuesto mensual y cómo se mide están anotados en el onboarding de publicidad (Campañas clave)." },
  "Primera campaña al aire": { quien: "Paid media.", hecho: "la campaña está activa y en Paid Media ya se ve el gasto del día." },
  "Relevamiento del sitio": { quien: "Desarrollo web.", hecho: "el relevamiento está en el Drive de la cuenta y el cliente lo aprobó." },
  // Pack Marca Real
  "Asignar quién diseña la marca": { quien: "La project manager.", hecho: "el diseñador figura en la ficha y las tareas de abajo están a su nombre." },
  "Mandar el brief de marca": { quien: "La project manager.", hecho: "el cliente recibió las 10 preguntas (pegá acá el mensaje que le mandaste)." },
  "Brief recibido y material ordenado": { quien: "La project manager.", hecho: "el brief completo, el logo actual y las referencias están en el Drive de la cuenta." },
  "Logo final, paleta y tipografías": { quien: "Diseño.", hecho: "el cliente aprobó por escrito la versión final y los archivos están en el Drive." },
  "Plantillas y perfil de Instagram": { quien: "Diseño.", hecho: "las plantillas están en Canva con el link en la ficha, y el perfil ya se ve cambiado en Instagram." },
  "Plantilla de calendario y manual de 30 ideas": { quien: "La CM.", hecho: "la plantilla y el manual están en el Drive de la cuenta." },
  "Entrega final": { quien: "La project manager.", hecho: "el cliente recibió los archivos, las plantillas y el manual, y confirmó que le llegaron." },
  "Definir el flujo del bot": { quien: "Botly.", hecho: "el flujo está armado y el cliente lo aprobó." },
};

const HECHO_PROPUESTAS = { quien: "Diseño.", hecho: "el cliente recibió las propuestas y eligió una por escrito." };

/** Le suma a la descripción quién lo hace y cuándo está hecho, si no lo dice ya. */
function conHecho(titulo: string, descripcion: string): string {
  const h = HECHO[titulo] ?? (/propuestas de logo$/.test(titulo) ? HECHO_PROPUESTAS : undefined);
  return h && !/Cómo saber que está hecho|Está hecho cuando/.test(descripcion)
    ? `${descripcion}\n\n**Quién lo hace:** ${h.quien}\n**Está hecho cuando:** ${h.hecho}`
    : descripcion;
}

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
  ) => pasos.push({ dia, titulo, descripcion: conHecho(titulo, descripcion), area, asignado_a_id });

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
    `Primera reunión con ${nombreCliente}. Presentar al equipo, entender el negocio y qué espera de estos 15 días, y pedirle que ese mismo día comparta todo el contenido que ya tenga (fotos, videos, logos). De acá sale todo lo demás.`,
    "Coordinación",
    cm
  );

  // El carrusel de marcas de jdmedia.com.ar se arma solo con los clientes
  // activos: el logo es lo único que hay que cargar a mano (13/10/2026).
  // Lo carga la PM (pedido del dueño, 18/10/2026) y se cierra sola al subirlo.
  add(
    2,
    "Subir el logo de la cuenta a su ficha",
    `En la ficha de ${nombreCliente}, tocá el cuadrado de «Logo» al lado del nombre y subí su logo (mejor PNG con fondo transparente). Con eso aparece solo en el carrusel de marcas de jdmedia.com.ar, y esta tarea se marca hecha sola.`,
    "Coordinación",
    equipo.fallback
  );

  // El portal es donde el cliente ve y aprueba todo: si no tiene el link, el
  // calendario se aprueba por WhatsApp y la plataforma no le sirve de nada.
  // Es parte del proceso de la PM (pedido del dueño, 13/10/2026).
  add(
    3,
    "Mandarle al cliente el link de su plataforma",
    `En la ficha de ${nombreCliente}, recuadro «Link para el cliente»: generalo si no está, copialo y mandáselo por WhatsApp. Mensaje sugerido:\n\n«¡Hola! Te paso tu plataforma de JD Media: ahí vas a ver tu calendario del mes, aprobar o pedir cambios en cada pieza y seguir todo lo que hacemos. Guardalo, es tu acceso de siempre (no necesita usuario ni contraseña).»\n\nEn la misma ficha vas a ver cuándo lo abrió por última vez: si en unos días sigue sin abrirlo, recordáselo en la llamada.`,
    "Coordinación",
    equipo.fallback
  );

  // Vincular el Instagram y el Facebook a la plataforma (19/10/2026, pedido
  // del dueño): sin esto no hay datos reales para el cliente ni el reporte, y
  // 12 cuentas estuvieron meses «conectadas» sin traer un dato. Va el día 2, a
  // paid media, para toda cuenta con redes o pauta. Se cierra sola cuando la
  // plataforma trae los datos; mientras tanto avisa todos los días.
  if (svc.has("gestion_redes") || svc.has("paid_media")) {
    // Parte 1, a cargo de paid media: crear la página si falta y vincularla al
    // Instagram; la PM lo sigue y apura (decisión del dueño, 19/10/2026).
    add(
      2,
      "Página de Facebook vinculada al Instagram",
      `**A cargo de paid media.** La project manager lo sigue y apura hasta que esté. Paso a paso:

1. **¿Tiene página de Facebook?** Si no tiene, creala con el nombre y el logo de ${nombreCliente}.
2. **Vinculala al Instagram:** página de Facebook → **Configuración** → **Cuentas vinculadas** → **Instagram** → **Conectar cuenta** (con el usuario y la contraseña del Instagram de la ficha → Credenciales, o pedíselos a la PM).
3. **Chequeá** que figure en Cuentas vinculadas y seguí con el paso de compartir y conectar.

Sin esto no se puede compartir con JD Media y la plataforma no mide nada.`,
      "Paid Media",
      mb
    );
    add(
      3,
      "Compartir con JD Media y conectar el Instagram a la plataforma",
      `**A cargo de paid media**, apenas la PM confirma que la página está vinculada. Que la plataforma lea el Instagram de ${nombreCliente} desde el primer día:

1. **El cliente comparte con JD Media:** desde su Business → Configuración → **Socios** → Agregar socio → ID de JD Media **570336019465694** → acceso total a la página y al Instagram (si no sabe, se hace con él en una llamada de 10 minutos).
2. **Asignar al usuario del sistema:** en el Business de JD Media → Configuración → **Usuarios del sistema** → «jdmedia» → **···** → **Asignar activos**: su **Página de Facebook** y su **Cuenta de Instagram**, con todos los permisos.
3. **En la plataforma:** Clientes → **Conectar Instagram** → elegir la cuenta de la lista → Conectar (nunca un número a mano).

**Cómo saber que está hecho:** en Resultados del cliente aparecen los seguidores. Este paso se controla con datos reales: hasta que lleguen, la plataforma se lo recuerda todos los días a paid media, a la PM y a dirección.`,
      "Paid Media",
      mb
    );
  }

  if (svc.has("gestion_redes")) {
    // El kit de marca (decisión del dueño con Luz, 17/10/2026): lo básico para
    // trabajar, entregado el día 3 con las portadas y las plantillas. El manual
    // completo (papelería, merchandising) es el Pack Marca Real. Va con área
    // Diseño para que pase por la aprobación del director creativo (día 4).
    add(
      3,
      "Kit de marca",
      `El kit es la base con la que trabaja todo el equipo de ${nombreCliente}, y la regla contra la que se revisa cada pieza. Se entrega el día 3, completo:

1. **Logo y sus variaciones** (color, blanco, negro), con área de resguardo y usos incorrectos.
2. **Paleta de colores** con sus códigos.
3. **Tipografías** con sus variaciones y para qué se usa cada una.
4. **Tono de voz** en una página: formal o coloquial, cómo le hablamos al cliente, palabras que sí y que no, y 3 ejemplos de copy.
5. **Portadas de las historias destacadas** que planteó la community en el primer calendario.
6. **Plantillas de historias** en Canva.

Lo aprueba el director creativo el día 4 y el cliente el día 5. Se manda **una sola versión completa**. El manual de marca completo, con papelería y merchandising, no va acá: es el Pack Marca Real.`,
      "Diseño",
      dis
    );
    // Las dudas sobre el cliente (precios, público, diferencial, qué no mostrar,
    // promociones) se preguntan en la reunión de diagnóstico: están en su guía
    // (lib/diagnostics/meet-guide-prompt). Lo puntual, por el grupo de WhatsApp.
    add(
      3,
      "Lista del contenido crudo que necesitamos",
      `Armar la lista, punto por punto, de TODO el material que hay que pedirle a ${nombreCliente}: fotos, videos, logos, productos, personas. Cuanto más específica, menos idas y vueltas. Se le manda apenas esté.`,
      "Community Manager",
      cm
    );
    add(
      3,
      "Calendario de contenidos para aprobar",
      `El primer calendario (desde el día 15 hasta el fin de esa quincena), con la propuesta de biografía y las historias destacadas planteadas, con copys, formatos y referencias. **Cada pieza con su porqué**: qué rol cumple (que nos conozcan, que interactúen, que consulten o que compren) y qué esperamos medir (alcance, interacciones, consultas). En el lanzamiento, al menos 1 de cada 3 piezas tiene que ser promocional: una oferta, un beneficio por referir, un evento. Lo revisa el director creativo y lo aprueba ${nombreCliente} antes de que nadie produzca nada. Se manda completo, una sola vez.`,
      "Community Manager",
      cm
    );
    add(
      7,
      "Día 7: ¿llegó el material?",
      "Hito de control. El cliente tiene 2 días desde que aprueba el calendario para mandar el material. Si al día 7 no llegó, el arranque ya se está atrasando: hay que reclamarlo o resolverlo con una jornada de producción.",
      "Coordinación",
      cm
    );
    add(
      6,
      "¿Hace falta jornada de producción?",
      `Definir con ${nombreCliente} si se hace jornada. Si sí: fecha, locación, lista de tomas y briefing. Si no, queda cerrado y no se vuelve a preguntar.`,
      // Coordinación y no Edición: es una decisión, no una pieza. Con el área de
      // edición caía en la aprobación de la dirección creativa (12/10/2026).
      "Coordinación",
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
      "A más tardar 2 días después de que el cliente aprueba el calendario: biografía aprobada, foto, links, accesos y las destacadas con las portadas del kit de marca.",
      "Community Manager",
      cm
    );
    // Muchos clientes piden las plantillas para sumar contenido por su cuenta
    // (pedido del dueño, 15/10/2026). Se comparte el enlace «Usar como
    // plantilla»: el cliente se lleva una copia y el original queda intacto.
    add(
      5,
      "Plantillas de Canva para el cliente",
      `Con el kit de marca aprobado, compartí en Canva las plantillas de ${nombreCliente} (historias, posteo y portada de reel, con sus colores y tipografías). En Canva: Compartir → Más → «Enlace de plantilla», y pegá ese link en la ficha de la cuenta, recuadro «Plantillas de Canva». El cliente las ve solas en su plataforma.`,
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
      `Mostrarle todo a ${nombreCliente} junto, en una sola entrega; aplicar todos los cambios que pida de una vez y recién ahí mandar la versión siguiente (nada de partes sueltas). Dejar las piezas programadas: el día 15 tiene que estar publicando.`,
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
      `Reunión corta (20-30 minutos) con ${nombreCliente} para entregarle lo que se hizo en estas dos semanas: el diagnóstico, el manual de marca, sus plantillas de Canva, el perfil optimizado con sus destacadas y el calendario aprobado. Contarle qué va a salir el resto del mes y agendar la primera reunión mensual. Participa el director creativo de la cuenta.`,
      "Coordinación",
      equipo.fallback
    );
  }

  if (svc.has("paid_media")) {
    add(
      3,
      "Cuenta publicitaria, píxel y medio de pago",
      `Seguí el onboarding de publicidad de ${nombreCliente} (pestaña «Publicidad» del arranque), paso por paso:

1. Acceso como **socio** al Business del cliente, con administración total.
2. **Cuenta publicitaria** (act_…) cargada en la plataforma y asignada al usuario del sistema «jdmedia» con «Administrar campañas».
3. **Píxel y conversiones** midiendo de verdad: hacé una prueba (una consulta o compra) y fijate que aparezca en el Administrador de eventos.
4. **Medio de pago**: Dólar App descargada y la tarjeta vinculada a la cuenta publicitaria.

**Cómo saber que está hecho:** en Paid Media la cuenta muestra gasto y resultados del día. Sin esto la campaña corre a ciegas.`,
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

Al día 15 el cliente tiene que estar publicando, con el perfil optimizado y el calendario aprobado por él.

**Cómo se entrega** (pedido de un cliente, 17/10/2026): cada entregable se manda completo, una sola vez, revisado por el director creativo, y se espera la devolución del cliente antes de mandar la versión siguiente. Ante la duda, se le pregunta: el cliente prefiere una consulta a una entrega que no sirve.`,
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
    pasos.push({ dia, titulo, descripcion: conHecho(titulo, descripcion), area, asignado_a_id });

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
