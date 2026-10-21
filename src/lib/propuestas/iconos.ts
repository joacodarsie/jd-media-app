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
