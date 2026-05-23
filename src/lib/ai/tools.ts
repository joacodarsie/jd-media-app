import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tool definitions for the AI assistant.
 * Tools operate via the authenticated user's Supabase client,
 * so RLS automatically scopes what the AI can read/write.
 */

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_tasks",
    description:
      "Lista tareas de la agencia con filtros opcionales. Si no se pasa ningún filtro, devuelve las tareas activas (no completadas) del usuario actual.",
    input_schema: {
      type: "object",
      properties: {
        asignado_a_nombre: {
          type: "string",
          description: "Filtrar por nombre del responsable (búsqueda parcial, case-insensitive). Ej: 'Luz' para Luz Torres.",
        },
        cliente_nombre: {
          type: "string",
          description: "Filtrar por nombre del cliente (búsqueda parcial). Ej: 'Boxescar'.",
        },
        estado: {
          type: "string",
          enum: ["pendiente", "en_progreso", "en_revision", "completada", "bloqueada"],
          description: "Filtrar por estado.",
        },
        area: {
          type: "string",
          description: "Filtrar por área. Ej: 'Paid Media', 'Creativas'.",
        },
        solo_vencidas: {
          type: "boolean",
          description: "Si es true, solo trae tareas con fecha límite pasada y no completadas.",
        },
        limit: {
          type: "integer",
          description: "Cantidad máxima de tareas a devolver (default 20, max 50).",
        },
      },
    },
  },
  {
    name: "create_task",
    description:
      "Crea una nueva tarea. Para asignar a alguien o vincular a un cliente, primero usá list_users o list_clients para obtener los IDs si no los tenés.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título breve de la tarea." },
        descripcion: { type: "string", description: "Descripción detallada (markdown OK)." },
        asignado_a_nombre: {
          type: "string",
          description: "Nombre del responsable. Match parcial (ej: 'Luz').",
        },
        cliente_nombre: {
          type: "string",
          description: "Nombre del cliente al que pertenece (opcional).",
        },
        area: {
          type: "string",
          description: "Área. Default 'Creativas'.",
        },
        prioridad: {
          type: "string",
          enum: ["baja", "media", "alta", "urgente"],
          description: "Prioridad. Default 'media'.",
        },
        fecha_limite: {
          type: "string",
          description: "Fecha límite en formato YYYY-MM-DD. Ej: '2026-06-15'.",
        },
      },
      required: ["titulo"],
    },
  },
  {
    name: "update_task_status",
    description: "Cambia el estado de una tarea existente. Necesitás el ID o el título exacto.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID de la tarea." },
        task_titulo: { type: "string", description: "Si no tenés el ID, pasá el título exacto." },
        nuevo_estado: {
          type: "string",
          enum: ["pendiente", "en_progreso", "en_revision", "completada", "bloqueada"],
        },
      },
      required: ["nuevo_estado"],
    },
  },
  {
    name: "list_clients",
    description: "Lista clientes con info básica (nombre, pack, estado, responsable).",
    input_schema: {
      type: "object",
      properties: {
        solo_activos: { type: "boolean", description: "Si es true, solo clientes con estado='activo'." },
      },
    },
  },
  {
    name: "get_client",
    description:
      "Devuelve toda la información de un cliente (links, contacto, notas, tareas activas, calendario).",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del cliente (match parcial)." },
      },
      required: ["nombre"],
    },
  },
  {
    name: "list_users",
    description: "Lista los miembros del equipo (id, nombre, área, puesto).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_publications",
    description: "Lista publicaciones del calendario de contenidos con filtros.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string" },
        estado: {
          type: "string",
          enum: [
            "idea", "en_diseno", "guion", "edicion",
            "revision_creativa", "revision_cliente",
            "aprobado", "publicado", "rechazado",
          ],
        },
        desde: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
      },
    },
  },
  {
    name: "search_processes",
    description:
      "Busca en las páginas de procesos/SOPs/agencia (onboarding cliente, cadena mensajes, buyer persona, etc.) por palabra clave o tema.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Palabras clave a buscar." },
      },
      required: ["query"],
    },
  },
  {
    name: "summarize_my_day",
    description:
      "Devuelve un snapshot del día del usuario actual: tareas pendientes, vencidas, próximas a vencer (≤3 días), tareas en revisión, publicaciones de la semana. Usalo cuando el usuario pregunta 'qué tengo hoy', 'resumime el día', 'qué hago primero'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "suggest_reassignments",
    description:
      "Analiza la carga de cada persona del equipo (tareas activas, vencidas) e identifica sobrecargados (>8 activas o ≥2 vencidas). Sugerí redistribuir si corresponde. Sólo para coordinación/admin.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "client_brand_context",
    description:
      "Devuelve contexto de marca para redactar copy de un cliente: notas del cliente, rubro, pack, buyer persona y tono extraídos de las páginas de agencia. Usalo ANTES de escribir copy/guion para una publicación, así el resultado respeta la voz del cliente.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string" },
      },
      required: ["cliente_nombre"],
    },
  },
  {
    name: "list_leads",
    description:
      "Lista leads del pipeline comercial. Filtros opcionales por stage (nuevo, contactado, calificado, propuesta, negociacion, ganado, perdido), asignado_a_nombre (parcial), o solo_activos (excluye ganados y perdidos). Útil para preguntas como '¿qué leads tiene Sol?', '¿cuántos leads están en propuesta?', 'pipeline activo'.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string" },
        asignado_a_nombre: { type: "string" },
        solo_activos: { type: "boolean" },
        limit: { type: "number" },
      },
    },
  },
];

type Result = { ok: true; data: unknown } | { ok: false; error: string };

async function findUserId(sb: SupabaseClient, nameLike: string): Promise<string | null> {
  const { data } = await sb
    .from("users")
    .select("id, nombre")
    .ilike("nombre", `%${nameLike}%`)
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findClientId(sb: SupabaseClient, nameLike: string): Promise<string | null> {
  const { data } = await sb
    .from("clients")
    .select("id")
    .ilike("nombre", `%${nameLike}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  currentUserId: string
): Promise<Result> {
  const sb = createClient();
  try {
    switch (name) {
      case "list_tasks": {
        let q = sb
          .from("tasks")
          .select("id, titulo, estado, prioridad, fecha_limite, area, cliente:clients(nombre), asignado:users!tasks_asignado_a_id_fkey(nombre)")
          .order("fecha_limite", { ascending: true, nullsFirst: false })
          .limit(Math.min(Number(input.limit ?? 20), 50));

        if (input.asignado_a_nombre) {
          const uid = await findUserId(sb, String(input.asignado_a_nombre));
          if (uid) q = q.eq("asignado_a_id", uid);
        } else if (!input.cliente_nombre && !input.estado && !input.area && !input.solo_vencidas) {
          q = q.eq("asignado_a_id", currentUserId).neq("estado", "completada");
        }
        if (input.cliente_nombre) {
          const cid = await findClientId(sb, String(input.cliente_nombre));
          if (cid) q = q.eq("cliente_id", cid);
        }
        if (input.estado) q = q.eq("estado", String(input.estado));
        if (input.area) q = q.eq("area", String(input.area));
        if (input.solo_vencidas) {
          q = q.lt("fecha_limite", new Date().toISOString()).neq("estado", "completada");
        }
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "create_task": {
        let asignado_a_id: string | null = null;
        if (input.asignado_a_nombre) {
          asignado_a_id = await findUserId(sb, String(input.asignado_a_nombre));
          if (!asignado_a_id) return { ok: false, error: `No encontré usuario llamado "${input.asignado_a_nombre}"` };
        }
        let cliente_id: string | null = null;
        if (input.cliente_nombre) {
          cliente_id = await findClientId(sb, String(input.cliente_nombre));
          if (!cliente_id) return { ok: false, error: `No encontré cliente llamado "${input.cliente_nombre}"` };
        }
        const { data, error } = await sb.from("tasks").insert({
          titulo: input.titulo,
          descripcion: input.descripcion ?? null,
          asignado_a_id,
          creado_por_id: currentUserId,
          cliente_id,
          area: input.area ?? "Creativas",
          prioridad: input.prioridad ?? "media",
          fecha_limite: input.fecha_limite ?? null,
        }).select("id, titulo").single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "update_task_status": {
        let id = input.task_id as string | undefined;
        if (!id && input.task_titulo) {
          const { data } = await sb.from("tasks").select("id").eq("titulo", input.task_titulo).limit(1).maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la tarea." };
        const { error } = await sb.from("tasks").update({ estado: input.nuevo_estado }).eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nuevo_estado: input.nuevo_estado } };
      }

      case "list_clients": {
        let q = sb.from("clients")
          .select("id, nombre, pack, estado, contacto_nombre, creativa:users!clients_creativa_asignada_id_fkey(nombre)")
          .order("nombre");
        if (input.solo_activos) q = q.eq("estado", "activo");
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "get_client": {
        const { data: client, error } = await sb.from("clients")
          .select("*, creativa:users!clients_creativa_asignada_id_fkey(nombre)")
          .ilike("nombre", `%${input.nombre}%`)
          .limit(1).maybeSingle();
        if (error) return { ok: false, error: error.message };
        if (!client) return { ok: false, error: "Cliente no encontrado" };
        const { data: tasks } = await sb.from("tasks")
          .select("id, titulo, estado, fecha_limite, asignado:users!tasks_asignado_a_id_fkey(nombre)")
          .eq("cliente_id", client.id)
          .neq("estado", "completada")
          .order("fecha_limite", { ascending: true, nullsFirst: false })
          .limit(20);
        return { ok: true, data: { ...client, tareas_activas: tasks ?? [] } };
      }

      case "list_users": {
        const { data, error } = await sb.from("users")
          .select("id, nombre, area, rol, position:positions(nombre)")
          .eq("activo", true)
          .order("nombre");
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "list_publications": {
        let q = sb.from("publications")
          .select("id, titulo, estado, red, tipo, fecha_publicacion, cliente:clients(nombre), creador:users!publications_creado_por_id_fkey(nombre)")
          .order("fecha_publicacion", { ascending: true, nullsFirst: false })
          .limit(40);
        if (input.cliente_nombre) {
          const cid = await findClientId(sb, String(input.cliente_nombre));
          if (cid) q = q.eq("cliente_id", cid);
        }
        if (input.estado) q = q.eq("estado", String(input.estado));
        if (input.desde) q = q.gte("fecha_publicacion", String(input.desde));
        if (input.hasta) q = q.lte("fecha_publicacion", String(input.hasta));
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "search_processes": {
        const query = String(input.query ?? "").trim();
        if (!query) return { ok: false, error: "Falta query." };
        const { data, error } = await sb.from("agency_pages")
          .select("slug, title, kind, content")
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(5);
        if (error) return { ok: false, error: error.message };
        const snippets = (data ?? []).map((p) => ({
          slug: p.slug,
          title: p.title,
          kind: p.kind,
          excerpt: p.content.slice(0, 1500),
        }));
        return { ok: true, data: snippets };
      }

      case "summarize_my_day": {
        const today = new Date();
        const in3 = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
        const in7 = new Date(today.getTime() + 7 * 86400000);
        const todayStr = today.toISOString().slice(0, 10);

        const [{ data: mias }, { data: pubs }] = await Promise.all([
          sb.from("tasks")
            .select("id, titulo, estado, prioridad, fecha_limite, cliente:clients(nombre)")
            .eq("asignado_a_id", currentUserId)
            .neq("estado", "completada")
            .order("fecha_limite", { ascending: true, nullsFirst: false })
            .limit(50),
          sb.from("publications")
            .select("id, titulo, estado, fecha_publicacion, cliente:clients(nombre)")
            .or(`creado_por_id.eq.${currentUserId},audiovisual_id.eq.${currentUserId}`)
            .gte("fecha_publicacion", today.toISOString())
            .lte("fecha_publicacion", in7.toISOString())
            .order("fecha_publicacion", { ascending: true })
            .limit(15),
        ]);

        const tasks = mias ?? [];
        const vencidas = tasks.filter((t) => t.fecha_limite && t.fecha_limite < todayStr);
        const hoy = tasks.filter((t) => t.fecha_limite === todayStr);
        const proximas = tasks.filter(
          (t) => t.fecha_limite && t.fecha_limite > todayStr && t.fecha_limite <= in3
        );
        const enRevision = tasks.filter((t) => t.estado === "en_revision");

        return {
          ok: true,
          data: {
            fecha: todayStr,
            total_activas: tasks.length,
            vencidas,
            hoy,
            proximas_3_dias: proximas,
            en_revision: enRevision,
            publicaciones_semana: pubs ?? [],
          },
        };
      }

      case "suggest_reassignments": {
        const [{ data: tasks }, { data: users }] = await Promise.all([
          sb.from("tasks")
            .select("id, asignado_a_id, estado, fecha_limite, area")
            .neq("estado", "completada"),
          sb.from("users")
            .select("id, nombre, area")
            .eq("activo", true),
        ]);
        const today = new Date().toISOString().slice(0, 10);
        const porUser = new Map<string, { nombre: string; area: string; activas: number; vencidas: number }>();
        for (const u of users ?? []) {
          porUser.set(u.id, { nombre: u.nombre, area: u.area, activas: 0, vencidas: 0 });
        }
        for (const t of tasks ?? []) {
          if (!t.asignado_a_id) continue;
          const e = porUser.get(t.asignado_a_id);
          if (!e) continue;
          e.activas += 1;
          if (t.fecha_limite && t.fecha_limite < today) e.vencidas += 1;
        }
        const ranking = Array.from(porUser.entries()).map(([id, v]) => ({ id, ...v }));
        ranking.sort((a, b) => b.activas - a.activas);
        const sobrecargados = ranking.filter((r) => r.activas > 8 || r.vencidas >= 2);
        const disponibles = ranking.filter((r) => r.activas <= 4 && r.vencidas === 0);
        return {
          ok: true,
          data: {
            sobrecargados,
            disponibles,
            ranking_top5: ranking.slice(0, 5),
            criterio: "sobrecargado: >8 activas o ≥2 vencidas. disponible: ≤4 activas y 0 vencidas.",
          },
        };
      }

      case "client_brand_context": {
        const { data: client } = await sb.from("clients")
          .select("id, nombre, rubro, pack, notas")
          .ilike("nombre", `%${input.cliente_nombre}%`)
          .limit(1).maybeSingle();
        if (!client) return { ok: false, error: "Cliente no encontrado" };

        // Páginas de agencia relevantes para tono/buyer persona
        const { data: pages } = await sb.from("agency_pages")
          .select("slug, title, content")
          .or("slug.ilike.%buyer%,slug.ilike.%tono%,slug.ilike.%persona%,title.ilike.%buyer%,title.ilike.%tono%,title.ilike.%persona%")
          .limit(5);

        return {
          ok: true,
          data: {
            cliente: client,
            referencias: (pages ?? []).map((p) => ({
              slug: p.slug,
              title: p.title,
              excerpt: (p.content ?? "").slice(0, 1200),
            })),
          },
        };
      }

      case "list_leads": {
        let q = sb
          .from("leads")
          .select(
            "id, nombre, empresa, email, telefono, stage, monto_estimado, moneda, servicio_interesado, proxima_accion, proxima_accion_at, asignado:users!leads_asignado_a_id_fkey(nombre), servicio:services(name)"
          )
          .order("updated_at", { ascending: false })
          .limit(Math.min(Number(input.limit ?? 30), 100));
        if (input.stage) q = q.eq("stage", String(input.stage));
        if (input.asignado_a_nombre) {
          const uid = await findUserId(sb, String(input.asignado_a_nombre));
          if (uid) q = q.eq("asignado_a_id", uid);
        }
        if (input.solo_activos) {
          q = q.not("stage", "in", "(ganado,perdido)");
        }
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      default:
        return { ok: false, error: `Tool desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
