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

      default:
        return { ok: false, error: `Tool desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
