/**
 * Avisos de las piezas trabadas en "revisión creativa".
 *
 * El agujero que tapa: cuando diseño o edición termina, cierra SU tarea y la
 * pieza pasa a `revision_creativa`. Ahí no queda tarea abierta, así que el
 * aviso diario de vencidas —que mira `tasks`— deja de nombrarla y la pieza
 * desaparece del radar de todos. El 10/9/2026 había dos piezas de Ana Monjes
 * esperando revisión hacía 19 y 20 días sin que nadie supiera que existían.
 *
 * Quién revisa: el CM de la cuenta, que es el que después se la muestra al
 * cliente. Si la pieza lleva demasiado esperando, se le avisa TAMBIÉN a
 * coordinación y a los dueños: si el CM no la miró en tres días, avisarle una
 * cuarta vez no va a cambiar nada.
 *
 * Todo lo que decide vive acá y es puro, para poder probarlo sin base.
 */

/** A partir de acá deja de ser un recordatorio y pasa a ser un problema. */
export const DIAS_PARA_ESCALAR = 3;

export interface PiezaEnRevision {
  id: string;
  cliente_id: string;
  titulo: string | null;
  estado: string;
  /** Cuándo entró a revisión creativa. Null si la 0161 no corrió todavía. */
  revision_creativa_at?: string | null;
  /** Fallback: si no hay marca, se mide desde la fecha en que debía salir. */
  fecha_publicacion: string;
  frenado_cliente?: boolean | null;
}

export interface CuentaParaRevision {
  id: string;
  nombre: string;
  estado: string;
  cm_id: string | null;
  coordinador_id: string | null;
}

export interface AvisoRevision {
  userId: string;
  mensaje: string;
  link: string;
  /** true = es el aviso a coordinación/dueños, no el del CM. */
  escalado: boolean;
}

const DIA = 86_400_000;

/**
 * Días que la pieza lleva esperando que alguien la mire.
 *
 * Se compara por día calendario y no por horas: del 21/8 al 10/9 son 20 días,
 * sin importar si la pieza entró a revisión a las 9 o a las 18. Si no, un
 * mismo atraso daba 19 o 20 según la hora, y el aviso quedaba raro.
 */
export function diasEnRevision(p: PiezaEnRevision, hoy: string): number {
  const desde = (p.revision_creativa_at ?? p.fecha_publicacion).slice(0, 10);
  const d = Math.round((Date.parse(hoy.slice(0, 10)) - Date.parse(desde)) / DIA);
  return d > 0 ? d : 0;
}

/** Las que cuentan: en revisión creativa, de una cuenta viva, no frenadas. */
export function piezasTrabadas(
  piezas: PiezaEnRevision[],
  cuentas: CuentaParaRevision[]
): PiezaEnRevision[] {
  const activas = new Map(cuentas.filter((c) => c.estado === "activo").map((c) => [c.id, c]));
  return piezas.filter(
    (p) => p.estado === "revision_creativa" && !p.frenado_cliente && activas.has(p.cliente_id)
  );
}

/** Los títulos vienen del calendario y a veces son un párrafo entero. */
function titulo(p: PiezaEnRevision): string {
  const t = (p.titulo ?? "sin título").trim().replace(/\s+/g, " ");
  return `"${t.length > 48 ? `${t.slice(0, 46)}…` : t}"`;
}

function enumerar(piezas: PiezaEnRevision[]): string {
  const titulos = piezas.map(titulo);
  if (titulos.length === 1) return titulos[0];
  if (titulos.length === 2) return `${titulos[0]} y ${titulos[1]}`;
  return `${titulos.slice(0, 2).join(", ")} y ${titulos.length - 2} más`;
}

function hace(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

/**
 * Los avisos del día. Uno por persona y por cuenta: el CM ve las suyas, y si
 * alguna se pasó de `DIAS_PARA_ESCALAR`, coordinación y los dueños ven esa.
 */
export function avisosDeRevisionCreativa(
  piezas: PiezaEnRevision[],
  cuentas: CuentaParaRevision[],
  adminIds: string[],
  hoy: string
): AvisoRevision[] {
  const porCuenta = new Map<string, PiezaEnRevision[]>();
  for (const p of piezasTrabadas(piezas, cuentas)) {
    const arr = porCuenta.get(p.cliente_id);
    if (arr) arr.push(p);
    else porCuenta.set(p.cliente_id, [p]);
  }

  const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
  const avisos: AvisoRevision[] = [];

  for (const [clienteId, lista] of porCuenta) {
    const cuenta = cuentaPorId.get(clienteId);
    if (!cuenta) continue;

    lista.sort((a, b) => diasEnRevision(b, hoy) - diasEnRevision(a, hoy));
    const masVieja = diasEnRevision(lista[0], hoy);
    const link = `/contenidos?cliente=${clienteId}`;

    // Con una sola pieza se la nombra y listo; "la más vieja, hoy" para una
    // pieza que entró esta mañana se lee como un error.
    const cuerpo =
      lista.length === 1
        ? `${enumerar(lista)} está lista y espera tu visto bueno${masVieja ? ` ${hace(masVieja)}` : ""}.`
        : `${lista.length} piezas terminadas esperan tu visto bueno — ${enumerar(lista)}. La más vieja, ${hace(masVieja)}.`;

    // 1) El CM, que es quien la tiene que mirar. Si la cuenta no tiene CM
    //    cargado, el aviso va derecho a coordinación en vez de perderse.
    const revisor = cuenta.cm_id ?? cuenta.coordinador_id;
    if (revisor) {
      avisos.push({
        userId: revisor,
        link,
        escalado: false,
        mensaje: `🎨 ${cuenta.nombre}: ${cuerpo}`,
      });
    }

    // 2) Escalada: solo si de verdad se pasó, y sin avisarle dos veces a la
    //    misma persona (el coordinador puede ser el CM de esa cuenta).
    if (masVieja < DIAS_PARA_ESCALAR) continue;
    const yaAvisado = new Set(avisos.filter((a) => a.link === link).map((a) => a.userId));
    const mensaje = `⏳ ${cuenta.nombre}: ${enumerar(lista)} está lista y esperando revisión ${hace(masVieja)}. Nadie la movió.`;
    for (const uid of [cuenta.coordinador_id, ...adminIds]) {
      if (!uid || yaAvisado.has(uid)) continue;
      yaAvisado.add(uid);
      avisos.push({ userId: uid, link, escalado: true, mensaje });
    }
  }

  return avisos;
}
