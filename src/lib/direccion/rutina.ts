/**
 * La rutina de la dirección: lo que el dueño tiene que hacer siempre, generado
 * solo como tareas.
 *
 * Pedido del dueño (12/10/2026): "siento que está todo muy desorganizado, tengo
 * muchas cosas en la cabeza y me mareo; necesito saber a qué sección acudir y
 * cuál es mi proceso de trabajo". Su rol es coordinar a los coordinadores, y
 * hay partes (recursos humanos, sobre todo) que no está ejerciendo porque nadie
 * se las recuerda.
 *
 * Mismo mecanismo que `tareas/rutinas-mensuales`: tareas comunes con
 * `rutina_key` única (correr el cron dos veces no duplica). Las claves empiezan
 * con `dir:` y así la página de Dirección las separa del resto.
 *
 * Puro: entra el día y el dueño, salen las tareas de la semana, el mes y el
 * trimestre en curso.
 */
import type { TareaRutina } from "@/lib/tareas/rutinas-mensuales";

export const PREFIJO_RUTINA_DIRECCION = "dir:";
export const AREA_DIRECCION = "Estrategia/Dirección";

export type Cadencia = "semana" | "mes" | "trimestre" | "una_vez";

/** La cadencia de una tarea de rutina, leída de su clave. */
export function cadenciaDe(rutinaKey: string): Cadencia | null {
  if (!rutinaKey.startsWith(PREFIJO_RUTINA_DIRECCION)) return null;
  const periodo = rutinaKey.split(":")[1] ?? "";
  if (periodo === "puesta") return "una_vez";
  if (/^\d{4}-T[1-4]$/.test(periodo)) return "trimestre";
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodo)) return "semana";
  if (/^\d{4}-\d{2}$/.test(periodo)) return "mes";
  return null;
}

/** El lunes de la semana de `ymd`. */
export function lunesDe(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function sumar(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diaDelMes(periodo: string, dia: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${periodo}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function rutinasDeDireccion(hoy: string, duenoId: string | null): TareaRutina[] {
  if (!duenoId) return [];
  const periodo = hoy.slice(0, 7);
  const mes = MESES[Number(hoy.slice(5, 7)) - 1];
  const lunes = lunesDe(hoy);
  const tarea = (rutina_key: string, titulo: string, descripcion: string, fecha_limite: string, prioridad = "media"): TareaRutina => ({
    rutina_key,
    titulo,
    descripcion,
    area: AREA_DIRECCION,
    prioridad,
    asignado_a_id: duenoId,
    cliente_id: null,
    fecha_limite,
  });

  const out: TareaRutina[] = [
    // ---- Todas las semanas ----
    tarea(
      `dir:${lunes}:ronda`,
      `Ronda con los coordinadores · semana del ${lunes.slice(8, 10)}/${lunes.slice(5, 7)}`,
      "15 minutos con cada coordinador, con su tarjeta de **Dirección** abierta:\n\n1. Lo que está en rojo: ¿qué lo traba? ¿qué necesita de vos?\n2. Lo que le pediste la semana pasada: ¿se hizo?\n3. Dejale 1 a 3 pedidos con **«Pedirle algo»** (con fecha). Lo que no queda escrito, no se sigue.",
      sumar(lunes, 1),
      "alta"
    ),

    // ---- Todos los meses ----
    tarea(
      `dir:${periodo}:revisar-mes`,
      `Revisar cómo cerró el mes anterior`,
      "- ¿Entraron todos los cobros? (**Cobros**)\n- Resultado y margen en tu planilla: ¿vamos al 35%?\n- ¿Se cumplieron los objetivos del equipo? (**Métricas → Objetivos del equipo**)\n- ¿Hubo bajas o avisos de baja? ¿Por qué?",
      diaDelMes(periodo, 10)
    ),
    tarea(
      `dir:${periodo}:rrhh`,
      `Recursos humanos de ${mes}`,
      "- **Ingresos**: ¿entró alguien? Acuerdo de rol firmado, accesos dados, presentado al equipo.\n- **Salidas**: ¿se fue alguien? Quitarle accesos (app, Drive, Meta, Canva) y reasignar sus cuentas.\n- **Carga**: en **Tareas → Calendario**, ¿quién está tapado y quién tiene aire?\n- **Ausencias**: vacaciones o licencias del mes que viene, y quién cubre a quién.\n- **Reconocimiento**: ¿a quién le tocó destacar este mes? Decíselo.",
      diaDelMes(periodo, 15)
    ),
    tarea(
      `dir:${periodo}:objetivos`,
      `Fijar los objetivos del mes que viene`,
      "Con cada coordinador, en **Métricas → Objetivos del equipo**: una meta clara y medible por persona para el mes que empieza. Que la sepan antes del día 1.",
      diaDelMes(periodo, 28)
    ),
  ];

  // ---- Cada trimestre (enero, abril, julio, octubre) ----
  const m = Number(hoy.slice(5, 7));
  if ([1, 4, 7, 10].includes(m)) {
    const t = `${hoy.slice(0, 4)}-T${Math.ceil(m / 3)}`;
    out.push(
      tarea(
        `dir:${t}:evaluacion`,
        `Evaluación de los coordinadores (trimestre)`,
        "Una charla de 30 minutos con cada coordinador: qué salió bien, qué hay que mejorar y un objetivo para el trimestre. Que cada coordinador haga lo mismo con su equipo y te pase un resumen.",
        diaDelMes(periodo, 20)
      ),
      tarea(
        `dir:${t}:clima`,
        `Encuesta de clima del equipo (anónima)`,
        "3 preguntas, anónimas: ¿cómo te sentís trabajando acá (1 a 5)? ¿qué cambiarías? ¿qué te falta para hacer mejor tu trabajo? Lo que se repite es lo que hay que resolver.",
        diaDelMes(periodo, 20)
      ),
      tarea(
        `dir:${t}:sueldos`,
        `Revisar sueldos y tarifas (trimestre)`,
        "Con la inflación del trimestre: ¿hay que ajustar lo que se le paga al equipo? ¿Y los precios de los packs? Mirá el costeo (**Coordinación → Cotizador**) para no achicar el margen.",
        diaDelMes(periodo, 25)
      )
    );
  }
  return out;
}

/**
 * Lo de recursos humanos que nunca se armó y hay que dejar en orden una vez
 * (12/10/2026). Fechas repartidas para no tirar todo junto.
 */
export function puestaAPunto(duenoId: string | null): TareaRutina[] {
  if (!duenoId) return [];
  const t = (slug: string, titulo: string, descripcion: string, fecha: string): TareaRutina => ({
    rutina_key: `dir:puesta:${slug}`,
    titulo,
    descripcion,
    area: AREA_DIRECCION,
    prioridad: "media",
    asignado_a_id: duenoId,
    cliente_id: null,
    fecha_limite: fecha,
  });
  return [
    t(
      "acuerdos",
      "Acuerdo de rol de cada integrante del equipo",
      "Que cada persona tenga por escrito qué hace, qué no y a quién responde (ya están los de Santi, Luz, Brisa y Leo). Revisá quién falta y armalos.",
      "2026-10-20"
    ),
    t(
      "reemplazos",
      "Quién cubre a quién en cada puesto",
      "Para cada puesto, un reemplazo si se enferma o se va de vacaciones (ya está: Luz cubre a Santi en la aprobación del calendario). Sin esto, una ausencia frena cuentas enteras.",
      "2026-10-27"
    ),
    t(
      "vacaciones",
      "Plan de vacaciones de diciembre y enero",
      "Quién se toma qué días y quién cubre sus cuentas. Hay que tenerlo antes de mediados de noviembre, cuando los clientes empiezan a pedir lo de las fiestas.",
      "2026-11-10"
    ),
    t(
      "bajas",
      "Lista de lo que hay que hacer cuando alguien se va",
      "Accesos a quitar (app, Drive, Meta, Canva, WhatsApp, mails), a quién se le pasan sus cuentas y qué se le avisa al cliente. Escrito una vez, se sigue siempre igual.",
      "2026-11-03"
    ),
    t(
      "aumentos",
      "Criterio claro de aumentos y bonos",
      "Cuándo y cómo se ajustan los pagos (inflación, desempeño, antigüedad) y qué tiene que pasar para un bono. Que el equipo lo conozca: evita charlas incómodas y que se vaya gente por no saber.",
      "2026-11-17"
    ),
  ];
}

/**
 * La reunión semanal con la PM (pedido del dueño, 13/10/2026): "una vez a la
 * semana una reunión con Luz cargada en la plataforma, para analizar cómo
 * venimos con las cuentas y que me muestre cómo viene con sus tareas".
 *
 * Martes de 10:00 a 10:45 (Córdoba), el mismo día que vence la ronda con los
 * coordinadores. Se agenda la del martes de esta semana o, si ya llegó, la del
 * que viene. Puro: el ejecutor la crea solo si no existe.
 */
export const TITULO_REUNION_PM = "Semanal con la dirección: cuentas y tareas";

export function reunionSemanalPm(hoy: string): { fecha: string; startsAt: string; endsAt: string; descripcion: string } {
  let martes = sumar(lunesDe(hoy), 1);
  if (martes <= hoy) martes = sumar(martes, 7);
  return {
    fecha: martes,
    // Córdoba es UTC-3 todo el año.
    startsAt: `${martes}T13:00:00.000Z`,
    endsAt: `${martes}T13:45:00.000Z`,
    descripcion: [
      "45 minutos, con la plataforma abierta. Se agenda sola todas las semanas.",
      "",
      "1. **Cuentas nuevas** (Clientes → Cuentas nuevas): las que están en rojo, qué las traba y quién lo destraba.",
      "2. **Sus tareas** (Dirección → su tarjeta): las vencidas y las de esta semana.",
      "3. **Clientes**: a quién hay que mandarle el link de su plataforma, la encuesta o la reunión mensual.",
      "4. **Pedidos**: lo que le dejás para la semana, cargado con «Pedirle algo» y con fecha.",
    ].join("\n"),
  };
}
