import type { SupabaseClient } from "@supabase/supabase-js";
import { AREAS_DE_LA_PM } from "@/lib/tareas/puerta";
import { cargarParaAprobar } from "@/lib/tareas/items-aprobar";
import { cargarCuentasNuevas } from "@/lib/retencion/cuentas-nuevas-run";
import { tableroCuentasNuevas } from "@/lib/retencion/cuentas-nuevas";
import { arranquesPorCuenta, cargarPanoramaArranques } from "@/lib/retencion/onboarding-panorama-run";
import { seguimientoQueToca } from "@/lib/prospecting/seguimiento";
import type { ItemAprobar } from "@/components/bandeja-aprobar";
import type { Puesto } from "./coordinadores";

/**
 * "Lo de tu puesto" en Mi día (12/10/2026): no los números (eso es la tarjeta
 * de la dirección), sino la lista concreta de qué hacer hoy, con el link para
 * resolverlo. Cada puesto mira su propio trabajo.
 */

export interface Linea {
  texto: string;
  detalle?: string;
  href?: string;
  /** Marca la línea en rojo. */
  urgente?: boolean;
}

export interface Bloque {
  titulo: string;
  vacio: string;
  lineas: Linea[];
  /** Cuántas hay en total (si se muestran menos). */
  total?: number;
  verTodo?: { href: string; texto: string };
}

export type PanelPuesto =
  | { puesto: "direccion_creativa"; aprobar: ItemAprobar[]; bloques: Bloque[] }
  | { puesto: Exclude<Puesto, "direccion_creativa">; bloques: Bloque[] };

/** Las tareas abiertas del mes de un servicio aparte, como bloque de Mi día. */
async function bloqueServicio(
  admin: SupabaseClient,
  hoy: string,
  clave: string,
  titulo: string
): Promise<Bloque | null> {
  const { data } = await admin
    .from("tasks")
    .select("id, titulo, estado, fecha_limite")
    .like("rutina_key", `${hoy.slice(0, 7)}:${clave}:%`)
    .order("fecha_limite");
  const todas = (data ?? []) as { id: string; titulo: string; estado: string; fecha_limite: string | null }[];
  if (todas.length === 0) return null;
  const abiertas = todas.filter((t) => t.estado !== "completada" && t.estado !== "archivada");
  return {
    titulo: `${titulo} (${todas.length - abiertas.length} de ${todas.length} hechas)`,
    vacio: "Todas hechas este mes.",
    lineas: abiertas.map((t) => ({
      texto: t.titulo,
      detalle: t.fecha_limite ? `vence el ${t.fecha_limite.slice(8, 10)}/${t.fecha_limite.slice(5, 7)}` : undefined,
      href: `/tareas/${t.id}`,
      urgente: !!t.fecha_limite && t.fecha_limite < hoy,
    })),
  };
}

const corta = (ymd: string | null | undefined) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : "");
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const MAX = 8;

export async function cargarPanelPuesto(
  admin: SupabaseClient,
  hoy: string,
  persona: { id: string },
  puesto: Puesto
): Promise<PanelPuesto | null> {
  const ahora = new Date();

  if (puesto === "direccion_creativa") {
    const en7 = new Date(ahora.getTime() + 7 * 86_400_000).toISOString();
    const [aprobar, { data: ideas }] = await Promise.all([
      cargarParaAprobar(admin, persona.id),
      admin
        .from("publications")
        .select("id, titulo, fecha_publicacion, cliente:clients(nombre)")
        .eq("estado", "idea")
        .gte("fecha_publicacion", ahora.toISOString())
        .lte("fecha_publicacion", en7)
        .order("fecha_publicacion"),
    ]);
    const lista = (ideas ?? []) as unknown as {
      id: string;
      titulo: string | null;
      fecha_publicacion: string;
      cliente: { nombre: string } | null;
    }[];
    const wpp = await bloqueServicio(admin, hoy, "wpp", "WhatsApp de tus cuentas");
    return {
      puesto,
      aprobar,
      bloques: [
        ...(wpp ? [wpp] : []),
        {
          titulo: "Ideas sin aprobar que salen esta semana",
          vacio: "Ninguna: el calendario de los próximos 7 días está aprobado.",
          total: lista.length,
          lineas: lista.slice(0, MAX).map((p) => ({
            texto: p.titulo ?? "Sin título",
            detalle: `${p.cliente?.nombre ?? ""} · sale el ${corta(p.fecha_publicacion.slice(0, 10))}`,
            href: `/contenidos?pub=${p.id}`,
          })),
          verTodo: { href: "/contenidos?vista=aprobar", texto: "Aprobar el mes" },
        },
      ],
    };
  }

  if (puesto === "pm") {
    const ayer = new Date(ahora.getTime() - 86_400_000).toISOString();
    const [{ data: repartir }, { data: abiertas }, { filas }] = await Promise.all([
      admin
        .from("tasks")
        .select("id, titulo, created_at, creador:users!tasks_creado_por_id_fkey(nombre)")
        .eq("asignado_a_id", persona.id)
        .neq("creado_por_id", persona.id)
        .in("area", AREAS_DE_LA_PM)
        .in("estado", ["pendiente", "bloqueada"])
        .order("created_at"),
      admin
        .from("tasks")
        .select("asignado_a_id, asignado:users!tasks_asignado_a_id_fkey(nombre)")
        .not("estado", "in", "(completada,archivada)")
        .lt("fecha_limite", hoy)
        .limit(1000),
      cargarPanoramaArranques(admin, hoy),
    ]);
    const { cuentas } = await cargarCuentasNuevas(admin, hoy, { arranques: arranquesPorCuenta(filas) });
    const enRiesgo = tableroCuentasNuevas(cuentas, hoy).filter((c) => c.estado === "mal");

    const porPersona = new Map<string, { nombre: string; n: number }>();
    for (const t of (abiertas ?? []) as unknown as { asignado_a_id: string | null; asignado: { nombre: string } | null }[]) {
      const k = t.asignado_a_id ?? "—";
      const e = porPersona.get(k) ?? { nombre: t.asignado?.nombre ?? "Sin asignar", n: 0 };
      e.n++;
      porPersona.set(k, e);
    }
    const ranking = [...porPersona.values()].sort((a, b) => b.n - a.n);
    const pedidos = (repartir ?? []) as unknown as {
      id: string;
      titulo: string;
      created_at: string;
      creador: { nombre: string } | null;
    }[];

    return {
      puesto,
      bloques: [
        {
          titulo: "Para repartir",
          vacio: "Nada esperando: todo lo que te pidieron ya tiene a alguien.",
          total: pedidos.length,
          lineas: pedidos.slice(0, MAX).map((t) => ({
            texto: t.titulo,
            detalle: `pidió ${t.creador?.nombre?.split(" ")[0] ?? "—"}`,
            href: `/tareas/${t.id}`,
            urgente: t.created_at < ayer,
          })),
        },
        {
          titulo: "Cuentas nuevas en rojo",
          vacio: "Ninguna: los arranques vienen bien.",
          total: enRiesgo.length,
          lineas: enRiesgo.slice(0, MAX).map((c) => ({
            texto: c.nombre,
            detalle: c.chequeos
              .filter((x) => x.estado === "mal")
              .map((x) => `${x.label}: ${x.detalle}`)
              .join(" · "),
            href: "/onboarding",
            urgente: true,
          })),
          verTodo: { href: "/onboarding", texto: "Ver cuentas nuevas" },
        },
        {
          titulo: "Quién tiene más tareas vencidas",
          vacio: "Nadie: el equipo está al día.",
          lineas: ranking.slice(0, 6).map((p) => ({
            texto: p.nombre,
            detalle: `${p.n} vencida${p.n === 1 ? "" : "s"}`,
            href: "/tareas/vencidas",
            urgente: p.n > 10,
          })),
          verTodo: { href: "/tareas/vencidas", texto: "Ponerse al día" },
        },
      ],
    };
  }

  if (puesto === "comercial") {
    const [{ data: contactos }, { data: campanias }] = await Promise.all([
      admin
        .from("prospecting_contacts")
        .select("campaign_id, estado, contactado_at, seguimientos, seguimiento_at, reunion_fecha, empresa")
        .eq("asignado_a", persona.id)
        .limit(5000),
      admin.from("prospecting_campaigns").select("id, nombre"),
    ]);
    const lista = (contactos ?? []) as {
      campaign_id: string;
      estado: string;
      contactado_at: string | null;
      seguimientos: number | null;
      seguimiento_at: string | null;
      reunion_fecha: string | null;
      empresa: string | null;
    }[];
    const nombreCamp = new Map(((campanias ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]));
    const seguir = new Map<string, number>();
    for (const c of lista) if (seguimientoQueToca(c, ahora)) seguir.set(c.campaign_id, (seguir.get(c.campaign_id) ?? 0) + 1);
    const reuniones = lista
      .filter((c) => c.reunion_fecha && c.reunion_fecha >= ahora.toISOString())
      .sort((a, b) => a.reunion_fecha!.localeCompare(b.reunion_fecha!));
    return {
      puesto,
      bloques: [
        {
          titulo: "Hoy toca insistir (seguimiento 1 y 2)",
          vacio: "Hoy no le toca seguimiento a nadie.",
          lineas: [...seguir]
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX)
            .map(([id, n]) => ({
              texto: nombreCamp.get(id) ?? "Campaña",
              detalle: `${n} contacto${n === 1 ? "" : "s"}`,
              href: `/prospeccion/${id}/contactos?f=seguir`,
            })),
          verTodo: { href: "/prospeccion", texto: "Ir a Prospección" },
        },
        {
          titulo: "Reuniones que conseguiste",
          vacio: "Todavía ninguna agendada. Cada seguimiento suma.",
          lineas: reuniones.slice(0, MAX).map((c) => ({
            texto: c.empresa ?? "Contacto",
            detalle: corta(c.reunion_fecha!.slice(0, 10)),
            href: "/comercial/reuniones",
          })),
        },
      ],
    };
  }

  if (puesto === "coord_general") {
    const { data } = await admin
      .from("client_invoices")
      .select("cliente_id, monto, fecha_cobro, cliente:clients(nombre)")
      .eq("periodo", hoy.slice(0, 7))
      .is("fecha_cobro", null);
    // Una línea por cliente con lo que le falta pagar (puede tener una factura por servicio).
    const porCliente = new Map<string, { monto: number; cliente: { nombre: string } | null }>();
    for (const f of (data ?? []) as unknown as {
      cliente_id: string;
      monto: number | string;
      cliente: { nombre: string } | null;
    }[]) {
      const e = porCliente.get(f.cliente_id) ?? { monto: 0, cliente: f.cliente };
      e.monto += Number(f.monto || 0);
      porCliente.set(f.cliente_id, e);
    }
    const lista = [...porCliente.values()].sort((a, b) => b.monto - a.monto);
    const fuera = Number(hoy.slice(8, 10)) > 5;
    return {
      puesto,
      bloques: [
        {
          titulo: "Cobros del mes sin marcar",
          vacio: "Todo cobrado y marcado.",
          total: lista.length,
          lineas: lista.slice(0, 12).map((f) => ({
            texto: f.cliente?.nombre ?? "Cliente",
            detalle: pesos(Number(f.monto || 0)),
            href: "/cobros",
            urgente: fuera,
          })),
          verTodo: { href: "/cobros", texto: "¿Quién me pagó?" },
        },
      ],
    };
  }

  if (puesto === "paid_media") {
    const hace7 = new Date(ahora.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: cs } = await admin
      .from("clients")
      .select("id, nombre")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .not("media_buyer_id", "is", null)
      .order("nombre");
    const cuentas = (cs ?? []) as { id: string; nombre: string }[];
    const ids = cuentas.map((c) => c.id);
    const [{ data: snaps }, { data: onb }] = ids.length
      ? await Promise.all([
          admin.from("paid_media_snapshots").select("cliente_id").in("cliente_id", ids).gte("fecha", hace7),
          admin.from("client_ads_onboarding").select("cliente_id").in("cliente_id", ids).not("campanas_publicadas_at", "is", null),
        ])
      : [{ data: [] }, { data: [] }];
    const conectadas = new Set(((snaps ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id));
    const conCampanas = new Set(((onb ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id));
    const sinConectar = cuentas.filter((c) => !conectadas.has(c.id));
    const sinCampanas = cuentas.filter((c) => !conCampanas.has(c.id));
    const gads = await bloqueServicio(admin, hoy, "gads", "Google Ads de este mes");
    return {
      puesto,
      bloques: [
        ...(gads ? [gads] : []),
        {
          titulo: "Pauta sin conectar a la app",
          vacio: "Todas las cuentas con pauta mandan datos.",
          total: sinConectar.length,
          lineas: sinConectar.slice(0, 12).map((c) => ({ texto: c.nombre, href: `/clientes/${c.id}` })),
          verTodo: { href: "/paid-media", texto: "Ir a Paid Media" },
        },
        {
          titulo: "Sin campañas publicadas",
          vacio: "Todas las cuentas tienen campañas andando.",
          total: sinCampanas.length,
          lineas: sinCampanas.slice(0, 12).map((c) => ({ texto: c.nombre, href: `/clientes/${c.id}` })),
        },
      ],
    };
  }

  if (puesto === "cuenta_jd") {
    const { data: interna } = await admin.from("clients").select("id").eq("es_interno", true).limit(1).maybeSingle();
    if (!interna) return null;
    const en21 = new Date(ahora.getTime() + 21 * 86_400_000).toISOString();
    const { data } = await admin
      .from("publications")
      .select("id, titulo, tipo, estado, fecha_publicacion")
      .eq("cliente_id", (interna as { id: string }).id)
      .gte("fecha_publicacion", ahora.toISOString())
      .lte("fecha_publicacion", en21)
      .order("fecha_publicacion");
    const lista = (data ?? []) as { id: string; titulo: string | null; tipo: string; estado: string; fecha_publicacion: string }[];
    return {
      puesto,
      bloques: [
        {
          titulo: "Lo que sale en las redes de JD Media (próximas 3 semanas)",
          vacio: "No hay nada cargado. Armá el calendario de JD Media: la agencia también tiene que mostrarse.",
          lineas: lista.slice(0, MAX).map((p) => ({
            texto: p.titulo ?? "Sin título",
            detalle: `${p.tipo} · ${corta(p.fecha_publicacion.slice(0, 10))} · ${p.estado.replace("_", " ")}`,
            href: `/contenidos?pub=${p.id}`,
          })),
          verTodo: { href: `/contenidos?cliente=${(interna as { id: string }).id}`, texto: "Calendario de JD Media" },
        },
      ],
    };
  }

  return null;
}
