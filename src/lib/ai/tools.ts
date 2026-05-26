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
    name: "update_task_due_date",
    description:
      "Cambia la fecha límite de una tarea. Usalo cuando el usuario pida 'movéme la fecha de X al Y', 'reprogramá esa tarea', 'pasala para el miércoles', etc. Necesitás el ID o el título de la tarea.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID de la tarea." },
        task_titulo: {
          type: "string",
          description: "Si no tenés el ID, pasá el título exacto o búsqueda parcial.",
        },
        nueva_fecha: {
          type: "string",
          description:
            "Nueva fecha límite en formato YYYY-MM-DD (ej '2026-06-15'). Pasá una cadena vacía o null para quitar la fecha límite.",
        },
      },
      required: ["nueva_fecha"],
    },
  },
  {
    name: "update_task_priority",
    description:
      "Cambia la prioridad de una tarea. Útil para 'marcá esa tarea como urgente', 'bajá la prioridad de X'.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID de la tarea." },
        task_titulo: {
          type: "string",
          description: "Si no tenés el ID, pasá el título exacto o búsqueda parcial.",
        },
        nueva_prioridad: {
          type: "string",
          enum: ["baja", "media", "alta", "urgente"],
        },
      },
      required: ["nueva_prioridad"],
    },
  },
  {
    name: "reassign_task",
    description:
      "Reasigna una tarea a otra persona del equipo. Útil para 'pasáselo a X', 'que lo haga Y'. Necesitás el ID o título de la tarea y el nombre del nuevo responsable.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID de la tarea." },
        task_titulo: {
          type: "string",
          description: "Si no tenés el ID, pasá el título exacto o búsqueda parcial.",
        },
        nuevo_responsable_nombre: {
          type: "string",
          description: "Nombre del nuevo responsable (búsqueda parcial). Ej: 'Luz'.",
        },
      },
      required: ["nuevo_responsable_nombre"],
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
      "Devuelve el brief completo de un cliente para redactar copy, planear calendario o sugerir ideas. Trae DOS capas: (1) el **diagnóstico estratégico aprobado** (resumen ejecutivo, contexto, público objetivo con insight clave, marca/tono, diferenciales, pilares de contenido) — estable; (2) el **plan de contenido del período vigente** (resumen del mes, mix por red, distribución por pilar con %, temas destacados, campañas activas) — operativo. Usalo SIEMPRE antes de escribir copy/guion/calendario para un cliente. Si hay plan vigente, respetá su mix y sus temas destacados antes de inventar otros.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string" },
      },
      required: ["cliente_nombre"],
    },
  },
  {
    name: "list_services",
    description:
      "Devuelve el catálogo de servicios que ofrece la agencia (gestión de redes, paid media, producción de contenido, diseño gráfico, desarrollo web, botly). Cada servicio trae nombre, descripción, color y áreas/puestos que participan. Usalo cuando te pregunten qué ofrece la agencia, qué áreas trabajan un servicio, o necesites el slug exacto de un servicio.",
    input_schema: {
      type: "object",
      properties: {
        solo_activos: { type: "boolean" },
      },
    },
  },
  {
    name: "list_positions",
    description:
      "Devuelve los puestos del equipo con su descripción, área, servicios donde participan, modelo de pago default y personas asignadas (principal + secundarios). Usalo para preguntas como 'qué hace un CM', 'quién es director creativo', 'qué puesto tiene Bri', 'cuánto se paga a un editor'.",
    input_schema: {
      type: "object",
      properties: {
        puesto_nombre: { type: "string" },
        area: { type: "string" },
      },
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
  {
    name: "finance_summary",
    description:
      "Resumen financiero del mes. Devuelve cobros a clientes (facturado, cobrado, pendiente), pagos al equipo (programado, pagado, pendiente), gastos operativos (programado, pagado, pendiente) y balance neto del periodo. Usalo para preguntas como '¿cómo viene el mes financieramente?', 'resumen de finanzas', 'cuánto facturé este mes', 'qué pendientes de cobro tengo'.",
    input_schema: {
      type: "object",
      properties: {
        periodo: {
          type: "string",
          description:
            "Periodo a consultar en formato YYYY-MM. Si se omite, usa el mes actual.",
        },
      },
    },
  },
  {
    name: "create_publication_idea",
    description:
      "Crea una publicación nueva en estado 'idea' para un cliente. Pensada para cuando el usuario dice 'agregá un reel sobre X para Cliente Y' o 'sumá una idea de post sobre tal cosa'. Si no se especifica red/tipo asume instagram + post.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string", description: "Nombre del cliente (búsqueda parcial)." },
        titulo: { type: "string", description: "Título corto de la publicación (la idea)." },
        copy: { type: "string", description: "Copy/texto principal sugerido (opcional)." },
        red: {
          type: "string",
          enum: ["instagram", "facebook", "tiktok", "linkedin", "youtube"],
          description: "Red social. Default 'instagram'.",
        },
        tipo: {
          type: "string",
          enum: ["post", "reel", "historia", "carrusel", "video"],
          description: "Tipo de pieza. Default 'post'.",
        },
        fecha_publicacion: {
          type: "string",
          description: "Fecha tentativa en formato YYYY-MM-DD o ISO. Opcional.",
        },
      },
      required: ["cliente_nombre", "titulo"],
    },
  },
  {
    name: "mark_publication_published",
    description:
      "Marca una publicación como 'publicado'. Usalo cuando el usuario confirma que ya subió la pieza. Necesitás el ID o el título exacto.",
    input_schema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "UUID de la publicación." },
        publication_titulo: {
          type: "string",
          description: "Si no tenés el ID, pasá el título exacto.",
        },
      },
    },
  },
  {
    name: "request_client_approval",
    description:
      "Pasa una publicación al estado 'revision_cliente' para que el cliente la apruebe desde el portal. Útil cuando el usuario dice 'mandalo a aprobación' o 'que lo vea el cliente'.",
    input_schema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "UUID de la publicación." },
        publication_titulo: {
          type: "string",
          description: "Si no tenés el ID, pasá el título exacto.",
        },
      },
    },
  },
  {
    name: "apply_plan_to_calendar",
    description:
      "Aplica los temas pendientes del plan de contenido activo del cliente al calendario, creando publicaciones en estado 'idea'. Pensado para cuando el usuario dice 'pasá el plan al calendario' o 'arrancá a llenar el calendario del mes'.",
    input_schema: {
      type: "object",
      properties: {
        cliente_nombre: { type: "string", description: "Nombre del cliente (búsqueda parcial)." },
      },
      required: ["cliente_nombre"],
    },
  },
  {
    name: "search_help",
    description:
      "Busca en el centro de ayuda interno (las paginas que explican como usar la app). Usalo cuando el usuario pregunte 'como uso X', 'donde esta Y', 'que es Z dentro de la app', 'como funciona el plan mensual', etc. Devuelve titulos + descripcion + slug + extracto relevante. Despues podes usar get_help_page con el slug para leer la pagina completa si necesitas mas detalle.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Que esta buscando el usuario. Ej: 'diagnostico', 'plan mensual', 'como aprobar publicaciones', 'capacity del equipo'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_help_page",
    description:
      "Lee una pagina completa del centro de ayuda interno por su slug. Usala despues de search_help cuando necesites el contenido entero para explicar algo a fondo, o cuando el usuario pide 'mostrame la guia de X'.",
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description:
            "Slug de la pagina (ej: 'diagnostico', 'plan-mensual', 'mi-dia', 'para-cms').",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "finance_compare",
    description:
      "Compara dos periodos financieros. Devuelve totales y % de cambio en cobros, pagos al equipo, gastos y balance neto. Usalo para preguntas como 'compará este mes con el anterior', 'cómo veníamos vs marzo', '¿estamos mejor o peor que el mes pasado?'. Si no se pasa periodo_b, usa el mes anterior a periodo_a automáticamente.",
    input_schema: {
      type: "object",
      properties: {
        periodo_a: {
          type: "string",
          description: "Periodo principal en YYYY-MM. Si se omite, usa el mes actual.",
        },
        periodo_b: {
          type: "string",
          description: "Periodo a comparar en YYYY-MM. Si se omite, usa el mes anterior a periodo_a.",
        },
      },
    },
  },
];

type Result = { ok: true; data: unknown } | { ok: false; error: string };

function previousMonth(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  if (!y || !m) return periodo;
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

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

      case "update_task_due_date": {
        let id = input.task_id as string | undefined;
        if (!id && input.task_titulo) {
          const { data } = await sb
            .from("tasks")
            .select("id")
            .ilike("titulo", `%${input.task_titulo}%`)
            .limit(1)
            .maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la tarea." };
        const raw = input.nueva_fecha as string | null | undefined;
        const value = raw && String(raw).trim() !== "" ? String(raw) : null;
        const { error } = await sb
          .from("tasks")
          .update({ fecha_limite: value })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nueva_fecha: value } };
      }

      case "update_task_priority": {
        let id = input.task_id as string | undefined;
        if (!id && input.task_titulo) {
          const { data } = await sb
            .from("tasks")
            .select("id")
            .ilike("titulo", `%${input.task_titulo}%`)
            .limit(1)
            .maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la tarea." };
        const { error } = await sb
          .from("tasks")
          .update({ prioridad: String(input.nueva_prioridad) })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nueva_prioridad: input.nueva_prioridad } };
      }

      case "reassign_task": {
        let id = input.task_id as string | undefined;
        if (!id && input.task_titulo) {
          const { data } = await sb
            .from("tasks")
            .select("id")
            .ilike("titulo", `%${input.task_titulo}%`)
            .limit(1)
            .maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la tarea." };
        const uid = await findUserId(sb, String(input.nuevo_responsable_nombre));
        if (!uid) {
          return {
            ok: false,
            error: `No encontré usuario llamado "${input.nuevo_responsable_nombre}"`,
          };
        }
        const { error } = await sb
          .from("tasks")
          .update({ asignado_a_id: uid })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nuevo_responsable_id: uid } };
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

        // Diagnóstico estratégico + Plan mensual vigente: las dos capas que
        // JDmedIA necesita para razonar sobre un cliente.
        const [{ data: diag }, { data: plan }, { data: pages }] = await Promise.all([
          sb
            .from("client_diagnostics")
            .select("version, content, approved_at")
            .eq("cliente_id", client.id)
            .eq("status", "approved")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle(),
          sb
            .from("client_content_plans")
            .select("periodo_label, content, approved_at")
            .eq("cliente_id", client.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          sb
            .from("agency_pages")
            .select("slug, title, content")
            .or("slug.ilike.%buyer%,slug.ilike.%tono%,slug.ilike.%persona%,title.ilike.%buyer%,title.ilike.%tono%,title.ilike.%persona%")
            .limit(5),
        ]);

        let diagnostico: Record<string, unknown> | null = null;
        if (diag && diag.content && typeof diag.content === "object") {
          const c = diag.content as Record<string, unknown>;
          diagnostico = {
            version: diag.version,
            aprobado_el: diag.approved_at,
            resumen_ejecutivo: c.resumen_ejecutivo,
            contexto: c.contexto,
            publico_objetivo: c.publico_objetivo,
            marca: c.marca,
            diferenciales: c.diferenciales,
            pilares_contenido: c.pilares_contenido,
          };
        }

        let plan_mensual: Record<string, unknown> | null = null;
        if (plan && plan.content && typeof plan.content === "object") {
          const p = plan.content as Record<string, unknown>;
          plan_mensual = {
            periodo: plan.periodo_label,
            aprobado_el: plan.approved_at,
            resumen_mes: p.resumen_mes,
            mix_por_red: p.mix_por_red,
            distribucion_pilares: p.distribucion_pilares,
            temas_destacados: p.temas_destacados,
            campanas: p.campanas,
          };
        }

        return {
          ok: true,
          data: {
            cliente: client,
            diagnostico,
            plan_mensual,
            referencias: (pages ?? []).map((p) => ({
              slug: p.slug,
              title: p.title,
              excerpt: (p.content ?? "").slice(0, 1200),
            })),
          },
        };
      }

      case "list_services": {
        let q = sb
          .from("services")
          .select("slug, name, description, color, areas, orden, active")
          .order("orden");
        if (input.solo_activos !== false) q = q.eq("active", true);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "list_positions": {
        let q = sb
          .from("positions")
          .select(
            "id, nombre, area, descripcion, services, pago_default_monto, pago_default_moneda, pago_default_frecuencia"
          )
          .order("area")
          .order("nombre");
        if (input.puesto_nombre) {
          q = q.ilike("nombre", `%${String(input.puesto_nombre)}%`);
        }
        if (input.area) q = q.ilike("area", `%${String(input.area)}%`);
        const { data: positions, error } = await q;
        if (error) return { ok: false, error: error.message };

        const ids = (positions ?? []).map((p) => p.id);
        const { data: principals } = await sb
          .from("users")
          .select("id, nombre, position_id")
          .in("position_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"])
          .eq("activo", true);
        const { data: secondaryUsers } = await sb
          .from("users")
          .select("id, nombre, secondary_position_ids")
          .eq("activo", true);

        const principalsByPos = new Map<string, { id: string; nombre: string }[]>();
        for (const u of principals ?? []) {
          const pid = (u as { position_id: string | null }).position_id;
          if (!pid) continue;
          if (!principalsByPos.has(pid)) principalsByPos.set(pid, []);
          principalsByPos.get(pid)!.push({ id: u.id as string, nombre: u.nombre as string });
        }
        const secondariesByPos = new Map<string, { id: string; nombre: string }[]>();
        for (const u of secondaryUsers ?? []) {
          const sids =
            (u as { secondary_position_ids: string[] | null }).secondary_position_ids ?? [];
          for (const sid of sids) {
            if (!secondariesByPos.has(sid)) secondariesByPos.set(sid, []);
            secondariesByPos
              .get(sid)!
              .push({ id: u.id as string, nombre: u.nombre as string });
          }
        }

        const enriched = (positions ?? []).map((p) => ({
          ...p,
          principales: principalsByPos.get(p.id as string) ?? [],
          secundarios: secondariesByPos.get(p.id as string) ?? [],
        }));

        return { ok: true, data: enriched };
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

      case "finance_summary": {
        const periodo =
          (input.periodo as string | undefined) ??
          new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Argentina/Cordoba",
          }).slice(0, 7); // YYYY-MM

        const [{ data: invoices }, { data: payments }, { data: expenses }] =
          await Promise.all([
            sb
              .from("client_invoices")
              .select("monto, moneda, fecha_cobro, cliente:clients(nombre), concepto")
              .eq("periodo", periodo),
            sb
              .from("team_payments")
              .select("monto, moneda, fecha_pago, user:users(nombre), concepto")
              .eq("periodo", periodo),
            sb
              .from("expenses")
              .select("monto, moneda, fecha_pago, categoria, concepto, proveedor")
              .eq("periodo", periodo),
          ]);

        type Row = { monto: number; moneda: string; pagado: boolean };
        const sumByCurrency = (rows: Row[]) => {
          const out: Record<string, { total: number; pagado: number; pendiente: number }> = {};
          for (const r of rows) {
            const m = r.moneda ?? "ARS";
            if (!out[m]) out[m] = { total: 0, pagado: 0, pendiente: 0 };
            const v = Number(r.monto) || 0;
            out[m].total += v;
            if (r.pagado) out[m].pagado += v;
            else out[m].pendiente += v;
          }
          return out;
        };

        const invSummary = sumByCurrency(
          (invoices ?? []).map((i) => ({
            monto: Number(i.monto),
            moneda: i.moneda as string,
            pagado: !!i.fecha_cobro,
          }))
        );
        const paySummary = sumByCurrency(
          (payments ?? []).map((p) => ({
            monto: Number(p.monto),
            moneda: p.moneda as string,
            pagado: !!p.fecha_pago,
          }))
        );
        const expSummary = sumByCurrency(
          (expenses ?? []).map((e) => ({
            monto: Number(e.monto),
            moneda: e.moneda as string,
            pagado: !!e.fecha_pago,
          }))
        );

        // Balance neto por moneda (cobrado - pagado al equipo - gastos pagados)
        const currencies = new Set([
          ...Object.keys(invSummary),
          ...Object.keys(paySummary),
          ...Object.keys(expSummary),
        ]);
        const balance: Record<string, number> = {};
        for (const m of currencies) {
          balance[m] =
            (invSummary[m]?.pagado ?? 0) -
            (paySummary[m]?.pagado ?? 0) -
            (expSummary[m]?.pagado ?? 0);
        }

        return {
          ok: true,
          data: {
            periodo,
            cobros: {
              resumen: invSummary,
              cantidad: invoices?.length ?? 0,
              pendientes: (invoices ?? [])
                .filter((i) => !i.fecha_cobro)
                .map((i) => ({
                  cliente: (i.cliente as unknown as { nombre?: string })?.nombre,
                  concepto: i.concepto,
                  monto: i.monto,
                  moneda: i.moneda,
                })),
            },
            pagos_equipo: {
              resumen: paySummary,
              cantidad: payments?.length ?? 0,
            },
            gastos: {
              resumen: expSummary,
              cantidad: expenses?.length ?? 0,
            },
            balance_neto: balance,
          },
        };
      }

      case "finance_compare": {
        const periodoA =
          (input.periodo_a as string | undefined) ??
          new Date()
            .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" })
            .slice(0, 7);
        const periodoB =
          (input.periodo_b as string | undefined) ?? previousMonth(periodoA);

        const summaryFor = async (periodo: string) => {
          const [{ data: invoices }, { data: payments }, { data: expenses }] =
            await Promise.all([
              sb
                .from("client_invoices")
                .select("monto, moneda, fecha_cobro")
                .eq("periodo", periodo),
              sb
                .from("team_payments")
                .select("monto, moneda, fecha_pago")
                .eq("periodo", periodo),
              sb
                .from("expenses")
                .select("monto, moneda, fecha_pago")
                .eq("periodo", periodo),
            ]);

          const sumByCurrency = (
            rows: { monto: number; moneda: string; pagado: boolean }[]
          ) => {
            const out: Record<string, { total: number; pagado: number; pendiente: number }> = {};
            for (const r of rows) {
              const m = r.moneda ?? "ARS";
              if (!out[m]) out[m] = { total: 0, pagado: 0, pendiente: 0 };
              const v = Number(r.monto) || 0;
              out[m].total += v;
              if (r.pagado) out[m].pagado += v;
              else out[m].pendiente += v;
            }
            return out;
          };

          const inv = sumByCurrency(
            (invoices ?? []).map((i) => ({
              monto: Number(i.monto),
              moneda: i.moneda as string,
              pagado: !!i.fecha_cobro,
            }))
          );
          const pay = sumByCurrency(
            (payments ?? []).map((p) => ({
              monto: Number(p.monto),
              moneda: p.moneda as string,
              pagado: !!p.fecha_pago,
            }))
          );
          const exp = sumByCurrency(
            (expenses ?? []).map((e) => ({
              monto: Number(e.monto),
              moneda: e.moneda as string,
              pagado: !!e.fecha_pago,
            }))
          );

          const currencies = new Set([
            ...Object.keys(inv),
            ...Object.keys(pay),
            ...Object.keys(exp),
          ]);
          const balance: Record<string, number> = {};
          for (const m of currencies) {
            balance[m] =
              (inv[m]?.pagado ?? 0) - (pay[m]?.pagado ?? 0) - (exp[m]?.pagado ?? 0);
          }

          return { cobros: inv, pagos_equipo: pay, gastos: exp, balance };
        };

        const [a, b] = await Promise.all([summaryFor(periodoA), summaryFor(periodoB)]);

        const allCurrencies = new Set([
          ...Object.keys(a.cobros),
          ...Object.keys(a.pagos_equipo),
          ...Object.keys(a.gastos),
          ...Object.keys(b.cobros),
          ...Object.keys(b.pagos_equipo),
          ...Object.keys(b.gastos),
        ]);

        const diff: Record<
          string,
          {
            cobros: { a: number; b: number; delta: number; pct: number | null };
            pagos_equipo: { a: number; b: number; delta: number; pct: number | null };
            gastos: { a: number; b: number; delta: number; pct: number | null };
            balance: { a: number; b: number; delta: number; pct: number | null };
          }
        > = {};
        for (const m of allCurrencies) {
          const cA = a.cobros[m]?.total ?? 0;
          const cB = b.cobros[m]?.total ?? 0;
          const pA = a.pagos_equipo[m]?.total ?? 0;
          const pB = b.pagos_equipo[m]?.total ?? 0;
          const gA = a.gastos[m]?.total ?? 0;
          const gB = b.gastos[m]?.total ?? 0;
          const balA = a.balance[m] ?? 0;
          const balB = b.balance[m] ?? 0;
          diff[m] = {
            cobros: { a: cA, b: cB, delta: cA - cB, pct: cB === 0 ? null : ((cA - cB) / cB) * 100 },
            pagos_equipo: { a: pA, b: pB, delta: pA - pB, pct: pB === 0 ? null : ((pA - pB) / pB) * 100 },
            gastos: { a: gA, b: gB, delta: gA - gB, pct: gB === 0 ? null : ((gA - gB) / gB) * 100 },
            balance: { a: balA, b: balB, delta: balA - balB, pct: balB === 0 ? null : ((balA - balB) / balB) * 100 },
          };
        }

        return {
          ok: true,
          data: {
            periodo_a: periodoA,
            periodo_b: periodoB,
            comparacion: diff,
          },
        };
      }

      case "create_publication_idea": {
        const cid = await findClientId(sb, String(input.cliente_nombre));
        if (!cid) {
          return {
            ok: false,
            error: `No encontré cliente llamado "${input.cliente_nombre}"`,
          };
        }
        const { data, error } = await sb
          .from("publications")
          .insert({
            cliente_id: cid,
            titulo: String(input.titulo),
            copy: input.copy ? String(input.copy) : null,
            red: input.red ? String(input.red) : "instagram",
            tipo: input.tipo ? String(input.tipo) : "post",
            fecha_publicacion: input.fecha_publicacion
              ? String(input.fecha_publicacion)
              : null,
            estado: "idea",
            creado_por_id: currentUserId,
          })
          .select("id, titulo, red, tipo, estado")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, data };
      }

      case "mark_publication_published": {
        let id = input.publication_id as string | undefined;
        if (!id && input.publication_titulo) {
          const { data } = await sb
            .from("publications")
            .select("id")
            .ilike("titulo", `%${input.publication_titulo}%`)
            .limit(1)
            .maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la publicación." };
        const { error } = await sb
          .from("publications")
          .update({ estado: "publicado" })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nuevo_estado: "publicado" } };
      }

      case "request_client_approval": {
        let id = input.publication_id as string | undefined;
        if (!id && input.publication_titulo) {
          const { data } = await sb
            .from("publications")
            .select("id")
            .ilike("titulo", `%${input.publication_titulo}%`)
            .limit(1)
            .maybeSingle();
          id = data?.id;
        }
        if (!id) return { ok: false, error: "No se pudo identificar la publicación." };
        const { error } = await sb
          .from("publications")
          .update({ estado: "revision_cliente" })
          .eq("id", id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, data: { id, nuevo_estado: "revision_cliente" } };
      }

      case "apply_plan_to_calendar": {
        const cid = await findClientId(sb, String(input.cliente_nombre));
        if (!cid) {
          return {
            ok: false,
            error: `No encontré cliente llamado "${input.cliente_nombre}"`,
          };
        }
        const { data: plan } = await sb
          .from("client_content_plans")
          .select("id, periodo_label")
          .eq("cliente_id", cid)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!plan?.id) {
          return {
            ok: false,
            error: "El cliente no tiene un plan de contenido activo.",
          };
        }
        // Import dinámico para evitar ciclos con la action file.
        const { applyAllTemasToCalendar } = await import(
          "@/app/(app)/clientes/[id]/plan-mensual/actions"
        );
        const res = await applyAllTemasToCalendar(plan.id as string);
        if (!res.ok) {
          return { ok: false, error: res.error ?? "Error aplicando plan" };
        }
        return {
          ok: true,
          data: {
            plan_id: plan.id,
            periodo: plan.periodo_label,
            creadas: res.data?.created ?? 0,
          },
        };
      }

      case "search_help": {
        const q = String(input.query ?? "")
          .trim()
          .toLowerCase();
        if (!q) return { ok: false, error: "Falta query." };
        const { getAllHelpPages, filterByRole } = await import("@/lib/help/load");
        // Filtrar por rol del usuario asi no le mostramos paginas restringidas
        // que no le sirven.
        const { data: userRow } = await sb
          .from("users")
          .select("rol")
          .eq("id", currentUserId)
          .maybeSingle();
        const rol = (userRow?.rol as string | undefined) ?? "all";
        const pages = filterByRole(getAllHelpPages(), rol);

        // Ranking simple: exact-en-titulo > en-descripcion > en-contenido.
        type Hit = {
          slug: string;
          title: string;
          description: string;
          category?: string;
          score: number;
          excerpt: string;
        };
        const hits: Hit[] = [];
        for (const p of pages) {
          const t = (p.title ?? "").toLowerCase();
          const d = (p.description ?? "").toLowerCase();
          const c = p.content.toLowerCase();
          let score = 0;
          if (t.includes(q)) score += 10;
          if (d.includes(q)) score += 5;
          if (c.includes(q)) score += 1;
          if (score === 0) continue;
          // Extraer un excerpt corto alrededor de la primera ocurrencia
          let excerpt = "";
          const idx = c.indexOf(q);
          if (idx >= 0) {
            const start = Math.max(0, idx - 80);
            const end = Math.min(p.content.length, idx + q.length + 200);
            excerpt = p.content.slice(start, end).replace(/\n+/g, " ");
            if (start > 0) excerpt = "…" + excerpt;
            if (end < p.content.length) excerpt = excerpt + "…";
          }
          hits.push({
            slug: p.slug,
            title: p.title,
            description: p.description ?? "",
            category: p.category,
            score,
            excerpt,
          });
        }
        hits.sort((a, b) => b.score - a.score);
        return {
          ok: true,
          data: {
            query: q,
            results: hits.slice(0, 6).map((h) => ({
              slug: h.slug,
              title: h.title,
              description: h.description,
              category: h.category,
              url: `/ayuda/${h.slug}`,
              excerpt: h.excerpt,
            })),
          },
        };
      }

      case "get_help_page": {
        const slug = String(input.slug ?? "").trim();
        if (!slug) return { ok: false, error: "Falta slug." };
        const { getHelpPage } = await import("@/lib/help/load");
        const page = getHelpPage(slug);
        if (!page) {
          return {
            ok: false,
            error: `No existe pagina de ayuda con slug "${slug}".`,
          };
        }
        // Validacion de rol
        const { data: userRow } = await sb
          .from("users")
          .select("rol")
          .eq("id", currentUserId)
          .maybeSingle();
        const rol = (userRow?.rol as string | undefined) ?? "all";
        const roles = page.roles ?? ["all"];
        if (!roles.includes("all") && !roles.includes(rol)) {
          return {
            ok: false,
            error: "Esta pagina no esta disponible para tu rol.",
          };
        }
        return {
          ok: true,
          data: {
            slug: page.slug,
            title: page.title,
            description: page.description,
            category: page.category,
            updated: page.updated,
            url: `/ayuda/${page.slug}`,
            content: page.content,
          },
        };
      }

      default:
        return { ok: false, error: `Tool desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
