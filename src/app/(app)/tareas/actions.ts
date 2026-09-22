"use server";

import { revalidatePath } from "next/cache";
import { ensureTicketDriveFolder } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import type { TaskLink } from "@/lib/types";
import { motivoParaNoCerrarTareas } from "@/lib/contenidos/archivo-final-db";
import { avisosDeCambio, type EstadoTarea } from "@/lib/tareas/avisos";
import { validarFechaLimite } from "@/lib/tareas/fecha-limite";
import {
  motivoParaNoReasignar,
  puedeRepartir,
  requiereAprobacion,
  responsableAlCrear,
  type Actor,
} from "@/lib/tareas/puerta";
import { personasClave } from "@/lib/tareas/personas-clave";

async function uid() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

/** Quién está haciendo el cambio, con su rol: lo piden las reglas de la puerta. */
async function actorDe(userId: string): Promise<Actor> {
  const { data } = await createAdmin().from("users").select("rol").eq("id", userId).maybeSingle();
  return { id: userId, rol: (data as { rol: string } | null)?.rol ?? null };
}

/**
 * Lo de antes de septiembre se cierra como siempre (mismo corte que la 0173):
 * son tareas viejas que no van a ir a ningún cliente.
 */
const APROBACION_DESDE = "2026-09-01";

/**
 * Si quien produce marca "Completada" algo que tiene que aprobar la directora,
 * se manda a revisión en vez de cerrarse. La base hace lo mismo (0173); acá se
 * resuelve antes para poder decírselo a la persona en vez de que vea un estado
 * distinto al que eligió sin explicación.
 */
function estadoConAprobacion(
  estado: string,
  t: { area: string | null; fecha_limite: string | null; estado: string; aprobador_id: string | null },
  actor: Actor,
  directoraId: string | null
): { estado: string; aviso?: string } {
  if (estado !== "completada" || t.estado === "completada") return { estado };
  if (!requiereAprobacion(t.area)) return { estado };
  if ((t.fecha_limite ?? "9999") < APROBACION_DESDE) return { estado };
  const aprobadora = t.aprobador_id ?? directoraId;
  if (actor.rol === "admin" || actor.id === aprobadora || actor.id === directoraId) return { estado };
  return {
    estado: "en_revision",
    aviso: "Quedó En revisión: los diseños los aprueba la dirección creativa antes de ir al cliente.",
  };
}

export async function createTask(input: {
  titulo: string;
  descripcion: string;
  asignado_a_id: string | null;
  cliente_id: string | null;
  area: string;
  prioridad: string;
  fecha_limite: string | null;
  aprobador_id?: string | null;
  requiere_aprobacion?: boolean;
  /** Si viene, la tarea nace como subtarea de ese ticket. */
  parent_id?: string | null;
  /** Links de referencia, ya normalizados (lib/tareas/links). */
  links?: TaskLink[];
  /**
   * Si viene, la tarea es una PIEZA: además del ticket se crea la publicación
   * en el calendario de contenidos, ya linkeada (`publications.task_id`). El
   * trigger que genera una tarea por cada pieza no duplica nada porque la
   * publicación nace con su `task_id` puesto.
   */
  pieza?: { tipo: string; red: string; fecha_publicacion: string | null } | null;
  /**
   * El desglose, cargado en el mismo formulario: el ticket nace con sus
   * subtareas. Heredan cliente, área y prioridad del ticket; si no traen
   * responsable o fecha, usan los del ticket.
   */
  subtareas?: {
    titulo: string;
    descripcion?: string | null;
    asignado_a_id?: string | null;
    fecha_limite?: string | null;
    links?: TaskLink[];
    /**
     * La subtarea es además una PIEZA del calendario. Es el caso normal de
     * un ticket de contenido: el ticket es la quincena y cada subtarea es un
     * posteo con su fecha (pedido del 20/9).
     */
    pieza?: { tipo: string; red: string; fecha_publicacion: string } | null;
  }[];
}) {
  const { supabase, userId } = await uid();
  // Toda tarea lleva fecha límite: sin ella no aparece en el aviso diario y
  // deja de existir para todos. Se valida acá y no solo en el formulario
  // porque este es el único paso por el que pasan todas.
  const fecha = validarFechaLimite(input.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };

  // Una sola puerta: community, diseño y edición le llegan a la PM, que reparte.
  // Si la tarea nace adentro de un ticket, manda el área del ticket.
  const [actor, clave] = await Promise.all([actorDe(userId), personasClave()]);
  let areaEfectiva = input.area;
  if (input.parent_id) {
    const { data: m } = await createAdmin().from("tasks").select("area").eq("id", input.parent_id).maybeSingle();
    areaEfectiva = (m as { area: string } | null)?.area ?? input.area;
  }
  const alCrear = (elegido: string | null) =>
    responsableAlCrear({ area: areaEfectiva, elegido, actor, pmId: clave.pmId });
  input = { ...input, asignado_a_id: alCrear(input.asignado_a_id || null) };
  // Diseño y edición los aprueba la directora: no se elige a mano.
  if (requiereAprobacion(areaEfectiva)) {
    input = { ...input, aprobador_id: null, requiere_aprobacion: false };
  }

  const subtareas = (input.subtareas ?? [])
    .filter((s) => s.titulo.trim())
    .map((s) => ({ ...s, asignado_a_id: alCrear(s.asignado_a_id || null) }));
  if (subtareas.length && input.parent_id) {
    return { error: "Una subtarea no puede tener su propio desglose: cargá las subtareas en el ticket." };
  }
  // Las fechas de las subtareas se validan ANTES de crear nada, así un error en
  // la quinta no deja un ticket a medio cargar.
  const fechasSub: string[] = [];
  for (const s of subtareas) {
    const f = validarFechaLimite(s.fecha_limite || fecha.fecha);
    if (!f.ok) return { error: `Subtarea "${s.titulo.trim()}": ${f.error}` };
    fechasSub.push(f.fecha!);
  }

  const { data: creada, error } = await supabase
    .from("tasks")
    .insert({
      titulo: input.titulo,
      descripcion: input.descripcion || null,
      asignado_a_id: input.asignado_a_id || null,
      creado_por_id: userId,
      cliente_id: input.cliente_id || null,
      area: input.area,
      prioridad: input.prioridad,
      fecha_limite: fecha.fecha,
      aprobador_id: input.aprobador_id || null,
      requiere_aprobacion: input.requiere_aprobacion ?? !!input.aprobador_id,
      // El trigger de la 0165 rechaza anidar una subtarea dentro de otra; acá
      // solo se pasa lo que eligieron.
      parent_id: input.parent_id || null,
      ...(input.links?.length ? { links: input.links } : {}),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const id = (creada as { id: string }).id;

  let subPiezasError: string | null = null;
  if (subtareas.length) {
    const { data: filasSub, error: errSubs } = await supabase.from("tasks").insert(
      subtareas.map((s, i) => ({
        titulo: s.titulo.trim(),
        descripcion: s.descripcion?.trim() || null,
        asignado_a_id: s.asignado_a_id || input.asignado_a_id || null,
        creado_por_id: userId,
        cliente_id: input.cliente_id || null,
        area: input.area,
        prioridad: input.prioridad,
        fecha_limite: fechasSub[i],
        parent_id: id,
        ...(s.links?.length ? { links: s.links } : {}),
      }))
    ).select("id");
    if (errSubs) {
      return { error: `El ticket se creó, pero no las subtareas: ${errSubs.message}`, id };
    }

    // Las subtareas que además son posteos van al calendario, cada una con su
    // fecha y atada a SU subtarea (no al ticket): así el ticket es la quincena
    // y cada pieza avanza por su cuenta. El insert vuelve en el mismo orden
    // que se mandó; si no coincide la cantidad no se cuelga nada, para no
    // atar una pieza a la subtarea equivocada.
    const idsSub = ((filasSub ?? []) as { id: string }[]).map((x) => x.id);
    const conPieza = subtareas
      .map((sub, i) => ({ sub, i }))
      .filter((x) => x.sub.pieza && x.sub.pieza.fecha_publicacion);
    if (conPieza.length && input.cliente_id && idsSub.length === subtareas.length) {
      const { error: errPubs } = await supabase.from("publications").insert(
        conPieza.map(({ sub, i }) => ({
          cliente_id: input.cliente_id,
          titulo: sub.titulo.trim(),
          descripcion: sub.descripcion?.trim() || null,
          tipo: sub.pieza!.tipo,
          red: sub.pieza!.red,
          fecha_publicacion: sub.pieza!.fecha_publicacion,
          task_id: idsSub[i],
          creado_por_id: userId,
        }))
      );
      if (errPubs) subPiezasError = errPubs.message;
      else revalidatePath("/contenidos");
    }
    if (input.cliente_id) {
      try {
        await ensureDriveFolder(id);
      } catch (e) {
        console.error("createTask → carpeta de Drive:", e);
      }
    }
  }

  // La pieza en el calendario. Si falla, el ticket ya existe: se avisa y no se
  // pierde lo cargado.
  let piezaError: string | null = null;
  if (input.pieza && input.cliente_id) {
    const { error: errPub } = await supabase.from("publications").insert({
      cliente_id: input.cliente_id,
      titulo: input.titulo,
      descripcion: input.descripcion || null,
      tipo: input.pieza.tipo,
      red: input.pieza.red,
      fecha_publicacion: input.pieza.fecha_publicacion || null,
      task_id: id,
      creado_por_id: userId,
    });
    if (errPub) piezaError = errPub.message;
    else revalidatePath("/contenidos");
  }

  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  const falloPieza = piezaError ?? subPiezasError;
  if (falloPieza) {
    return {
      ok: true,
      id,
      aviso: `La tarea se creó, pero no la pieza en el calendario: ${falloPieza}`,
    };
  }
  return { ok: true, id };
}


/**
 * Agrega una subtarea a un ticket madre.
 *
 * Hereda cliente, área y prioridad de la madre en vez de pedirlos de nuevo: son
 * los mismos por definición —el desglose de un ticket pertenece a la misma
 * cuenta y al mismo trabajo— y cada campo extra en el formulario es una excusa
 * más para no cargar el desglose.
 *
 * El responsable y la fecha SÍ se piden: es justo lo que cambia entre una
 * subtarea y otra (la CM arma el ticket, Luz reparte a diseño y a edición con
 * fechas de entrega distintas). Si no se eligen, arrancan como los de la madre.
 */
export async function addSubtarea(input: {
  parentId: string;
  titulo: string;
  descripcion?: string | null;
  asignado_a_id?: string | null;
  fecha_limite?: string | null;
  /** Links de referencia, ya normalizados (lib/tareas/links). */
  links?: TaskLink[];
}) {
  const { supabase, userId } = await uid();
  if (!input.titulo.trim()) return { error: "Falta el título de la subtarea." };

  const { data: madre, error: errMadre } = await supabase
    .from("tasks")
    .select("id, cliente_id, area, prioridad, asignado_a_id, fecha_limite, parent_id")
    .eq("id", input.parentId)
    .maybeSingle();
  if (errMadre) return { error: errMadre.message };
  if (!madre) return { error: "No encontré el ticket." };
  // La base también lo impide (trigger de la 0165); acá damos el mensaje bueno.
  if ((madre as { parent_id: string | null }).parent_id) {
    return { error: "Esto ya es una subtarea: no se puede anidar otra adentro." };
  }

  const m = madre as {
    cliente_id: string | null;
    area: string;
    prioridad: string;
    asignado_a_id: string | null;
    fecha_limite: string | null;
  };

  const fecha = validarFechaLimite(input.fecha_limite ?? m.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };

  const [actor, clave] = await Promise.all([actorDe(userId), personasClave()]);
  const responsable = responsableAlCrear({
    area: m.area,
    elegido: input.asignado_a_id || m.asignado_a_id || null,
    actor,
    pmId: clave.pmId,
  });

  const { error } = await supabase.from("tasks").insert({
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    asignado_a_id: responsable,
    creado_por_id: userId,
    cliente_id: m.cliente_id,
    area: m.area,
    prioridad: m.prioridad,
    fecha_limite: fecha.fecha,
    parent_id: input.parentId,
    ...(input.links?.length ? { links: input.links } : {}),
  });
  if (error) return { error: error.message };

  // La carpeta de Drive del ticket, al agregar la PRIMERA subtarea: es cuando
  // el ticket pasa a tener piezas que subir. Best-effort a propósito — si Drive
  // falla, el desglose se cargó igual y el botón del ticket la crea después.
  try {
    await ensureDriveFolder(input.parentId);
  } catch (e) {
    console.error("addSubtarea → carpeta de Drive:", e);
  }

  revalidatePath("/tareas");
  revalidatePath(`/tareas/${input.parentId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}


/**
 * La carpeta de Drive del ticket: la crea si falta, devuelve el link si ya está.
 *
 * Se llama sola al agregar la primera subtarea —que es cuando el ticket pasa a
 * tener piezas que subir— y también desde el botón del ticket, para los casos
 * en que Drive falló o el ticket no tiene desglose.
 *
 * Guarda el link en la tarea para no tener que volver a preguntarle a Drive.
 */
export async function ensureDriveFolder(taskId: string) {
  const { supabase } = await uid();

  const { data: t, error } = await supabase
    .from("tasks")
    .select("id, numero, titulo, drive_url, cliente:clients(nombre, drive_url)")
    .eq("id", taskId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!t) return { error: "No encontré el ticket." };

  const row = t as unknown as {
    numero: number | null;
    titulo: string;
    drive_url: string | null;
    cliente: { nombre: string; drive_url: string | null } | null;
  };
  if (row.drive_url) return { ok: true, url: row.drive_url, creada: false };
  if (!row.cliente) {
    return { error: "El ticket no tiene cuenta asignada: no hay Drive donde crearla." };
  }

  const res = await ensureTicketDriveFolder({
    clienteDriveUrl: row.cliente.drive_url,
    numero: row.numero,
    titulo: row.titulo,
  });
  if ("error" in res) return { error: res.error };

  await supabase.from("tasks").update({ drive_url: res.url }).eq("id", taskId);
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true, url: res.url, creada: res.creada };
}

export async function updateTaskStatus(id: string, estadoPedido: string) {
  const { supabase, userId } = await uid();
  const [actor, clave, { data: actual }] = await Promise.all([
    actorDe(userId),
    personasClave(),
    createAdmin().from("tasks").select("area, fecha_limite, estado, aprobador_id").eq("id", id).maybeSingle(),
  ]);
  const { estado, aviso } = actual
    ? estadoConAprobacion(estadoPedido, actual as Parameters<typeof estadoConAprobacion>[1], actor, clave.directoraId)
    : { estado: estadoPedido, aviso: undefined };
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), [id], estado);
  if (bloqueo) return { error: bloqueo };
  const { error } = await supabase
    .from("tasks")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  revalidatePath(`/tareas/${id}`);
  return { ok: true, estado, aviso };
}

export async function updateTask(
  id: string,
  input: {
    titulo: string;
    descripcion: string;
    asignado_a_id: string | null;
    cliente_id: string | null;
    area: string;
    prioridad: string;
    estado: string;
    fecha_limite: string | null;
    aprobador_id?: string | null;
    requiere_aprobacion?: boolean;
  }
) {
  const { supabase, userId } = await uid();
  // Cómo estaba la tarea, para saber QUÉ cambió y a quién avisarle.
  const { data: antesRaw } = await supabase
    .from("tasks")
    .select("asignado_a_id, fecha_limite, estado, prioridad, titulo, area, aprobador_id")
    .eq("id", id)
    .maybeSingle();
  const antesT = antesRaw as
    | (EstadoTarea & { area: string | null; aprobador_id: string | null })
    | null;

  const [actor, clave] = await Promise.all([actorDe(userId), personasClave()]);
  const noReasignar = motivoParaNoReasignar({
    area: input.area,
    antes: antesT?.asignado_a_id ?? null,
    despues: input.asignado_a_id || null,
    actor,
    pmId: clave.pmId,
    pmNombre: clave.pmNombre,
  });
  if (noReasignar) return { error: noReasignar };

  const { estado, aviso } = antesT
    ? estadoConAprobacion(input.estado, { ...antesT, area: input.area }, actor, clave.directoraId)
    : { estado: input.estado, aviso: undefined };

  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), [id], estado);
  if (bloqueo) return { error: bloqueo };
  // Editar una tarea tampoco puede dejarla sin fecha.
  const fecha = validarFechaLimite(input.fecha_limite);
  if (!fecha.ok) return { error: fecha.error! };
  const { error } = await supabase
    .from("tasks")
    .update({
      titulo: input.titulo,
      descripcion: input.descripcion || null,
      asignado_a_id: input.asignado_a_id || null,
      cliente_id: input.cliente_id || null,
      area: input.area,
      prioridad: input.prioridad,
      estado,
      fecha_limite: fecha.fecha,
      // En diseño y edición la aprobadora la pone la base al pasar a revisión:
      // el formulario no la ofrece, y mandar null acá la borraría.
      ...(requiereAprobacion(input.area)
        ? {}
        : {
            aprobador_id: input.aprobador_id || null,
            requiere_aprobacion: input.requiere_aprobacion ?? !!input.aprobador_id,
          }),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  revalidatePath(`/tareas/${id}`);

  // Los avisos van DESPUÉS de guardar y sin await: que falle una notificación
  // no puede hacer fracasar la edición de la tarea.
  if (antesRaw) {
    void avisarCambios(id, antesRaw as EstadoTarea, {
      asignado_a_id: input.asignado_a_id || null,
      fecha_limite: fecha.fecha ?? null,
      estado,
      prioridad: input.prioridad,
      titulo: input.titulo,
    }).catch((e) => console.error("avisarCambios:", e));
  }
  return { ok: true, estado, aviso };
}

export async function deleteTask(id: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Actualiza el estado de varias tareas a la vez (bulk action). */
export async function bulkUpdateTaskStatus(ids: string[], estado: string) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  // Si no, marcar 20 tareas de una era la puerta de atrás del candado.
  const bloqueo = await motivoParaNoCerrarTareas(createAdmin(), ids, estado);
  if (bloqueo) return { error: bloqueo };
  const { error } = await supabase
    .from("tasks")
    .update({ estado })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/** Elimina varias tareas a la vez (bulk action). */
export async function bulkDeleteTasks(ids: string[]) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const { error } = await supabase.from("tasks").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/**
 * Le pone la misma fecha límite a varias tareas (bulk action).
 *
 * Es la herramienta del triage de "Sin fecha": esas tareas existen pero nadie
 * las ve, y la salida es ponerles fecha o archivarlas. Sin esto había que
 * entrar de a una, y son decenas.
 */
export async function bulkSetDueDate(ids: string[], fechaLimite: string) {
  const { supabase } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const fecha = validarFechaLimite(fechaLimite);
  if (!fecha.ok) return { error: fecha.error! };
  const { error } = await supabase
    .from("tasks")
    .update({ fecha_limite: fecha.fecha })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

/** Reasigna varias tareas al mismo usuario (bulk action). */
export async function bulkReassignTasks(ids: string[], newUserId: string) {
  const { supabase, userId } = await uid();
  if (!ids.length) return { error: "Sin selección." };
  const [actor, clave, { data: filas }] = await Promise.all([
    actorDe(userId),
    personasClave(),
    createAdmin().from("tasks").select("area, asignado_a_id").in("id", ids),
  ]);
  if (!puedeRepartir(actor, clave.pmId)) {
    for (const f of (filas ?? []) as { area: string | null; asignado_a_id: string | null }[]) {
      const motivo = motivoParaNoReasignar({
        area: f.area,
        antes: f.asignado_a_id,
        despues: newUserId,
        actor,
        pmId: clave.pmId,
        pmNombre: clave.pmNombre,
      });
      if (motivo) return { error: motivo };
    }
  }
  const { error } = await supabase
    .from("tasks")
    .update({ asignado_a_id: newUserId })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/tareas");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

export async function saveLinks(id: string, links: TaskLink[]) {
  const { supabase } = await uid();
  const { error } = await supabase
    .from("tasks")
    .update({ links })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${id}`);
  return { ok: true };
}

export async function addComment(taskId: string, contenido: string) {
  const { supabase, userId } = await uid();
  const text = contenido.trim();
  if (!text) return { error: "Comentario vacío" };

  const { error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, user_id: userId, contenido: text });
  if (error) return { error: error.message };

  // Datos de la tarea para notificaciones
  const { data: task } = await supabase
    .from("tasks")
    .select("titulo, asignado_a_id, creado_por_id")
    .eq("id", taskId)
    .single();

  const { data: autor } = await supabase
    .from("users")
    .select("nombre")
    .eq("id", userId)
    .single();

  const notifs: {
    user_id: string;
    task_id: string;
    tipo: string;
    mensaje: string;
  }[] = [];

  // Menciones @Nombre
  const mentioned = Array.from(text.matchAll(/@([\p{L}]+)/gu)).map((m) =>
    m[1].toLowerCase()
  );
  if (mentioned.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, nombre")
      .eq("activo", true);
    for (const u of users ?? []) {
      const first = u.nombre.split(" ")[0].toLowerCase();
      if (mentioned.includes(first) && u.id !== userId) {
        notifs.push({
          user_id: u.id,
          task_id: taskId,
          tipo: "mencion",
          mensaje: `${autor?.nombre ?? "Alguien"} te mencionó en "${task?.titulo ?? "una tarea"}"`,
        });
      }
    }
  }

  // Aviso de comentario a asignado y creador (si no son el autor ni ya mencionados)
  const targets = new Set<string>();
  if (task?.asignado_a_id) targets.add(task.asignado_a_id);
  if (task?.creado_por_id) targets.add(task.creado_por_id);
  targets.delete(userId);
  for (const t of targets) {
    if (notifs.some((n) => n.user_id === t)) continue;
    notifs.push({
      user_id: t,
      task_id: taskId,
      tipo: "comentario",
      mensaje: `${autor?.nombre ?? "Alguien"} comentó en "${task?.titulo ?? "una tarea"}"`,
    });
  }

  // RLS de notifications restringe INSERT a auth.uid(). Para crear notifs
  // dirigidas a OTROS usuarios necesitamos service role.
  if (notifs.length) {
    const admin = createAdmin();
    await admin.from("notifications").insert(notifs);
  }

  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}

export async function deleteComment(id: string, taskId: string) {
  const { supabase } = await uid();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true };
}

/**
 * Manda los avisos de un cambio de tarea.
 *
 * La RLS de `notifications` restringe el INSERT a `auth.uid()`, así que para
 * escribirle a OTRA persona hay que ir por service role — igual que hace
 * `addComment` con las menciones.
 */
async function avisarCambios(taskId: string, antes: EstadoTarea, despues: EstadoTarea) {
  const { userId } = await uid();
  const admin = createAdmin();

  // Los seguidores explícitos. Si la migración 0168 no está aplicada la
  // consulta falla y se sigue sin ellos: los avisos de asignación y de fecha
  // no dependen de esta tabla.
  let seguidores: string[] = [];
  try {
    const { data } = await admin
      .from("task_watchers")
      .select("user_id")
      .eq("task_id", taskId);
    seguidores = ((data ?? []) as { user_id: string }[]).map((w) => w.user_id);
  } catch {
    /* sin la tabla, no hay seguidores */
  }

  const avisos = avisosDeCambio(antes, despues, userId, seguidores);
  if (avisos.length === 0) return;

  await admin.from("notifications").insert(
    avisos.map((a) => ({
      user_id: a.userId,
      task_id: taskId,
      // No hay tipo propio para "cambió la fecha": va como comentario, que es
      // el tipo genérico de "algo pasó en esta tarea".
      tipo: "comentario",
      mensaje: a.mensaje,
      link: `/tareas/${taskId}`,
    }))
  );
}

/** ¿Esta persona sigue el ticket? */
export async function toggleSeguirTarea(taskId: string, seguir: boolean) {
  const { supabase, userId } = await uid();
  if (seguir) {
    const { error } = await supabase
      .from("task_watchers")
      .upsert({ task_id: taskId, user_id: userId }, { onConflict: "task_id,user_id" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("task_watchers")
      .delete()
      .eq("task_id", taskId)
      .eq("user_id", userId);
    if (error) return { error: error.message };
  }
  revalidatePath(`/tareas/${taskId}`);
  return { ok: true, siguiendo: seguir };
}
