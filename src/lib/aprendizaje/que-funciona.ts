/**
 * Qué funciona en cada cuenta (24/10/2026, pedido del dueño). Con las últimas
 * publicaciones del Instagram de la cuenta (las públicas: me gusta y
 * comentarios, formato, día y hora), la plataforma dice qué formato, qué día y
 * qué horario traen más interacción, y cuáles fueron las mejores piezas.
 *
 * Sirve para tres cosas: que la CM lo vea al armar el calendario, que JDmedIA
 * lo use al proponerlo, y que en la reunión mensual se le cuente al cliente.
 *
 * Reglas para no inventar patrones con poco dato: hacen falta 8 publicaciones
 * en total, 3 en cada grupo que se compara, y una diferencia de 1,3 veces o
 * más. Si no, se dice que todavía no hay un patrón claro.
 *
 * Módulo PURO. La hora se pasa a Argentina (UTC-3).
 */

export interface PostMedido {
  timestamp: string;
  likes: number | null;
  comentarios: number | null;
  tipo: string;
  producto: string | null;
  permalink: string | null;
  imagen: string | null;
}

export interface Grupo {
  nombre: string;
  n: number;
  promedio: number;
  /** Cuántas veces el promedio de la cuenta. */
  x: number;
}

export interface QueFunciona {
  posts: number;
  desde: string | null;
  promedio: number;
  formatos: Grupo[];
  dias: Grupo[];
  franjas: Grupo[];
  top: { permalink: string | null; imagen: string | null; interaccion: number; x: number; formato: string; fecha: string }[];
  frases: string[];
}

export const MIN_POSTS = 8;
export const MIN_GRUPO = 3;
export const MIN_X = 1.3;
const DIAS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const FRANJAS = [
  { nombre: "la mañana (6 a 12 h)", desde: 6, hasta: 12 },
  { nombre: "el mediodía (12 a 15 h)", desde: 12, hasta: 15 },
  { nombre: "la tarde (15 a 19 h)", desde: 15, hasta: 19 },
  { nombre: "la noche (19 a 24 h)", desde: 19, hasta: 24 },
  { nombre: "la madrugada (0 a 6 h)", desde: 0, hasta: 6 },
];

export function formatoDe(p: Pick<PostMedido, "tipo" | "producto">): string {
  if (p.producto === "REELS") return "Reels";
  if (p.tipo === "CAROUSEL_ALBUM") return "Carruseles";
  if (p.tipo === "VIDEO") return "Videos";
  return "Fotos";
}

/** Día (0-6) y hora (0-23) en Argentina. */
export function enArgentina(timestamp: string): { dia: number; hora: number; fecha: string } {
  const ms = Date.parse(timestamp.replace(/\+0000$/, "Z")) - 3 * 3_600_000;
  const d = new Date(ms);
  return { dia: d.getUTCDay(), hora: d.getUTCHours(), fecha: d.toISOString().slice(0, 10) };
}

/** «los reels», «las fotos». */
function conArticulo(formato: string, mayuscula = false): string {
  const a = formato === "Fotos" ? "las" : "los";
  return `${mayuscula ? a[0].toUpperCase() + a.slice(1) : a} ${formato.toLowerCase()}`;
}

const veces = (x: number) => (Math.round(x * 10) / 10).toLocaleString("es-AR");
const interaccion = (p: PostMedido) => (p.likes ?? 0) + (p.comentarios ?? 0);

function agrupar(posts: PostMedido[], clave: (p: PostMedido) => string | null, promedio: number): Grupo[] {
  const m = new Map<string, number[]>();
  for (const p of posts) {
    const k = clave(p);
    if (k == null) continue;
    m.set(k, [...(m.get(k) ?? []), interaccion(p)]);
  }
  return [...m.entries()]
    .map(([nombre, vals]) => {
      const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { nombre, n: vals.length, promedio: Math.round(prom), x: promedio > 0 ? prom / promedio : 0 };
    })
    .sort((a, b) => b.promedio - a.promedio);
}

/**
 * @param posts las publicaciones de la cuenta (las que tienen me gusta visibles).
 * @param hoy "YYYY-MM-DD": se miran los últimos `dias` (por defecto 120).
 */
export function queFunciona(posts: PostMedido[], hoy: string, dias = 120): QueFunciona {
  const corte = Date.parse(`${hoy}T00:00:00Z`) - dias * 86_400_000;
  const medidos = posts.filter((p) => p.likes != null && Date.parse(p.timestamp.replace(/\+0000$/, "Z")) >= corte);
  const total = medidos.reduce((s, p) => s + interaccion(p), 0);
  const promedio = medidos.length ? total / medidos.length : 0;
  const vacio: QueFunciona = { posts: medidos.length, desde: null, promedio: Math.round(promedio), formatos: [], dias: [], franjas: [], top: [], frases: [] };
  if (medidos.length < MIN_POSTS) {
    return { ...vacio, frases: [`Todavía hay pocas publicaciones para sacar conclusiones (${medidos.length} en los últimos ${dias} días; hacen falta ${MIN_POSTS}).`] };
  }

  const formatos = agrupar(medidos, formatoDe, promedio);
  const diasG = agrupar(medidos, (p) => DIAS[enArgentina(p.timestamp).dia], promedio);
  const franjas = agrupar(
    medidos,
    (p) => {
      const h = enArgentina(p.timestamp).hora;
      return FRANJAS.find((f) => h >= f.desde && h < f.hasta)?.nombre ?? null;
    },
    promedio
  );

  const frases: string[] = [];
  const fOk = formatos.filter((g) => g.n >= MIN_GRUPO);
  if (fOk.length >= 2) {
    const [mejor, peor] = [fOk[0], fOk[fOk.length - 1]];
    if (peor.promedio > 0 && mejor.promedio / peor.promedio >= MIN_X)
      frases.push(`${conArticulo(mejor.nombre, true)} traen ${veces(mejor.promedio / peor.promedio)} veces más interacción que ${conArticulo(peor.nombre)}.`);
  }
  const dOk = diasG.filter((g) => g.n >= MIN_GRUPO);
  if (dOk.length && dOk[0].x >= MIN_X) frases.push(`Los ${dOk[0].nombre} rinden ${veces(dOk[0].x)} veces más que el promedio.`);
  const hOk = franjas.filter((g) => g.n >= MIN_GRUPO);
  if (hOk.length && hOk[0].x >= MIN_X) frases.push(`El mejor horario es ${hOk[0].nombre}: ${veces(hOk[0].x)} veces el promedio.`);
  if (!frases.length) frases.push("Todavía no hay un patrón claro: ningún formato, día ni horario se despega. Conviene seguir variando para descubrirlo.");

  const top = [...medidos]
    .sort((a, b) => interaccion(b) - interaccion(a))
    .slice(0, 3)
    .map((p) => ({
      permalink: p.permalink,
      imagen: p.imagen,
      interaccion: interaccion(p),
      x: promedio > 0 ? interaccion(p) / promedio : 0,
      formato: formatoDe(p),
      fecha: enArgentina(p.timestamp).fecha,
    }));

  const desde = medidos.map((p) => enArgentina(p.timestamp).fecha).sort()[0] ?? null;
  return { posts: medidos.length, desde, promedio: Math.round(promedio), formatos, dias: diasG, franjas, top, frases };
}

/** Lo que se le pasa a JDmedIA al armar el calendario. */
export function paraLaIa(q: QueFunciona): string | null {
  if (q.posts < MIN_POSTS) return null;
  const top = q.top.map((t) => `${t.formato} del ${t.fecha} (${veces(t.x)}× el promedio)`).join("; ");
  return [
    `Lo que funciona en esta cuenta (medido en sus últimas ${q.posts} publicaciones de Instagram, promedio ${q.promedio} me gusta + comentarios):`,
    ...q.frases.map((f) => `- ${f}`),
    top ? `- Las mejores piezas: ${top}.` : "",
    "Usalo para elegir formatos, días y horarios: priorizá lo que rinde, sin dejar de probar algo distinto en 1 de cada 4 piezas.",
  ]
    .filter(Boolean)
    .join("\n");
}
