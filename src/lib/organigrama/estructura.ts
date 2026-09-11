/**
 * El organigrama de JD Media después de la reestructura del 10/9/2026.
 *
 * Por qué existe este archivo y no una tabla en la base: la estructura de la
 * agencia cambia cada varios meses, pero las PERSONAS cambian todo el tiempo.
 * Así que acá vive la forma (qué puestos hay, de quién cuelga cada uno y de qué
 * responde) y las personas se resuelven en vivo por `users.area`. Mover a
 * alguien de puesto es cambiarle el área en Accesos, no tocar código.
 *
 * La regla que ordena todo, y que es el motivo de la reestructura:
 * **quien coordina no ejecuta**, y **cada resultado tiene un dueño con nombre**.
 * El diagnóstico decía que se fueron 24 de 39 clientes porque nadie respondía
 * por el resultado de una cuenta.
 *
 * Todo lo que hay acá es puro: se puede probar sin base.
 */

/** Un link a la pantalla donde ese pedazo del rol se hace de verdad. */
export interface TareaDelRol {
  label: string;
  href: string;
  /** Qué se hace ahí. Una línea, en criollo. */
  detalle: string;
}

export interface NodoOrg {
  /** Identificador estable: se usa en la URL (?puesto=) y para las métricas. */
  id: string;
  titulo: string;
  /**
   * Área de `users.area` con la que se resuelve quién ocupa el puesto.
   * Si una persona tiene `area_secundaria`, también figura ahí.
   */
  area: string;
  /** El resultado del que responde. Si no hay uno claro, el puesto sobra. */
  respondePor: string;
  /** Cómo se trabaja el puesto. Va en el panel de detalle. */
  resumen: string;
  tareas: TareaDelRol[];
  /** Aclaraciones que se decidieron el 10/9 y conviene no perder. */
  notas?: string[];
  /** Marca los puestos que NO cuelgan de operaciones (van en paralelo). */
  paralelo?: boolean;
  /**
   * Se dibuja aparte del árbol, en su propia fila.
   *
   * Son servicios con su propio cliente y su propia entrega: meterlos en el
   * árbol lo estiraba 400px de más y obligaba a scrollear para ver el resto,
   * que es lo que de verdad importa mirar.
   */
  aparte?: boolean;
  hijos?: NodoOrg[];
}

export const ORGANIGRAMA: NodoOrg = {
  id: "direccion",
  titulo: "Dirección General",
  area: "Estrategia/Dirección",
  respondePor: "Que la agencia crezca y sea rentable.",
  resumen:
    "Decide el rumbo, banca las decisiones difíciles y sostiene la relación con los clientes grandes. No debería estar en la operación del día a día.",
  tareas: [
    { label: "Panorama financiero", href: "/finanzas/panorama", detalle: "Cuánto entra y cuánto sale este mes." },
    { label: "Objetivos", href: "/objetivos", detalle: "Las metas del año y cómo vienen." },
    { label: "Cerrar el mes", href: "/finanzas/cierre", detalle: "Dar por cerrado el mes y pagar." },
    { label: "Riesgo de cuentas", href: "/coordinacion/riesgo", detalle: "Qué clientes están por irse." },
    { label: "Sueldos", href: "/coordinacion/sueldos", detalle: "Lo que cobra cada uno según lo que produjo." },
  ],
  hijos: [
    {
      id: "coordinacion-general",
      titulo: "Coordinación General",
      area: "Coordinación General",
      respondePor: "Que el plan de crecimiento avance, no solo el día a día.",
      resumen:
        "Mano derecha de la dirección. Mira el mediano plazo: los procesos, la máquina de clientes y que las coordinaciones no se pisen entre sí.",
      tareas: [
        { label: "Máquina de clientes", href: "/objetivos/maquina", detalle: "El embudo: cuántos contactos hacen falta para un cliente." },
        { label: "Procesos", href: "/procesos", detalle: "El manual de cómo se hace cada cosa." },
        { label: "Director IA", href: "/director", detalle: "El tablero que marca qué está flojo." },
      ],
    },
    {
      id: "operaciones",
      titulo: "Operaciones y entregas",
      area: "Coordinación",
      respondePor: "Que nada llegue tarde. Ni una pieza.",
      resumen:
        "Dueña del calendario de todas las cuentas activas. Ve la carga de cada persona y reasigna cuando alguien se satura. Da la reunión semanal de entregas y la reunión mensual con el cliente.",
      notas: [
        "Quien coordina no ejecuta: el puesto se rompe si además produce contenido.",
        "La reunión mensual con el cliente la da este puesto, con Paid Media presente cuando hay pauta que mostrar y Estrategia presente para escuchar qué busca el cliente.",
      ],
      tareas: [
        { label: "Contenidos", href: "/contenidos", detalle: "El calendario de todas las cuentas, pieza por pieza." },
        { label: "Tareas del equipo", href: "/tareas", detalle: "Qué tiene cada uno y qué está vencido." },
        { label: "Carga del equipo", href: "/equipo/capacity", detalle: "Quién está saturado y quién tiene lugar." },
        { label: "Jornadas de producción", href: "/coordinacion/jornadas", detalle: "Coordinar las sesiones de fotos y video." },
        { label: "¿Salió de verdad?", href: "/contenidos/salio", detalle: "Contrastar el calendario contra lo que realmente se publicó." },
        { label: "Mes 1", href: "/coordinacion/mes-uno", detalle: "El arranque de las cuentas nuevas." },
        { label: "Cobros", href: "/cobros", detalle: "Que el cobro del 25 al 1º no se pase." },
      ],
      hijos: [
        {
          id: "community",
          titulo: "Community Management",
          area: "Community Manager",
          respondePor: "La cuenta día a día: el copy, el contacto con el cliente y que la idea sea hacible.",
          resumen:
            "Escribe los guiones y arma el pedido para diseño y edición. Es quien después le muestra la pieza al cliente, así que también es quien la revisa cuando vuelve de producción.",
          notas: [
            "La idea se piensa MIRANDO el material que hay, no al revés. Si hace falta una foto que no existe, se pide antes de idear.",
            "Qué va en la imagen y qué va en el copy se decide en la redacción, no lo resuelve diseño.",
          ],
          tareas: [
            { label: "Mis tareas", href: "/tareas", detalle: "Lo que tengo asignado y para cuándo." },
            { label: "Guiones del mes", href: "/contenidos/guiones", detalle: "Escribir los guiones de cada pieza." },
            { label: "Contenidos", href: "/contenidos", detalle: "El calendario de mis cuentas." },
          ],
        },
        {
          id: "diseno",
          titulo: "Diseño gráfico",
          area: "Diseño",
          respondePor: "Que la pieza gráfica salga a tiempo y con la identidad de la cuenta.",
          resumen:
            "Recibe el guión con el material ya definido y arma la pieza. No debería tener que salir a buscar fotos ni decidir qué texto entra.",
          tareas: [
            { label: "Mis tareas", href: "/tareas", detalle: "Lo que tengo asignado y para cuándo." },
            { label: "Contenidos", href: "/contenidos", detalle: "Ver la pieza completa, con su guión y su material." },
          ],
        },
        {
          id: "edicion",
          titulo: "Edición audiovisual",
          area: "Edición Audiovisual",
          respondePor: "Que el video salga a tiempo y con el material que hay.",
          resumen:
            "Edita reels y videos a partir del guión y el crudo de la jornada de producción.",
          tareas: [
            { label: "Mis tareas", href: "/tareas", detalle: "Lo que tengo asignado y para cuándo." },
            { label: "Contenidos", href: "/contenidos", detalle: "Ver la pieza completa, con su guión y su material." },
          ],
        },
      ],
    },
    {
      id: "estrategia",
      titulo: "Estrategia y calidad",
      area: "Coordinación de Diseño",
      respondePor: "Que lo que sale sea bueno y tenga una estrategia detrás.",
      resumen:
        "Arma el plan mensual de cada cuenta y da el visto bueno creativo: ninguna pieza pasa al cliente sin su ok. También lleva la identidad visual y el diagnóstico mensual.",
      notas: [
        "Prepara la reunión mensual con el cliente, pero la da Operaciones.",
        "El visto bueno es sobre la pieza, no sobre el gusto: una observación de estilo personal no es un motivo para frenar un trabajo.",
      ],
      tareas: [
        { label: "Calidad del mes", href: "/clientes/calidad", detalle: "La nota de calidad de cada cuenta." },
        { label: "Guiones del mes", href: "/contenidos/guiones", detalle: "Revisar los guiones antes de que se produzcan." },
        { label: "Contenidos", href: "/contenidos", detalle: "Las piezas esperando revisión creativa." },
        { label: "Clientes", href: "/clientes", detalle: "Entrar a cada cuenta: plan mensual, diagnóstico y onboarding de diseño." },
      ],
    },
    {
      id: "paid-media",
      titulo: "Paid Media",
      area: "Coordinación de Paid Media",
      paralelo: true,
      respondePor: "Que la pauta traiga resultados que se puedan mostrar.",
      resumen:
        "Área propia, en paralelo a Operaciones: no cuelga de ella. Operaciones le pide el servicio cuando una cuenta lo tiene contratado.",
      notas: [
        "Una campaña sin evento de conversión configurado no se puede defender en la reunión mensual: hay plata gastada y nada que mostrar.",
      ],
      tareas: [
        { label: "Paid Media", href: "/paid-media", detalle: "Todas las campañas, el gasto y los resultados." },
        { label: "Clientes", href: "/clientes", detalle: "Entrar a la cuenta para ver su pauta y el análisis." },
      ],
    },
    {
      id: "comercial",
      titulo: "Comercial",
      area: "Comercial",
      paralelo: true,
      respondePor: "Clientes nuevos entrando todos los meses.",
      resumen:
        "Prospecta, hace las reuniones, manda las propuestas y cierra. Deja la cuenta lista para que Operaciones arranque el Mes 1.",
      notas: [
        "En el cierre se define si la cuenta necesita jornada de producción. Si se vende sin eso, el contenido después no se puede hacer.",
      ],
      tareas: [
        { label: "Comercial", href: "/comercial", detalle: "El pipeline de lo que está por cerrarse." },
        { label: "Leads", href: "/comercial/leads", detalle: "Los interesados y en qué etapa están." },
        { label: "Prospección", href: "/prospeccion", detalle: "Las campañas de contactos en frío." },
        { label: "Propuestas", href: "/prospeccion/propuestas", detalle: "Armar y mandar la propuesta con precios." },
        { label: "Post-meet", href: "/comercial/post-meet", detalle: "Qué se habló en la reunión y qué sigue." },
      ],
    },
    {
      id: "botly",
      titulo: "Botly",
      area: "Botly",
      paralelo: true,
      aparte: true,
      respondePor: "El servicio de chatbots, punta a punta.",
      resumen: "Servicio propio, con su propio cliente y su propia entrega.",
      tareas: [{ label: "Servicios", href: "/agencia", detalle: "El catálogo y los precios de la agencia." }],
    },
    {
      id: "web",
      titulo: "Desarrollo Web",
      area: "Desarrollo Web",
      paralelo: true,
      aparte: true,
      respondePor: "Las webs que se venden, de la entrevista a la entrega.",
      resumen: "Área tercerizada con modelo 70/30: la tarifa al cliente es el doble de la del freelancer.",
      tareas: [{ label: "Servicios", href: "/agencia", detalle: "El catálogo y los precios de la agencia." }],
    },
  ],
};

/** Las decisiones que el user todavía no cerró. Se muestran debajo del árbol. */
export const DECISIONES_ABIERTAS: string[] = [
  "¿Hace falta una capa de líderes de cuenta (un dueño por cuenta, máximo 4 cada uno) o alcanza con que el CM sea el dueño?",
  "¿Operaciones suelta de verdad la ejecución? Hoy sigue haciendo CM, diseño y edición de algunas cuentas.",
  "Si existe el líder de cuenta, ¿cómo se paga ese rol?",
  "¿Los CM con una sola cuenta pueden tomar tres?",
];

export interface PersonaOrg {
  id: string;
  nombre: string;
  rol: string | null;
}

/** Carga real de una persona, para mostrarla arriba del nombre. */
export interface CargaPersona {
  abiertas: number;
  vencidas: number;
}

export interface NodoResuelto extends NodoOrg {
  gente: PersonaOrg[];
  hijos?: NodoResuelto[];
}

/**
 * Cuelga las personas de cada puesto.
 *
 * Una persona aparece UNA sola vez, en el puesto MÁS ALTO que le corresponde.
 * Por eso se reparte por niveles y no en profundidad: Brisa tiene "Diseño" como
 * área secundaria, pero su puesto es Estrategia y calidad, que está un nivel más
 * arriba. Si se recorriera el árbol en profundidad, Diseño (que cuelga de
 * Operaciones) se la llevaría primero y el organigrama mentiría sobre quién
 * ejecuta y quién coordina.
 */
export function resolverOrganigrama(
  nodo: NodoOrg,
  porArea: Map<string, PersonaOrg[]>
): NodoResuelto {
  const asignado = new Map<NodoOrg, PersonaOrg[]>();
  const ubicados = new Set<string>();

  let nivel: NodoOrg[] = [nodo];
  while (nivel.length > 0) {
    for (const n of nivel) {
      const gente = (porArea.get(n.area) ?? []).filter((p) => !ubicados.has(p.id));
      asignado.set(n, gente);
      for (const p of gente) ubicados.add(p.id);
    }
    nivel = nivel.flatMap((n) => n.hijos ?? []);
  }

  const armar = (n: NodoOrg): NodoResuelto => ({
    ...n,
    gente: asignado.get(n) ?? [],
    hijos: n.hijos?.map(armar),
  });
  return armar(nodo);
}

/** Agrupa a la gente por área, contando también el área secundaria. */
export function agruparPorArea(
  usuarios: Array<{ id: string; nombre: string; rol: string | null; area: string | null; area_secundaria: string | null }>
): Map<string, PersonaOrg[]> {
  const mapa = new Map<string, PersonaOrg[]>();
  const push = (area: string | null, p: PersonaOrg) => {
    if (!area) return;
    const lista = mapa.get(area) ?? [];
    if (!lista.some((x) => x.id === p.id)) lista.push(p);
    mapa.set(area, lista);
  };
  for (const u of usuarios) {
    const p = { id: u.id, nombre: u.nombre, rol: u.rol };
    push(u.area, p);
    push(u.area_secundaria, p);
  }
  return mapa;
}

const ESTADOS_CERRADOS = new Set(["completada", "archivada"]);

/**
 * Cuenta lo que cada uno tiene encima.
 *
 * Solo mira tareas de cuentas que siguen vivas: arrastrar las de un cliente
 * perdido hacía que alguien figurara con 50 pendientes que ya no existen.
 */
export function calcularCarga(
  tareas: Array<{ asignado_a_id: string | null; estado: string; fecha_limite: string | null; cliente_id: string | null }>,
  clientesVivos: Set<string>,
  hoy: string
): Map<string, CargaPersona> {
  const limite = hoy.slice(0, 10);
  const carga = new Map<string, CargaPersona>();
  for (const t of tareas) {
    if (!t.asignado_a_id) continue;
    if (ESTADOS_CERRADOS.has(t.estado)) continue;
    if (t.cliente_id && !clientesVivos.has(t.cliente_id)) continue;
    const actual = carga.get(t.asignado_a_id) ?? { abiertas: 0, vencidas: 0 };
    actual.abiertas += 1;
    if (t.fecha_limite && t.fecha_limite.slice(0, 10) < limite) actual.vencidas += 1;
    carga.set(t.asignado_a_id, actual);
  }
  return carga;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Recorre el árbol ya resuelto. Sirve para buscar un puesto por id. */
export function aplanar(nodo: NodoResuelto): NodoResuelto[] {
  return [nodo, ...(nodo.hijos ?? []).flatMap(aplanar)];
}
