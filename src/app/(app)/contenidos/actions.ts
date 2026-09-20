"use server";

import { revalidatePath } from "next/cache";
import {
  chequearLinkParaPublicar,
  type LinksDePieza,
} from "@/lib/contenidos/link-publicado";
import {
  bandejaDeAprobacion,
  destinoAlAprobar,
  motivoParaNoAprobar,
  motivoParaNoProgramar,
} from "@/lib/contenidos/aprobacion";
import { publicarPiezaEnDrive } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

// Cliente admin para las ESCRITURAS del calendario (crear/editar/mover/borrar).
// Motivo: la RLS de publications solo deja actualizar al staff/creador/editor,
// así que un CM (que no es "staff") no podía editar el contenido de SU cuenta
// aunque la app se lo permite (ensureCalendarEditor). Las escrituras ya están
// gateadas por rol a nivel app; el admin evita el bloqueo silencioso de la RLS.
// (Existe la migración 0107 que arregla la RLS; esto no depende de aplicarla.)
function writeDb() {
  return createAdmin();
}

/**
 * Qué sumarle al patch para llevar el reloj de "revisión creativa".
 *
 * Existe porque ese estado no tenía dueño ni reloj: diseño cerraba su tarea, la
 * pieza quedaba esperando que el CM la mirara, y como no quedaba tarea abierta
 * el aviso de vencidas dejaba de nombrarla. Con la marca, el cron puede avisar
 * y escalar (ver `lib/contenidos/revision-creativa`).
 */
function selloDeRevision(estado: string, estadoPrevio?: string | null) {
  if (estado === estadoPrevio) return {};
  return {
    revision_creativa_at: estado === "revision_creativa" ? new Date().toISOString() : null,
  };
}

/**
 * El sello de arriba, tolerando que la 0161 no esté aplicada todavía: si la
 * columna no existe, se reintenta sin ella en vez de fallar el cambio de estado.
 */
async function updateTolerandoSello<T>(
  correr: (patch: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message: string } | null } & T>,
  patch: Record<string, unknown>
) {
  const r = await correr(patch);
  if (r.error?.code === "42703" && "revision_creativa_at" in patch) {
    const sinSello = { ...patch };
    delete sinSello.revision_creativa_at;
    return correr(sinSello);
  }
  return r;
}

// Quién puede EDITAR el calendario (crear/editar/mover fecha/borrar publicaciones).
// El resto del equipo (diseño, audiovisual) solo comenta y marca el contenido
// como hecho / sube su pieza.
// Se mira con userInRoles (rol Y rol_secundario) para que coincida EXACTO con el
// gate de la UI (`canEdit` en /contenidos): si no, alguien con el CM como rol
// secundario ve los botones y el server se los rechaza.
const CALENDAR_EDITORS = ["admin", "coordinador", "community_manager"];
async function ensureCalendarEditor(): Promise<string | null> {
  const me = await requireUser();
  return userInRoles(me, CALENDAR_EDITORS)
    ? null
    : "Solo el CM, la coordinación o la dirección pueden editar el calendario. Vos podés comentar y marcar el contenido como hecho.";
}

export interface PublicationInput {
  cliente_id: string;
  titulo: string;
  descripcion: string | null;
  copy: string | null;
  guion: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  hashtags: string | null;
  asset_url: string | null;
  referencia_url: string | null;
  audiovisual_id: string | null;
  disenador_id: string | null;
  task_id: string | null;
  notas_revision?: string | null;
  estado?: string;

  resubido_tiktok?: boolean;
}

function clean(input: PublicationInput) {
  return {
    cliente_id: input.cliente_id,
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    copy: input.copy?.trim() || null,
    guion: input.guion?.trim() || null,
    red: input.red,
    tipo: input.tipo,
    fecha_publicacion: input.fecha_publicacion || null,
    hashtags: input.hashtags?.trim() || null,
    asset_url: input.asset_url?.trim() || null,
    referencia_url: input.referencia_url?.trim() || null,
    audiovisual_id: input.audiovisual_id || null,
    disenador_id: input.disenador_id || null,
    task_id: input.task_id || null,
    notas_revision: input.notas_revision?.trim() || null,

    resubido_tiktok: input.resubido_tiktok ?? false,
  };
}

function invalidate(clienteId?: string | null) {
  revalidatePath("/contenidos");
  if (clienteId) revalidatePath(`/clientes/${clienteId}/calendario`);
}

export async function createPublication(input: PublicationInput) {
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const { supabase, userId } = await ctx();
  const { data, error } = await writeDb()
    .from("publications")
    .insert({ ...clean(input), creado_por_id: userId })
    .select("id, cliente_id, task_id")
    .single();
  if (error) return { error: error.message };

  // El trigger jd_publication_autogen_task creó una tarea y la linkeó.
  // Traemos el nombre del asignado para mostrar feedback.
  let assignedName: string | null = null;
  let taskArea: string | null = null;
  if (data.task_id) {
    const { data: t } = await supabase
      .from("tasks")
      .select("area, asignado:users!tasks_asignado_a_id_fkey(nombre)")
      .eq("id", data.task_id)
      .maybeSingle();
    const asignado = (t as unknown as { asignado: { nombre: string } | null } | null)?.asignado;
    assignedName = asignado?.nombre ?? null;
    taskArea = (t as { area: string } | null)?.area ?? null;
  }

  invalidate(data.cliente_id);
  return {
    ok: true,
    id: data.id,
    task_id: data.task_id,
    assignedName,
    taskArea,
  };
}

export async function updatePublication(id: string, input: PublicationInput) {
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const payload: Record<string, unknown> = clean(input);
  if (input.estado) Object.assign(payload, { estado: input.estado }, selloDeRevision(input.estado));
  const { data, error } = await updateTolerandoSello(
    (p) => writeDb().from("publications").update(p).eq("id", id).select("cliente_id").single(),
    payload
  );
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

export async function changePublicationStatus(
  id: string,
  estado: string,
  notas?: string,
  /** Link del posteo. Obligatorio al pasar a "publicado" (ver link-publicado). */
  linkPosteo?: string | null
) {
  const admin = writeDb();
  // Traemos la cuenta de la pieza para verificar que quien cambia el estado sea
  // del EQUIPO de esa cuenta (o staff). Antes lo hacía la RLS, pero como un CM
  // no es "staff" el update le fallaba en silencio.
  const { data: pub } = await admin
    .from("publications")
    .select(
      "cliente_id, estado, titulo, tipo, asset_url, fecha_publicacion, created_at, link_instagram"
    )
    .eq("id", id)
    .maybeSingle();
  if (!pub) return { error: "No se encontró la publicación." };
  if (!(await userOnClientTeam(pub.cliente_id))) {
    return {
      error:
        "No tenés permiso para cambiar el estado de esta pieza. Solo el equipo de esa cuenta (CM, diseño, edición, coordinación) puede.",
    };
  }
  // "Publicado" sin link es una afirmación que nadie puede comprobar: no se
  // puede abrir el posteo, ni medir qué repercusión tuvo, ni ponerlo en el
  // informe. Al 13/9 había 438 piezas publicadas y CERO con link.
  const piezaLinks = pub as unknown as {
    red: string | null;
    created_at: string | null;
  } & LinksDePieza;
  const chequeo = chequearLinkParaPublicar({
    estadoNuevo: estado,
    estadoAnterior: pub.estado as string,
    pieza: piezaLinks,
    tipo: (pub as { tipo?: string | null }).tipo,
    creadaEn: piezaLinks.created_at,
    linkNuevo: linkPosteo,
  });
  if (chequeo.motivo) return { error: chequeo.motivo, faltaLink: true };

  // Programar una pieza sin el archivo final es aprobar algo que nadie vio.
  // El candado va acá y no solo en el botón: al calendario se le cambia el
  // estado desde el select, desde el arrastre del kanban y desde la bandeja.
  const motivoArchivo = motivoParaNoProgramar({
    estadoNuevo: estado,
    estadoAnterior: pub.estado as string,
    pieza: pub as { estado: string; asset_url?: string | null; link_instagram?: string | null },
    linkNuevo: linkPosteo,
  });
  if (motivoArchivo) return { error: motivoArchivo, faltaArchivo: true };

  const patch: Record<string, unknown> = { estado, ...selloDeRevision(estado, pub.estado) };
  if (linkPosteo && linkPosteo.trim()) {
    patch.link_instagram = linkPosteo.trim();
  }
  if (notas !== undefined) patch.notas_revision = notas?.trim() || null;
  const { error } = await updateTolerandoSello(
    (p) => admin.from("publications").update(p).eq("id", id),
    patch
  );
  if (error) return { error: error.message };

  // Una pieza APROBADA va al Drive del cliente, que es de donde él la baja.
  // Best-effort y sin esperar: si Drive falla o tarda, la aprobación ya quedó
  // guardada. Lo que no puede pasar es que se caiga Google y nadie pueda aprobar.
  if (estado === "aprobado") {
    void dejarPiezaAprobadaEnDrive({
      clienteId: pub.cliente_id as string,
      titulo: (pub as { titulo?: string }).titulo ?? "Pieza",
      assetUrl: (pub as { asset_url?: string | null }).asset_url ?? null,
      fecha: (pub as { fecha_publicacion?: string | null }).fecha_publicacion ?? null,
    }).catch((e) => console.error("aprobar → Drive del cliente:", e));
  }

  invalidate(pub.cliente_id);
  return { ok: true };
}

/**
 * Marca (o desmarca) que una pieza está frenada POR EL CLIENTE: no mandó el
 * material, pidió esperar, no contesta. Esas piezas salen del conteo de atraso
 * del equipo y pasan a la lista de "esperando al cliente", que es un reclamo
 * comercial y no un problema de producción.
 */
export async function setPublicationFrenado(
  id: string,
  frenado: boolean,
  nota?: string | null
) {
  const admin = writeDb();
  const { data: pub } = await admin
    .from("publications")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (!pub) return { error: "No se encontró la publicación." };
  if (!(await userOnClientTeam(pub.cliente_id))) {
    return { error: "Solo el equipo de esa cuenta puede marcarla." };
  }

  const { error } = await admin
    .from("publications")
    .update({
      frenado_cliente: frenado,
      frenado_nota: frenado ? nota?.trim().slice(0, 400) || null : null,
      frenado_at: frenado ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) {
    if ((error as { code?: string }).code === "42703")
      return { error: "Falta aplicar la migración 0140 para usar esta marca." };
    return { error: error.message };
  }
  invalidate(pub.cliente_id);
  return { ok: true as const };
}

/** True si el usuario es staff o parte del equipo asignado a la cuenta. */
async function userOnClientTeam(clienteId: string | null): Promise<boolean> {
  if (!clienteId) return false;
  const me = await requireUser();
  if (isStaffUser(me)) return true;
  const { data: c } = await createAdmin()
    .from("clients")
    .select("cm_id, disenador_id, audiovisual_id, coordinador_id, media_buyer_id")
    .eq("id", clienteId)
    .maybeSingle();
  if (!c) return false;
  return [c.cm_id, c.disenador_id, c.audiovisual_id, c.coordinador_id, c.media_buyer_id].includes(
    me.id
  );
}

/**
 * Cambia solo la fecha de publicación. Usado por el drag&drop del calendario.
 * date debe venir en YYYY-MM-DD (o null para "sin fecha").
 */
export async function updatePublicationDate(id: string, date: string | null) {
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const { supabase } = await ctx();
  let fechaIso: string | null = null;
  if (date) {
    // mantener la hora original si existía; sino mediodía Cordoba
    const { data: existing } = await supabase
      .from("publications")
      .select("fecha_publicacion")
      .eq("id", id)
      .maybeSingle();
    if (existing?.fecha_publicacion) {
      const prev = new Date(existing.fecha_publicacion);
      const hh = prev.getUTCHours();
      const mm = prev.getUTCMinutes();
      fechaIso = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;
    } else {
      // 12:00 hora Cordoba = 15:00 UTC
      fechaIso = `${date}T15:00:00.000Z`;
    }
  }
  const { data, error } = await writeDb()
    .from("publications")
    .update({ fecha_publicacion: fechaIso })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

/**
 * El link del posteo, cuando ya se publicó.
 *
 * Antes recibía uno por red. Quedó solo Instagram: las columnas de TikTok y
 * Facebook estaban vacías, y seis lugares para el mismo dato hacían que
 * ninguno fuera confiable (migración 0167).
 */
export async function updatePublicationFinalFields(id: string, link_instagram: string | null) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .update({ link_instagram })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

export async function setPublicationTiktokSubido(
  id: string,
  subido: boolean
) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("publications")
    .update({ tiktok_subido: subido })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

/** Guarda el link del contenido final (Drive/Canva) de una publicación. */
export async function setPublicationAsset(id: string, url: string) {
  const { supabase } = await ctx();
  const value = url.trim() || null;
  const { data, error } = await supabase
    .from("publications")
    .update({ asset_url: value })
    .eq("id", id)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  invalidate(data?.cliente_id);
  return { ok: true };
}

/**
 * Borra publicaciones (y sus tareas autogeneradas) sin chocar con el trigger.
 *
 * ⚠️ POR QUÉ NO ES UN `delete` DIRECTO: el trigger `trg_publications_delete_task`
 * (migración 0108) es BEFORE DELETE y borra la tarea vinculada; esa tarea tiene
 * una FK `publications.task_id ... on delete set null`, así que el borrado de la
 * tarea UPDATEA la misma fila que se está borrando y Postgres aborta con
 * `27000: tuple to be deleted was already modified by an operation triggered by
 * the current command`. Efecto: NO se podía borrar ninguna pieza con tarea
 * vinculada (o sea, casi todas: eran 348 de 374).
 *
 * La 0141 pasa el trigger a AFTER DELETE y lo arregla en la base, pero acá
 * desvinculamos la tarea primero igual: así el borrado funciona con o sin la
 * migración aplicada (y el trigger, ya en AFTER, no encuentra nada que hacer).
 */
async function removePublications(
  admin: ReturnType<typeof createAdmin>,
  ids: string[]
): Promise<{ error?: string; deleted: number }> {
  const { data: pubs, error: readErr } = await admin
    .from("publications")
    .select("id, cliente_id, task_id")
    .in("id", ids);
  if (readErr) return { error: readErr.message, deleted: 0 };
  if (!pubs?.length) return { error: "No se encontró la publicación.", deleted: 0 };

  const linked = pubs.filter((p) => p.task_id) as { id: string; task_id: string }[];
  if (linked.length) {
    const { error: unlinkErr } = await admin
      .from("publications")
      .update({ task_id: null })
      .in(
        "id",
        linked.map((p) => p.id)
      );
    if (unlinkErr) return { error: unlinkErr.message, deleted: 0 };
  }

  const { error: delErr } = await admin
    .from("publications")
    .delete()
    .in(
      "id",
      pubs.map((p) => p.id)
    );

  if (delErr) {
    // Dejamos las tareas como estaban para no huerfanarlas si el borrado falló.
    for (const p of linked) {
      await admin.from("publications").update({ task_id: p.task_id }).eq("id", p.id);
    }
    return { error: delErr.message, deleted: 0 };
  }

  // La pieza ya no existe: ahora sí borramos la tarea que había generado.
  if (linked.length) {
    await admin
      .from("tasks")
      .delete()
      .in(
        "id",
        linked.map((p) => p.task_id)
      );
  }

  return { deleted: pubs.length };
}

export async function deletePublication(id: string) {
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const admin = writeDb();
  const { data: pub } = await admin
    .from("publications")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  const res = await removePublications(admin, [id]);
  if (res.error) return { error: res.error };
  invalidate(pub?.cliente_id);
  return { ok: true };
}

export async function bulkDeletePublications(ids: string[]) {
  if (!ids.length) return { ok: true, deleted: 0 };
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const res = await removePublications(writeDb(), ids);
  if (res.error) return { error: res.error };
  revalidatePath("/contenidos");
  revalidatePath("/clientes/[id]/calendario", "page");
  return { ok: true, deleted: res.deleted };
}

export async function bulkChangePublicationStatus(ids: string[], estado: string) {
  if (!ids.length) return { ok: true };
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };

  // Marcar "publicado" en bloque no puede ser la puerta de atrás del link: si
  // el candado solo viviera en el cambio de a una, bastaría con seleccionar
  // todo para saltearlo, y eso es justo lo que termina pasando.
  if (estado === "publicado") {
    const { data: piezas } = await writeDb()
      .from("publications")
      .select(
        "id, titulo, tipo, estado, created_at, link_instagram"
      )
      .in("id", ids);
    const filas = (piezas ?? []) as unknown as (LinksDePieza & {
      titulo: string | null;
      tipo: string | null;
      estado: string;
      created_at: string | null;
    })[];
    const sinLink = filas.filter(
      (x) =>
        chequearLinkParaPublicar({
          estadoNuevo: "publicado",
          estadoAnterior: x.estado,
          pieza: x,
          tipo: x.tipo,
          creadaEn: x.created_at,
        }).motivo !== null
    );
    if (sinLink.length > 0) {
      const nombres = sinLink.slice(0, 3).map((x) => x.titulo ?? "sin título").join(", ");
      return {
        error:
          sinLink.length +
          " pieza(s) no tienen el link del posteo: " +
          nombres +
          (sinLink.length > 3 ? "…" : "") +
          ". Marcalas de a una para cargarlo.",
        faltaLink: true,
      };
    }
  }

  // Lo mismo con el archivo: marcar veinte piezas como programadas no puede
  // ser la forma de saltearse el candado de a una.
  if (estado === "aprobado") {
    const { data: piezas } = await writeDb()
      .from("publications")
      .select("id, titulo, estado, asset_url, link_instagram")
      .in("id", ids);
    const sinArchivo = ((piezas ?? []) as unknown as {
      titulo: string | null;
      estado: string;
      asset_url: string | null;
      link_instagram: string | null;
    }[]).filter(
      (x) =>
        motivoParaNoProgramar({
          estadoNuevo: "aprobado",
          estadoAnterior: x.estado,
          pieza: x,
        }) !== null
    );
    if (sinArchivo.length > 0) {
      const nombres = sinArchivo.slice(0, 3).map((x) => x.titulo ?? "sin título").join(", ");
      return {
        error:
          sinArchivo.length +
          " pieza(s) no tienen cargado el link del Drive o del Canva: " +
          nombres +
          (sinArchivo.length > 3 ? "…" : "") +
          ". Cargalo desde Aprobar y volvé a intentarlo.",
        faltaArchivo: true,
      };
    }
  }

  const { error } = await updateTolerandoSello(
    (p) => writeDb().from("publications").update(p).in("id", ids),
    { estado, ...selloDeRevision(estado) }
  );
  if (error) return { error: error.message };
  revalidatePath("/contenidos");
  revalidatePath("/clientes/[id]/calendario", "page");
  return { ok: true };
}

/**
 * Guarda la config de auto-publicación de una pieza (toggle + archivos
 * finales). Solo el equipo de la cuenta. Si la migración 0128 no está
 * aplicada, devuelve un error claro y no rompe el resto del form.
 */
export async function saveAutoPublish(
  id: string,
  input: { auto_publicar: boolean; publish_media: { path: string; name: string }[] }
) {
  const admin = writeDb();
  const { data: pub } = await admin
    .from("publications")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (!pub) return { error: "No se encontró la publicación." };
  if (!(await userOnClientTeam(pub.cliente_id))) {
    return { error: "Solo el equipo de esta cuenta puede configurar la auto-publicación." };
  }
  const { error } = await admin
    .from("publications")
    .update({
      auto_publicar: input.auto_publicar,
      publish_media: input.publish_media,
    })
    .eq("id", id);
  if (error) {
    return {
      error: error.message.includes("auto_publicar")
        ? "Falta aplicar la migración 0128 (auto-publicación)."
        : error.message,
    };
  }
  invalidate(pub.cliente_id);
  return { ok: true };
}

/** Limpia el error de auto-publicación para que el próximo run reintente. */
export async function retryAutoPublish(id: string) {
  const admin = writeDb();
  const { data: pub } = await admin
    .from("publications")
    .select("cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (!pub) return { error: "No se encontró la publicación." };
  if (!(await userOnClientTeam(pub.cliente_id))) {
    return { error: "Solo el equipo de esta cuenta puede reintentar." };
  }
  const { error } = await admin
    .from("publications")
    .update({ publish_error: null })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate(pub.cliente_id);
  return { ok: true };
}

/**
 * Deja una pieza aprobada en el Drive del cliente.
 *
 * Separado y sin `await` en el llamador: la aprobación es lo que importa y no
 * puede depender de que Google conteste. Si falla queda en el log y el equipo
 * lo puede reintentar aprobando de nuevo — es idempotente del otro lado.
 */
async function dejarPiezaAprobadaEnDrive(input: {
  clienteId: string;
  titulo: string;
  assetUrl: string | null;
  fecha: string | null;
}) {
  if (!input.assetUrl) return; // sin archivo no hay nada que dejarle
  const admin = createAdmin();
  const { data: cli } = await admin
    .from("clients")
    .select("drive_url")
    .eq("id", input.clienteId)
    .maybeSingle();
  const res = await publicarPiezaEnDrive({
    clienteDriveUrl: (cli as { drive_url?: string | null } | null)?.drive_url ?? null,
    assetUrl: input.assetUrl,
    nombre: input.titulo,
    periodo: (input.fecha ?? "").slice(0, 7) || "sin-fecha",
  });
  if ("error" in res) console.error("dejarPiezaAprobadaEnDrive:", res.error);
}

// ─── La bandeja de aprobación ────────────────────────────────────────────────
//
// Pedido del 20/9: aprobar el mes entero de una cuenta de un saque, y no de a
// una pieza. Las tres acciones de abajo son las que usa esa pantalla; la
// decisión de qué se puede aprobar vive en `lib/contenidos/aprobacion` (pura).

type PiezaDecidible = {
  id: string;
  estado: string;
  tipo: string | null;
  titulo: string | null;
  cliente_id: string;
  asset_url: string | null;
  link_instagram: string | null;
  creado_por_id: string | null;
  audiovisual_id: string | null;
  task_id: string | null;
};

async function piezaParaDecidir(id: string) {
  const { data } = await writeDb()
    .from("publications")
    .select(
      "id, estado, tipo, titulo, cliente_id, asset_url, link_instagram, creado_por_id, audiovisual_id, task_id"
    )
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as PiezaDecidible | null;
}

/**
 * Avisarle a quien tiene que hacer algo con la pieza: quien la cargó, quien la
 * tiene asignada y quien tiene la tarea del calendario. Sin esto, la corrección
 * queda escrita en una pieza que nadie vuelve a abrir.
 */
async function avisarDeLaPieza(
  pieza: PiezaDecidible,
  yo: string,
  mensaje: string
) {
  const admin = writeDb();
  let responsableTarea: string | null = null;
  if (pieza.task_id) {
    const { data } = await admin
      .from("tasks")
      .select("asignado_a_id")
      .eq("id", pieza.task_id)
      .maybeSingle();
    responsableTarea = (data as { asignado_a_id: string | null } | null)?.asignado_a_id ?? null;
  }
  const destinos = [...new Set([pieza.creado_por_id, pieza.audiovisual_id, responsableTarea])].filter(
    (u): u is string => !!u && u !== yo
  );
  if (!destinos.length) return;
  await admin.from("notifications").insert(
    destinos.map((user_id) => ({
      user_id,
      tipo: "recordatorio" as const,
      mensaje,
      link: `/contenidos?pub=${pieza.id}`,
      ...(pieza.task_id ? { task_id: pieza.task_id } : {}),
    }))
  );
}

/**
 * Aprobar una pieza desde la bandeja.
 *
 * Si es una idea, la manda a producir. Si es la pieza terminada, la programa y
 * la deja en el Drive del cliente — y ahí el link del Drive/Canva es
 * obligatorio: se puede cargar en el mismo movimiento (`assetUrl`).
 */
export async function aprobarPieza(id: string, assetUrl?: string | null) {
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const pieza = await piezaParaDecidir(id);
  if (!pieza) return { error: "No encontré la pieza." };

  const link = assetUrl?.trim() || null;
  if (link && link !== pieza.asset_url) {
    const { error } = await writeDb().from("publications").update({ asset_url: link }).eq("id", id);
    if (error) return { error: error.message };
    pieza.asset_url = link;
  }

  const motivo = motivoParaNoAprobar(pieza);
  if (motivo) return { error: motivo, faltaArchivo: !motivo.startsWith("Esta pieza") };
  const destino = destinoAlAprobar(pieza);
  if (!destino) return { error: "Esta pieza no está esperando una aprobación." };

  // La nota de revisión se limpia: si quedó escrita la corrección anterior, en
  // la próxima vuelta parece que todavía hay algo pendiente.
  return changePublicationStatus(id, destino, "");
}

/**
 * Devolver una pieza con correcciones escritas.
 *
 * La idea vuelve a quedar como idea (con la nota a la vista, para que se
 * corrija el texto y se vuelva a mirar); la pieza terminada pasa a "Cambios
 * pedidos", que es lo que mira quien la produjo.
 */
export async function corregirPieza(id: string, nota: string) {
  const texto = nota.trim();
  if (texto.length < 5) {
    return { error: "Escribí qué hay que corregir: sin eso el equipo tiene que adivinar." };
  }
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };
  const { userId } = await ctx();
  const pieza = await piezaParaDecidir(id);
  if (!pieza) return { error: "No encontré la pieza." };
  if (pieza.estado !== "idea" && pieza.estado !== "revision_creativa") {
    return { error: "Esta pieza no está esperando una aprobación." };
  }

  const nuevoEstado = pieza.estado === "idea" ? "idea" : "rechazado";
  const { error } = await writeDb()
    .from("publications")
    .update({ estado: nuevoEstado, notas_revision: texto })
    .eq("id", id);
  if (error) return { error: error.message };

  await avisarDeLaPieza(
    pieza,
    userId,
    `✏️ Correcciones en "${pieza.titulo ?? "una pieza"}": ${texto.slice(0, 120)}${texto.length > 120 ? "…" : ""}`
  );
  invalidate(pieza.cliente_id);
  return { ok: true };
}

/**
 * Aprobar de una vez todas las ideas que se le pasen.
 *
 * Es el botón que pidió Luz: mirar el mes entero y darle el visto bueno de un
 * saque. Solo ideas — las piezas terminadas necesitan su archivo, así que esas
 * siguen yendo de a una.
 */
export async function aprobarIdeasEnBloque(ids: string[]) {
  if (!ids.length) return { ok: true, aprobadas: 0 };
  const gate = await ensureCalendarEditor();
  if (gate) return { error: gate };

  const { data } = await writeDb()
    .from("publications")
    .select("id, estado, tipo, cliente_id")
    .in("id", ids);
  const piezas = (data ?? []) as { id: string; estado: string; tipo: string | null; cliente_id: string }[];
  const { ideas } = bandejaDeAprobacion(piezas);
  if (!ideas.length) return { error: "Ninguna de esas piezas es una idea esperando aprobación." };

  // Las ideas de posteo van a diseño y las de reel a edición: se agrupan por
  // destino para no hacer un update por pieza.
  const porDestino = new Map<string, string[]>();
  for (const p of ideas) {
    const destino = destinoAlAprobar(p);
    if (!destino) continue;
    porDestino.set(destino, [...(porDestino.get(destino) ?? []), p.id]);
  }
  for (const [destino, lista] of porDestino) {
    const { error } = await writeDb()
      .from("publications")
      .update({ estado: destino, notas_revision: null })
      .in("id", lista);
    if (error) return { error: error.message };
  }
  invalidate(piezas[0]?.cliente_id);
  return { ok: true, aprobadas: ideas.length };
}
