/**
 * Cómo viene cada coordinador: el tablero de la dirección.
 *
 * Pedido del dueño (12/10/2026): su rol es "coordinar a los coordinadores" —
 * ver qué se traba, cómo avanza cada uno y darle seguimiento. Cada coordinador
 * tiene 3 o 4 números que miden SU trabajo, calculados solos, con semáforo. Y
 * los ve también la persona: que sepa cómo la está viendo la dirección.
 *
 * Puro a propósito: entran los números, sale la tarjeta. Los umbrales viven acá
 * y se prueban sin base.
 */

export type Semaforo = "ok" | "atento" | "mal";

export type Puesto = "pm" | "direccion_creativa" | "comercial" | "cuenta_jd";

export const PUESTO_LABEL: Record<Puesto, string> = {
  pm: "Project Manager",
  direccion_creativa: "Dirección creativa",
  comercial: "Comercial",
  cuenta_jd: "Cuenta de JD Media",
};

export interface Indicador {
  label: string;
  /** Lo que se muestra: "12", "34 de 120". */
  valor: string;
  /** Una línea que explica el número o qué se espera. */
  detalle: string;
  /** null = informativo, no pesa en el semáforo. */
  estado: Semaforo | null;
  href?: string;
}

export interface Tarjeta {
  personaId: string;
  nombre: string;
  puesto: Puesto;
  estado: Semaforo;
  indicadores: Indicador[];
}

const PESO: Record<Semaforo, number> = { ok: 0, atento: 1, mal: 2 };

/** El peor de los indicadores que cuentan. Sin ninguno, "ok". */
export function peorEstado(ind: Indicador[]): Semaforo {
  let peor: Semaforo = "ok";
  for (const i of ind) if (i.estado && PESO[i.estado] > PESO[peor]) peor = i.estado;
  return peor;
}

/** "0 ok, hasta `atento` amarillo, más rojo": la escala de casi todo. */
export function porTope(n: number, atento: number): Semaforo {
  if (n <= 0) return "ok";
  return n <= atento ? "atento" : "mal";
}

/** Proporción contra una meta: 100% o más ok, 60% o más amarillo. */
export function porMeta(hecho: number, meta: number): Semaforo | null {
  if (meta <= 0) return null;
  const r = hecho / meta;
  if (r >= 1) return "ok";
  return r >= 0.6 ? "atento" : "mal";
}

/** Lo común a todos: sus tareas vencidas y lo que le pidió la dirección. */
export interface Comunes {
  tareasVencidas: number;
  pedidosAbiertos: number;
  pedidosVencidos: number;
}

function comunes(c: Comunes): Indicador[] {
  return [
    {
      label: "Sus tareas vencidas",
      valor: String(c.tareasVencidas),
      detalle: c.tareasVencidas ? "Tareas suyas con la fecha pasada" : "Al día",
      estado: porTope(c.tareasVencidas, 3),
      href: "/tareas",
    },
    {
      label: "Lo que le pediste",
      valor: `${c.pedidosAbiertos}`,
      detalle: c.pedidosVencidos
        ? `${c.pedidosVencidos} ${c.pedidosVencidos === 1 ? "vencido" : "vencidos"}`
        : c.pedidosAbiertos
          ? "Todo en fecha"
          : "Nada pendiente",
      estado: porTope(c.pedidosVencidos, 1),
    },
  ];
}

function tarjeta(
  p: { id: string; nombre: string },
  puesto: Puesto,
  propios: Indicador[],
  c: Comunes
): Tarjeta {
  const indicadores = [...propios, ...comunes(c)];
  return { personaId: p.id, nombre: p.nombre, puesto, estado: peorEstado(indicadores), indicadores };
}

export function tarjetaPm(
  p: { id: string; nombre: string },
  d: { vencidasEquipo: number; sinRepartir: number; cuentasEnRiesgo: number; cuentasNuevas: number },
  c: Comunes
): Tarjeta {
  return tarjeta(
    p,
    "pm",
    [
      {
        label: "Tareas vencidas del equipo",
        valor: String(d.vencidasEquipo),
        detalle: "Lo que se le pasó de fecha a todo el equipo",
        estado: porTope(d.vencidasEquipo, 40),
        href: "/tareas/vencidas",
      },
      {
        label: "Pedidos sin repartir",
        valor: String(d.sinRepartir),
        detalle: "Hace más de 1 día que esperan que los asigne",
        estado: porTope(d.sinRepartir, 3),
        href: "/tareas",
      },
      {
        label: "Cuentas nuevas en riesgo",
        valor: `${d.cuentasEnRiesgo} de ${d.cuentasNuevas}`,
        detalle: "Cuentas en sus primeros 90 días con algo en rojo",
        estado: porTope(d.cuentasEnRiesgo, 2),
        href: "/onboarding",
      },
    ],
    c
  );
}

export function tarjetaDireccionCreativa(
  p: { id: string; nombre: string },
  d: { paraAprobar: number; fueraDeTiempo: number; ideasUrgentes: number },
  c: Comunes
): Tarjeta {
  return tarjeta(
    p,
    "direccion_creativa",
    [
      {
        label: "Piezas esperando su aprobación",
        valor: String(d.paraAprobar),
        detalle: d.fueraDeTiempo
          ? `${d.fueraDeTiempo} pasaron las 24 h hábiles`
          : "Todas dentro de las 24 h",
        estado: porTope(d.fueraDeTiempo, 3),
        href: "/tareas",
      },
      {
        label: "Ideas sin aprobar que salen pronto",
        valor: String(d.ideasUrgentes),
        detalle: "Se publican en 5 días o menos y siguen en idea",
        estado: porTope(d.ideasUrgentes, 5),
        href: "/contenidos",
      },
    ],
    c
  );
}

export function tarjetaComercial(
  p: { id: string; nombre: string },
  d: { hoy: number; semana: number; metaDiaria: number; diasHabilesSemana: number; reunionesMes: number },
  c: Comunes
): Tarjeta {
  const metaSemana = d.metaDiaria * d.diasHabilesSemana;
  return tarjeta(
    p,
    "comercial",
    [
      {
        label: "Mensajes esta semana",
        valor: `${d.semana} de ${metaSemana}`,
        detalle: `Meta: ${d.metaDiaria} por día hábil`,
        estado: porMeta(d.semana, metaSemana),
        href: "/prospeccion/actividad",
      },
      {
        label: "Mensajes hoy",
        valor: `${d.hoy} de ${d.metaDiaria}`,
        detalle: "Se completa a lo largo del día",
        estado: null,
        href: "/prospeccion/actividad",
      },
      {
        label: "Reuniones conseguidas en el mes",
        valor: String(d.reunionesMes),
        detalle: "Contactos que pasaron a reunión",
        estado: null,
        href: "/comercial/reuniones",
      },
    ],
    c
  );
}

export function tarjetaCuentaJd(
  p: { id: string; nombre: string },
  d: { publicadas: number; previstasAHoy: number; atrasadas: number; diaDelMes: number },
  c: Comunes
): Tarjeta {
  return tarjeta(
    p,
    "cuenta_jd",
    [
      {
        label: "Redes de JD Media este mes",
        valor: `${d.publicadas} de ${d.previstasAHoy}`,
        detalle:
          d.previstasAHoy || d.diaDelMes < 5
            ? "Publicadas contra lo que tenía que salir hasta hoy"
            : "No hay nada cargado en el calendario este mes",
        // Calendario vacío pasado el día 5 es lo peor que le puede pasar a la
        // cuenta propia (12/10/2026: nada cargado desde el 15/9).
        estado: d.previstasAHoy
          ? porMeta(d.publicadas, d.previstasAHoy * 0.8)
          : d.diaDelMes >= 5
            ? "mal"
            : null,
        href: "/contenidos",
      },
      {
        label: "Piezas atrasadas",
        valor: String(d.atrasadas),
        detalle: "Con la fecha pasada y sin publicar",
        estado: porTope(d.atrasadas, 2),
        href: "/contenidos",
      },
    ],
    c
  );
}

/** Días hábiles (lun-vie) de la semana de `hoy` que ya empezaron, hoy incluido. */
export function diasHabilesHastaHoy(hoy: string): number {
  const d = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 domingo
  if (d === 0 || d === 6) return 5;
  return d;
}

/** Orden del tablero: lo que está peor, arriba. */
export function ordenarTarjetas(t: Tarjeta[]): Tarjeta[] {
  return [...t].sort((a, b) => PESO[b.estado] - PESO[a.estado]);
}
