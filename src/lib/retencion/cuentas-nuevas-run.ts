/**
 * Lo que habla con la base para el tablero de cuentas nuevas: junta la data y,
 * en el cron, agenda sola la reunión de cada cuenta nueva que no la tiene.
 * Las reglas viven en `cuentas-nuevas.ts` (puro y testeado).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { sumarDias } from "./onboarding-15";
import {
  DIAS_CUENTA_NUEVA,
  PREFIJO_AVISO,
  avisoCuentasEnRiesgo,
  esCuentaNueva,
  reunionesAAgendar,
  tableroCuentasNuevas,
  type CuentaNuevaCruda,
} from "./cuentas-nuevas";
import { arranquesPorCuenta, cargarPanoramaArranques } from "./onboarding-panorama-run";
import { computeAccountHealth } from "@/lib/director/health";
import { sendPushToUsers } from "@/lib/push";

type Admin = SupabaseClient;

/** Horarios en que se agendan las reuniones de cuentas nuevas, en orden. */
const HORARIOS = ["11:00", "12:00", "15:00", "16:00", "17:00"];

interface ClienteFila {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  monto_mensual: number | null;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  responsable_id: string | null;
}

export interface CuentasNuevasData {
  cuentas: CuentaNuevaCruda[];
  /** Para el cron: a quién invitar a la reunión. */
  equipo: Map<string, { cm: string | null; responsable: string | null }>;
}

/**
 * Junta la data de las cuentas en sus primeros 90 días. El progreso del
 * arranque y el semáforo de salud los pasa quien llama (la página ya los
 * calcula); el cron no los necesita.
 */
export async function cargarCuentasNuevas(
  admin: Admin,
  hoy: string,
  extra: {
    arranques?: Map<string, CuentaNuevaCruda["arranque"]>;
    salud?: Map<string, { semaforo: CuentaNuevaCruda["salud"]; alertas: string[] }>;
  } = {}
): Promise<CuentasNuevasData> {
  const desde = sumarDias(hoy, -DIAS_CUENTA_NUEVA);
  const { data: clientesRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio, monto_mensual, cm_id, disenador_id, audiovisual_id, responsable_id")
    .eq("estado", "activo")
    .eq("es_interno", false)
    .gte("fecha_inicio", desde);
  const clientes = ((clientesRaw ?? []) as ClienteFila[]).filter((c) =>
    esCuentaNueva(c.fecha_inicio, hoy)
  );
  if (clientes.length === 0) return { cuentas: [], equipo: new Map() };
  const ids = clientes.map((c) => c.id);
  const periodo = hoy.slice(0, 7);
  const inicioMes = `${periodo}-01`;

  const [pubsRes, meetRes, agendaRes, factRes, svcRes, ideasRes] = await Promise.all([
    admin
      .from("publications")
      .select("cliente_id, fecha_publicacion")
      .in("cliente_id", ids)
      .eq("estado", "publicado")
      .order("fecha_publicacion", { ascending: true }),
    admin.from("client_meetings").select("cliente_id").eq("periodo", periodo).in("cliente_id", ids),
    admin
      .from("internal_meetings")
      .select("client_id, starts_at")
      .in("client_id", ids)
      .eq("tipo", "reunion")
      .gte("starts_at", `${inicioMes}T00:00:00-03:00`)
      .order("starts_at", { ascending: true }),
    admin
      .from("client_invoices")
      .select("cliente_id, fecha_cobro, fecha_vencimiento, periodo")
      .in("cliente_id", ids)
      .lte("periodo", periodo),
    admin
      .from("client_services")
      .select("cliente_id")
      .in("cliente_id", ids)
      .eq("tipo", "gestion_redes")
      .eq("activo", true),
    admin
      .from("publications")
      .select("cliente_id")
      .in("cliente_id", ids)
      .eq("estado", "idea")
      .gte("fecha_publicacion", inicioMes)
      .lt("fecha_publicacion", `${sumarDias(`${periodo}-28`, 7).slice(0, 7)}-01`),
  ]);
  const conRedes = new Set(((svcRes.data ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id));

  const primera = new Map<string, string>();
  for (const p of (pubsRes.data ?? []) as { cliente_id: string; fecha_publicacion: string | null }[]) {
    if (p.fecha_publicacion && !primera.has(p.cliente_id))
      primera.set(p.cliente_id, p.fecha_publicacion.slice(0, 10));
  }
  const hechas = new Set(((meetRes.data ?? []) as { cliente_id: string }[]).map((m) => m.cliente_id));

  // La reunión agendada que importa: la próxima; si ya pasaron todas, la última.
  const agendadas = new Map<string, string[]>();
  for (const m of (agendaRes.data ?? []) as { client_id: string; starts_at: string }[]) {
    const dia = new Date(m.starts_at).toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Cordoba",
    });
    agendadas.set(m.client_id, [...(agendadas.get(m.client_id) ?? []), dia]);
  }
  const reunionAgendada = (id: string): string | null => {
    const dias = agendadas.get(id);
    if (!dias?.length) return null;
    return dias.find((d) => d >= hoy) ?? dias[dias.length - 1];
  };

  // Solo cuenta como deuda lo que venció hace más de 5 días: el 6 de octubre
  // la factura de octubre recién venció y casi nadie la marcó todavía.
  const limiteDeuda = sumarDias(hoy, -5);
  const facturas = new Map<string, { n: number; meses: Set<string> }>();
  for (const f of (factRes.data ?? []) as {
    cliente_id: string;
    fecha_cobro: string | null;
    fecha_vencimiento: string | null;
    periodo: string;
  }[]) {
    const x = facturas.get(f.cliente_id) ?? { n: 0, meses: new Set<string>() };
    x.n++;
    if (!f.fecha_cobro && (f.fecha_vencimiento ?? "").slice(0, 10) < limiteDeuda) x.meses.add(f.periodo);
    facturas.set(f.cliente_id, x);
  }

  // Lo que está trabado en dirección creativa: piezas del mes todavía en idea.
  const ideas = new Map<string, number>();
  for (const p of (ideasRes.data ?? []) as { cliente_id: string }[])
    ideas.set(p.cliente_id, (ideas.get(p.cliente_id) ?? 0) + 1);

  const cuentas: CuentaNuevaCruda[] = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    fechaInicio: c.fecha_inicio!.slice(0, 10),
    monto: c.monto_mensual,
    cmId: c.cm_id,
    disenadorId: c.disenador_id,
    audiovisualId: c.audiovisual_id,
    conRedes: svcRes.error ? true : conRedes.has(c.id),
    arranque: extra.arranques?.get(c.id) ?? null,
    primeraPublicada: primera.get(c.id) ?? null,
    ideasSinAprobar: ideas.get(c.id) ?? 0,
    reunionHecha: hechas.has(c.id),
    reunionAgendada: reunionAgendada(c.id),
    facturas: facturas.get(c.id)?.n ?? 0,
    mesesSinCobrar: [...(facturas.get(c.id)?.meses ?? [])],
    salud: extra.salud?.get(c.id)?.semaforo ?? null,
    alertasSalud: extra.salud?.get(c.id)?.alertas ?? [],
  }));
  const equipo = new Map(clientes.map((c) => [c.id, { cm: c.cm_id, responsable: c.responsable_id }]));
  return { cuentas, equipo };
}

/**
 * El cron: a cada cuenta nueva sin reunión del mes le agenda una en la Agenda
 * (45 minutos desde las 11 en el primer horario libre, con la PM, el director creativo y la CM) y le avisa a la PM una
 * sola vez con la lista, para que confirme el día con cada cliente o la mueva.
 * Idempotente: una cuenta con una reunión agendada este mes no se toca.
 */
export async function runAgendarReunionesCuentasNuevas(
  admin: Admin,
  hoy: string
): Promise<{ agendadas: number; detalle: string[] }> {
  const { cuentas, equipo } = await cargarCuentasNuevas(admin, hoy);
  const faltan = reunionesAAgendar(cuentas, hoy);
  if (faltan.length === 0) return { agendadas: 0, detalle: [] };

  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, area, area_secundaria")
    .eq("activo", true);
  const users = (usersRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm =
    users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ??
    users.find((u) => u.rol === "admin")?.id;
  if (!pm) return { agendadas: 0, detalle: ["sin PM"] };
  const activos = new Set(users.map((u) => u.id));

  // Varias el mismo día no pueden pisarse: todas tienen a la PM. Se reparten
  // en los horarios libres, contando lo que ya hay en la Agenda ese día.
  const dias = [...new Set(faltan.map((r) => r.fecha))];
  const { data: ocupadosRaw } = await admin
    .from("internal_meetings")
    .select("starts_at")
    .gte("starts_at", `${dias.sort()[0]}T00:00:00-03:00`)
    .lte("starts_at", `${dias.sort()[dias.length - 1]}T23:59:59-03:00`);
  const ocupado = new Set(
    ((ocupadosRaw ?? []) as { starts_at: string }[]).map((m) => {
      const d = new Date(m.starts_at);
      const dia = d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
      const hora = d.toLocaleTimeString("en-GB", { timeZone: "America/Argentina/Cordoba", hour: "2-digit", minute: "2-digit" });
      return `${dia} ${hora}`;
    })
  );
  const horario = (fecha: string): string => {
    const libre = HORARIOS.find((h) => !ocupado.has(`${fecha} ${h}`)) ?? HORARIOS[HORARIOS.length - 1];
    ocupado.add(`${fecha} ${libre}`);
    return libre;
  };

  const detalle: string[] = [];
  for (const r of faltan) {
    const hora = horario(r.fecha);
    const [hh, mm] = hora.split(":").map(Number);
    const fin = `${String(hh + (mm + 45 >= 60 ? 1 : 0)).padStart(2, "0")}:${String((mm + 45) % 60).padStart(2, "0")}`;
    const { data: m, error } = await admin
      .from("internal_meetings")
      .insert({
        titulo: r.titulo,
        descripcion:
          "Agendada sola por la app (cuenta nueva). Confirmá el día con el cliente; si pide otro, arrastrala en la Agenda. Se da desde la ficha del cliente → Reunión.",
        starts_at: `${r.fecha}T${hora}:00-03:00`,
        ends_at: `${r.fecha}T${fin}:00-03:00`,
        client_id: r.clienteId,
        created_by: pm,
        tipo: "reunion",
      })
      .select("id")
      .single();
    if (error || !m) continue;
    const eq = equipo.get(r.clienteId);
    const invitados = [...new Set([pm, eq?.responsable, eq?.cm].filter((x): x is string => !!x && activos.has(x)))];
    await admin
      .from("internal_meeting_attendees")
      .insert(invitados.map((user_id) => ({ meeting_id: m.id, user_id })));
    const nombre = cuentas.find((c) => c.id === r.clienteId)?.nombre ?? "";
    detalle.push(`${nombre} (${r.fecha.slice(8, 10)}/${r.fecha.slice(5, 7)})`);
  }

  if (detalle.length > 0) {
    await admin.from("notifications").insert({
      user_id: pm,
      tipo: "recordatorio",
      mensaje: `Se agendaron solas ${detalle.length} reunion${detalle.length === 1 ? "" : "es"} de cuentas nuevas: ${detalle.join(", ")}. Confirmá el día con cada cliente o movelas en la Agenda.`,
      link: "/agenda",
      task_id: null,
    });
  }
  return { agendadas: detalle.length, detalle };
}

/**
 * El aviso de la mañana: si hay cuentas nuevas en riesgo, a la PM y a la
 * dirección creativa de esas cuentas les llega un aviso (plataforma +
 * celular) con qué está mal en cada una. Nació porque el tablero existía y
 * había que acordarse de abrirlo; las reuniones mensuales se perdieron así.
 * Idempotente: un aviso por persona por día.
 */
export async function runAvisoCuentasEnRiesgo(
  admin: Admin,
  hoy: string
): Promise<{ enRiesgo: number; avisados: number }> {
  const { filas } = await cargarPanoramaArranques(admin, hoy);
  const salud = await computeAccountHealth(admin).catch(() => null);
  const { cuentas, equipo } = await cargarCuentasNuevas(admin, hoy, {
    arranques: arranquesPorCuenta(filas),
    salud: new Map((salud?.cuentas ?? []).map((c) => [c.id, { semaforo: c.semaforo, alertas: c.alertas }])),
  });
  const tablero = tableroCuentasNuevas(cuentas, hoy);
  const mensaje = avisoCuentasEnRiesgo(tablero);
  const enRiesgo = tablero.filter((f) => f.estado === "mal");
  if (!mensaje) return { enRiesgo: 0, avisados: 0 };

  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, area, area_secundaria")
    .eq("activo", true);
  const users = (usersRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const activos = new Set(users.map((u) => u.id));
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id;
  const destinatarios = [
    ...new Set(
      [pm, ...enRiesgo.map((f) => equipo.get(f.id)?.responsable)].filter(
        (x): x is string => !!x && activos.has(x)
      )
    ),
  ];
  if (destinatarios.length === 0) {
    const dueno = users.find((u) => u.rol === "admin")?.id;
    if (dueno) destinatarios.push(dueno);
  }

  const inicioDia = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const { data: ya } = await admin
    .from("notifications")
    .select("user_id")
    .in("user_id", destinatarios)
    .gte("created_at", inicioDia)
    .like("mensaje", `${PREFIJO_AVISO}%`);
  const yaAvisado = new Set(((ya ?? []) as { user_id: string }[]).map((n) => n.user_id));
  const nuevos = destinatarios.filter((u) => !yaAvisado.has(u));
  if (nuevos.length === 0) return { enRiesgo: enRiesgo.length, avisados: 0 };

  await admin.from("notifications").insert(
    nuevos.map((user_id) => ({ user_id, task_id: null, tipo: "recordatorio", mensaje, link: "/onboarding" }))
  );
  await sendPushToUsers(nuevos, {
    title: `${enRiesgo.length} cuenta${enRiesgo.length === 1 ? "" : "s"} nueva${enRiesgo.length === 1 ? "" : "s"} en riesgo`,
    body: mensaje.replace(`${PREFIJO_AVISO} (${enRiesgo.length}): `, ""),
    url: "/onboarding",
    tag: `cuentas-riesgo-${hoy}`,
  });
  return { enRiesgo: enRiesgo.length, avisados: nuevos.length };
}
