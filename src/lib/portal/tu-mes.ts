/**
 * «Tu mes en JD Media» (19/10/2026): el resumen del mes cerrado en formato
 * historias, tipo Spotify Wrapped, para el portal del cliente. Lo puro: qué
 * placas se arman con lo que hay. Sin datos de Instagram igual sale (lo que
 * publicamos); con datos suma alcance, seguidores y la pieza estrella.
 */
export interface DatosTuMes {
  nombre: string;
  mesLabel: string; // "septiembre"
  publicadas: { reels: number; posts: number; historias: number };
  ig: {
    seguidoresNuevos: number | null;
    reach: number | null;
    interactions: number | null;
    followersEnd: number | null;
  } | null;
  estrella: { caption: string | null; permalink: string | null; reach: number | null; likes: number; comentarios: number } | null;
}

export type Placa =
  | { tipo: "portada"; titulo: string; sub: string }
  | { tipo: "numero"; valor: number; titulo: string; sub: string; prefijo?: string }
  | { tipo: "estrella"; titulo: string; caption: string; permalink: string | null; datos: string }
  | { tipo: "cierre"; titulo: string; sub: string };

const fmt = (n: number) => n.toLocaleString("es-AR");

export function armarPlacas(d: DatosTuMes): Placa[] {
  const { reels, posts, historias } = d.publicadas;
  const total = reels + posts + historias;
  const placas: Placa[] = [{ tipo: "portada", titulo: `Tu ${d.mesLabel}`, sub: `${d.nombre} × JD Media` }];
  if (total > 0) {
    const partes = [
      reels ? `${reels} reel${reels === 1 ? "" : "s"}` : null,
      posts ? `${posts} posteo${posts === 1 ? "" : "s"}` : null,
      historias ? `${historias} historia${historias === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    placas.push({ tipo: "numero", valor: total, titulo: "piezas publicadas", sub: partes.join(" · ") });
  }
  const ig = d.ig;
  if (ig?.reach && ig.reach > 0) {
    placas.push({ tipo: "numero", valor: ig.reach, titulo: "cuentas te vieron", sub: "Alcance de tu Instagram en el mes" });
  }
  if (ig?.interactions && ig.interactions > 0) {
    placas.push({ tipo: "numero", valor: ig.interactions, titulo: "interacciones", sub: "Me gusta, comentarios, guardados y compartidos" });
  }
  if (ig?.seguidoresNuevos != null && ig.seguidoresNuevos > 0) {
    placas.push({
      tipo: "numero",
      valor: ig.seguidoresNuevos,
      prefijo: "+",
      titulo: "seguidores nuevos",
      sub: ig.followersEnd ? `Cerraste el mes con ${fmt(ig.followersEnd)}` : "Gente nueva que te eligió",
    });
  }
  if (d.estrella) {
    const e = d.estrella;
    const datos = [
      e.reach ? `${fmt(e.reach)} de alcance` : null,
      e.likes ? `${fmt(e.likes)} me gusta` : null,
      e.comentarios ? `${fmt(e.comentarios)} comentarios` : null,
    ].filter(Boolean).join(" · ");
    placas.push({
      tipo: "estrella",
      titulo: "Tu pieza estrella",
      caption: (e.caption ?? "").split("\n")[0].slice(0, 140) || "La que más gustó del mes",
      permalink: e.permalink,
      datos,
    });
  }
  placas.push({ tipo: "cierre", titulo: "Vamos por más", sub: `Gracias por confiar en nosotros. El mes que viene, otra vez.` });
  return placas;
}

/** ¿Hay algo para mostrar? Sin publicaciones ni datos, no se muestra el botón. */
export function hayTuMes(placas: Placa[]): boolean {
  return placas.some((p) => p.tipo === "numero");
}

/** La pieza estrella: la de más alcance; si no hay alcance, la de más interacción. */
export function piezaEstrella<T extends { reach: number | null; like_count: number; comments_count: number }>(media: T[]): T | null {
  if (!media.length) return null;
  const valor = (m: T) => (m.reach ?? 0) * 1000 + m.like_count + m.comments_count;
  return [...media].sort((a, b) => valor(b) - valor(a))[0];
}
