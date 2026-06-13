/**
 * Cuotas mensuales de contenido por pack.
 * Fuente: https://www.jdmedia.com.ar/servicios/gestion-redes/
 *
 * Importante: la cantidad cuenta PIEZAS ÚNICAS de producción.
 * El mismo reel se replica en Instagram, Facebook y TikTok — eso es UNA pieza,
 * no tres. Lo mismo con los posts.
 *
 * Las redes incluidas en todos los packs son Instagram (principal), Facebook
 * (espejo) y TikTok (espejo de reels y posts). LinkedIn u otros canales
 * requieren cotización aparte (pack Personalizado).
 */

export type PackId = "Presencia" | "Crecimiento" | "Escala" | "Personalizado";

export interface PackQuota {
  reels: number;
  posts: number;
  /** Días por mes con contenido en stories (no historias individuales) */
  dias_stories: number;
  /** Redes incluidas (donde se replica el contenido) */
  redes_incluidas: ("instagram" | "facebook" | "tiktok")[];
}

export const PACK_QUOTAS: Record<Exclude<PackId, "Personalizado">, PackQuota> = {
  Presencia: {
    reels: 4,
    posts: 4,
    dias_stories: 8,
    redes_incluidas: ["instagram", "facebook", "tiktok"],
  },
  Crecimiento: {
    reels: 8,
    posts: 8,
    dias_stories: 12,
    redes_incluidas: ["instagram", "facebook", "tiktok"],
  },
  Escala: {
    reels: 12,
    posts: 12,
    dias_stories: 20,
    redes_incluidas: ["instagram", "facebook", "tiktok"],
  },
};

/**
 * Devuelve un texto descriptivo del pack para inyectar en prompts.
 */
export function describePack(pack: string | null | undefined): string {
  if (!pack) return "Pack no definido. Usá criterio profesional para estimar cantidad razonable.";
  if (pack === "Personalizado") {
    return "Pack Personalizado: cantidad de contenido es flexible. Usá criterio según el contexto del cliente y lo que veas en el calendario actual.";
  }
  const q = PACK_QUOTAS[pack as Exclude<PackId, "Personalizado">];
  if (!q) return `Pack "${pack}" no reconocido. Estimá cantidad razonable.`;
  return [
    `Pack contratado: **${pack}**.`,
    `Cuota mensual incluida (piezas únicas de producción):`,
    `  - ${q.reels} reels`,
    `  - ${q.posts} posts`,
    `  - ${q.dias_stories} días con contenido en stories (generá ${q.dias_stories} temas de historia con formato "story")`,
    `Redes incluidas (replica automática): ${q.redes_incluidas.join(", ")}.`,
    ``,
    `IMPORTANTE: estos números son LÍMITES contractuales. No los excedas. Si querés sugerir más volumen, indicalo en notas pero no inflés el mix. Las historias también se planifican: incluí ${q.dias_stories} temas con formato "story".`,
  ].join("\n");
}
