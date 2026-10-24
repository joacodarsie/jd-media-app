/**
 * El momento justo para pedir una recomendación (24/10/2026, pedido del dueño).
 *
 * Al 24/10 el programa de referidos tenía cero recomendaciones: el botón
 * «Recomendanos» estaba al fondo del portal y se pedía en frío. La gente
 * recomienda cuando acaba de ver un resultado. Este módulo detecta ese momento
 * con datos que la plataforma ya junta:
 *
 *  - un posteo récord: en lo que va del mes, uno con el doble (o más) de
 *    interacción que el promedio del resto, publicado hace 10 días o menos;
 *  - o el crecimiento de seguidores desde que arrancamos (+15% y +50 como mínimo).
 *
 * Con eso el portal festeja el logro arriba de todo y ofrece mandarlo por
 * WhatsApp, y la PM recibe una tarea para pedirlo en ese momento.
 *
 * Módulo PURO.
 */
import { linkReferido, PCT_RECOMENDADO, PCT_REFERIDO } from "./referidos";

export interface PostDelMes {
  like_count?: number | null;
  comments_count?: number | null;
  timestamp?: string | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

export interface Logro {
  clave: "posteo_record" | "seguidores";
  emoji: string;
  /** La frase grande: «Tu posteo del 21/10 tuvo 3,5 veces más interacción que el resto». */
  titulo: string;
  detalle: string;
  /** Cómo lo cuenta el cliente en el mensaje a un conocido. */
  enElMensaje: string;
  link?: string | null;
  imagen?: string | null;
}

const interaccion = (p: PostDelMes) => (Number(p.like_count) || 0) + (Number(p.comments_count) || 0);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const veces = (x: number) => (Math.round(x * 10) / 10).toLocaleString("es-AR");

export const DIAS_POSTEO_FRESCO = 10;
export const MIN_INTERACCION_RECORD = 30;

export function posteoRecord(posts: PostDelMes[], hoy: string): Logro | null {
  const conFecha = posts.filter((p) => p.timestamp);
  if (conFecha.length < 3) return null;
  const mejor = [...conFecha].sort((a, b) => interaccion(b) - interaccion(a))[0];
  const resto = conFecha.filter((p) => p !== mejor);
  const promedio = resto.reduce((s, p) => s + interaccion(p), 0) / resto.length;
  const top = interaccion(mejor);
  if (top < MIN_INTERACCION_RECORD || promedio <= 0 || top < promedio * 2) return null;
  const fecha = mejor.timestamp!.slice(0, 10);
  const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${fecha}T12:00:00Z`)) / 86_400_000;
  if (dias < 0 || dias > DIAS_POSTEO_FRESCO) return null;
  const x = top / promedio;
  return {
    clave: "posteo_record",
    emoji: "🔥",
    titulo: `Tu posteo del ${ddmm(fecha)} tuvo ${veces(x)} veces más interacción que el resto`,
    detalle: `${top.toLocaleString("es-AR")} me gusta y comentarios, contra ${Math.round(promedio).toLocaleString("es-AR")} de promedio en el mes.`,
    enElMensaje: `un posteo nuestro tuvo ${veces(x)} veces más interacción que el resto`,
    link: mejor.permalink ?? null,
    imagen: mejor.thumbnail_url ?? (mejor.media_type === "VIDEO" ? null : mejor.media_url) ?? null,
  };
}

export function crecimientoSeguidores(antes: number | null, hoy: number | null): Logro | null {
  if (!antes || !hoy || antes <= 0) return null;
  const dif = hoy - antes;
  const pct = Math.round((dif / antes) * 100);
  if (dif < 50 || pct < 15) return null;
  return {
    clave: "seguidores",
    emoji: "📈",
    titulo: `${dif.toLocaleString("es-AR")} seguidores nuevos desde que arrancamos (+${pct}%)`,
    detalle: `De ${antes.toLocaleString("es-AR")} a ${hoy.toLocaleString("es-AR")}.`,
    enElMensaje: `ya sumamos ${dif.toLocaleString("es-AR")} seguidores nuevos (+${pct}%)`,
  };
}

/** El logro para mostrar: primero el posteo récord (es noticia), si no el crecimiento. */
export function logroDeLaCuenta(input: { posts: PostDelMes[]; seguidoresAntes: number | null; seguidoresHoy: number | null; hoy: string }): Logro | null {
  return posteoRecord(input.posts, input.hoy) ?? crecimientoSeguidores(input.seguidoresAntes, input.seguidoresHoy);
}

/** El mensaje que el cliente reenvía, con su logro adentro. Sin emojis astrales (WhatsApp Web los rompe). */
export function mensajeConLogro(code: string, logro: Logro): string {
  return `Te recomiendo JD Media, la agencia que me maneja las redes: ${logro.enElMensaje}. Con mi link tenés un ${PCT_RECOMENDADO}% de descuento en tu primer mes: ${linkReferido(code)}`;
}

export function whatsappConLogro(code: string, logro: Logro): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeConLogro(code, logro))}`;
}

/** La tarea de la PM: pedir la recomendación justo ahora. Una por cuenta y por mes. */
export function tareaPedirRecomendacion(c: { id: string; nombre: string }, logro: Logro, hoy: string) {
  return {
    rutina_key: `ref:momento:${c.id}:${hoy.slice(0, 7)}`,
    titulo: `Buen momento para pedirle una recomendación a ${c.nombre}`,
    descripcion: `${logro.emoji} **${logro.titulo}.** ${logro.detalle}\n\nEs el mejor momento para pedirle que nos recomiende: acaba de ver un resultado. Por el grupo de WhatsApp, algo así:\n\n«¡Mirá esto! ${logro.titulo.replace(/^Tu /, "El ")}. Si conocés a alguien a quien le venga bien lo mismo, en tu plataforma (pestaña Calendario) tenés el botón para mandarle tu link: tiene ${PCT_RECOMENDADO}% de descuento en su primer mes y vos ${PCT_REFERIDO}% en tu próxima factura.»${logro.link ? `\n\n[Ver el posteo](${logro.link})` : ""}`,
  };
}
