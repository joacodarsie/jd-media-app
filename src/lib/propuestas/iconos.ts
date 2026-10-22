/**
 * Los íconos de la propuesta (21/10/2026). Pedido del dueño: presupuestos con
 * menos texto y más íconos, que se entiendan de un vistazo. Los puntos de «Lo
 * que vamos a hacer» los escribe la IA (o él a mano), así que el ícono sale de
 * lo que dice cada uno. Puro.
 */

const REGLAS: [RegExp, string][] = [
  [/sesi[oó]n|grabar|grabaci|filmar|fotos|producci[oó]n de contenido|locaci/i, "🎥"],
  [/pauta|meta ads|anuncio|campaña|publicidad/i, "📈"],
  [/tiktok/i, "🎵"],
  [/whatsapp|chat|consulta/i, "💬"],
  [/web|landing|sitio/i, "💻"],
  [/google/i, "🔎"],
  [/reel|video/i, "🎬"],
  [/calendario|editorial|planific/i, "🗓️"],
  [/marca|identidad|manual|logo|est[eé]tica/i, "🎨"],
  [/perfil|bio|destacad/i, "🪪"],
  [/comunidad|seguidores|clientes fieles/i, "🤝"],
  [/m[eé]trica|reporte|resultado|medir/i, "📊"],
  [/evento|fiesta|temporada|lanzamiento/i, "🎉"],
  [/venta|reserva|turno/i, "🛒"],
];

/** El ícono de un punto de la propuesta, por lo que dice: manda el título si lo tiene. */
export function iconoDePunto(texto: string, titulo?: string | null): string {
  for (const t of [titulo, texto]) if (t) for (const [re, icono] of REGLAS) if (re.test(t)) return icono;
  return "✨";
}

/** Lo que entra por mes sumando todas las cuentas, para los números grandes de la portada. */
export function volumenTotal(packs: { reels: number | null; posts: number | null; dias_historias: number | null }[]) {
  return packs.reduce(
    (t, p) => ({ reels: t.reels + (p.reels ?? 0), posts: t.posts + (p.posts ?? 0), historias: t.historias + (p.dias_historias ?? 0) }),
    { reels: 0, posts: 0, historias: 0 }
  );
}

/** El equipo asignado a la cuenta, en caras. */
export const EQUIPO_PROPUESTA: { icono: string; rol: string }[] = [
  { icono: "📱", rol: "Community manager" },
  { icono: "🎨", rol: "Diseñador gráfico" },
  { icono: "🎬", rol: "Editor audiovisual" },
  { icono: "📈", rol: "Especialista en Meta Ads" },
  { icono: "✨", rol: "Director creativo" },
  { icono: "🎯", rol: "Project manager" },
];

/** El primer mes, en hitos (coincide con el arranque de 15 días del equipo). */
export const CAMINO_MES_1: { dia: string; icono: string; que: string }[] = [
  { dia: "Día 1", icono: "🤝", que: "Reunión de onboarding y diagnóstico" },
  { dia: "Día 3", icono: "🎨", que: "Manual de marca y perfiles" },
  { dia: "Día 5", icono: "🗓️", que: "Aprobás el calendario" },
  { dia: "Día 15", icono: "📣", que: "Sale el contenido y la pauta" },
  { dia: "Día 30", icono: "📊", que: "Reporte del mes" },
];

/** El nombre de la marca en una o dos líneas, con el tamaño que entre en el círculo. */
export function lineasDeMarca(nombre: string): { lineas: string[]; tam: number } {
  const n = nombre.trim();
  if (n.length <= 9) return { lineas: [n], tam: 24 };
  if (n.length <= 13) return { lineas: [n], tam: 18 };
  const palabras = n.split(/\s+/);
  if (palabras.length === 1) return { lineas: [n.slice(0, 18)], tam: 13 };
  let mejor = 1;
  let dif = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ").length;
    const b = palabras.slice(i).join(" ").length;
    if (Math.abs(a - b) <= dif) {
      dif = Math.abs(a - b);
      mejor = i;
    }
  }
  const lineas = [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")];
  const largo = Math.max(...lineas.map((l) => l.length));
  return { lineas, tam: largo <= 10 ? 18 : largo <= 14 ? 15 : 12 };
}
