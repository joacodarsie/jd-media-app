"use server";

import { revalidatePath } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, userInRoles } from "@/lib/auth";
import { aplicarMatches, conciliarCuenta } from "@/lib/social/conciliar-run";

const EDITORES = ["admin", "coordinador", "community_manager"];

async function gate() {
  const me = await requireUser();
  if (!userInRoles(me, EDITORES))
    return { error: "Solo el CM, la coordinación o la dirección pueden tocar el calendario." };
  return { me };
}

function invalidate(clienteId?: string) {
  revalidatePath("/contenidos/salio");
  revalidatePath("/contenidos");
  if (clienteId) revalidatePath(`/clientes/${clienteId}/calendario`);
}

/** Marca todas las coincidencias seguras de una cuenta. */
export async function aplicarSeguras(clienteId: string, clienteNombre: string) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();
  const r = await conciliarCuenta(admin, { id: clienteId, nombre: clienteNombre }, { aplicar: true });
  invalidate(clienteId);
  return { ok: true, aplicados: r.aplicados.length };
}

/** Confirma un cruce dudoso: esta pieza es este posteo. */
export async function confirmarCruce(
  piezaId: string,
  piezaTitulo: string,
  mediaId: string,
  permalink: string | null,
  clienteId: string,
) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();
  const hechos = await aplicarMatches(admin, [
    {
      piezaId,
      piezaTitulo,
      mediaId,
      permalink,
      fechaReal: null,
      fechaPlan: null,
      diasDiferencia: null,
      motivo: "texto",
      confianza: "alta",
      yaMarcada: false,
      score: 1,
    },
  ]);
  invalidate(clienteId);
  return hechos.length ? { ok: true } : { error: "No se pudo marcar la pieza." };
}

/**
 * Descarta un cruce para que no vuelva a proponerse.
 * `piezaId` nulo = "este posteo no es contenido nuestro".
 */
export async function descartarCruce(
  clienteId: string,
  piezaId: string | null,
  mediaId: string,
) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();
  const { error } = await admin.from("ig_conciliacion_descartes").insert({
    cliente_id: clienteId,
    publication_id: piezaId,
    ig_media_id: mediaId,
    descartado_por_id: g.me.id,
  });
  // 42P01 = la migración 0152 todavía no está aplicada.
  if (error && error.code !== "23505") {
    return {
      error:
        error.code === "42P01"
          ? "Falta aplicar la migración 0152 en Supabase para poder descartar cruces."
          : error.message,
    };
  }
  invalidate(clienteId);
  return { ok: true };
}

/**
 * Registra en el calendario un posteo que salió sin estar planificado. Queda
 * como publicado (el trigger 0106 cierra la tarea que se autogenera).
 */
export async function crearPiezaDesdePosteo(
  clienteId: string,
  media: { id: string; caption: string | null; media_type: string; permalink: string | null; timestamp: string | null },
) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();

  const caption = media.caption?.trim() ?? "";
  const titulo = (caption.split("\n")[0] || "Posteo de Instagram").slice(0, 80);
  const tipo =
    media.media_type === "VIDEO"
      ? "reel"
      : media.media_type === "CAROUSEL_ALBUM"
        ? "carrusel"
        : "post";

  const { error } = await admin.from("publications").insert({
    cliente_id: clienteId,
    titulo,
    copy: caption || null,
    red: "instagram",
    tipo,
    estado: "publicado",
    fecha_publicacion: media.timestamp,
    ig_media_id: media.id,
    ig_permalink: media.permalink,
    link_instagram: media.permalink,
    creado_por_id: g.me.id,
  });
  if (error) return { error: error.message };
  invalidate(clienteId);
  return { ok: true };
}

/** La pieza figuraba publicada y en Instagram no está: vuelve a "aprobado". */
export async function marcarNoPublicada(piezaId: string, clienteId: string) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();
  const { error } = await admin
    .from("publications")
    .update({ estado: "aprobado", ig_media_id: null, ig_permalink: null })
    .eq("id", piezaId);
  if (error) return { error: error.message };
  invalidate(clienteId);
  return { ok: true };
}
