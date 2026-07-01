// Ensamblado de la nómina de un período: combina la nómina automática (modelo
// de tarifas) con comisiones, bonus por volumen, jornadas de producción y los
// ítems manuales cargados, devolviendo la lista de personas con su total.
//
// Se extrajo de /coordinacion/sueldos para poder reutilizarlo en la vista
// self-service de cada colaborador (/mi-perfil), sin duplicar el cálculo.

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextPeriod } from "./finanzas";
import { mergeSettings, serviceDeliveryCost, type AgencySettings } from "./coordinacion";
import { SERVICE_TYPE_LABEL } from "./constants";
import { computeJornadaSplit } from "./jornada";
import {
  computeAutoPayroll,
  computeContentPayroll,
  computePackContentPayroll,
  computeDesignCoordinationLines,
  computeCoordinationPayroll,
  closerVolumeBonusPct,
  selectFirstMonthCommissions,
  decodeCommissionNote,
  COMERCIAL_FIXED_MENSUAL,
  type PayrollClient,
  type PayrollService,
  type PayrollPublication,
  type PayrollLine,
  type PersonPayroll,
  type CoordinationSplit,
} from "./payroll";

interface ServiceRow extends PayrollService {
  monto_mensual: number | null;
  facturacion: string | null;
  activo: boolean;
  costo_pct: number | null;
  created_at: string | null;
}

/**
 * Desde este período (inclusive) el diseño y la edición se pagan por el
 * CONTENIDO REAL publicado. Los meses anteriores se pagan por el pack contratado
 * (ej: junio 2026, donde el calendario no reflejó del todo lo producido).
 */
const CONTENT_PAYROLL_FROM = "2026-07";

export interface PeriodPayrollResult {
  periodo: string;
  people: PersonPayroll[];
  totalNomina: number;
  salaryConcepto: string;
  clientOptions: { id: string; nombre: string; abono: number }[];
  teamOptions: { id: string; nombre: string; rol: string }[];
  commission: { cierre: number; leadPropio: number };
  /** Comisión base de coordinación (ej 0.10) y reparto excepcional del mes. */
  coordinacion: { pct: number; split: { userId: string; pct: number }[] };
}

/**
 * Calcula la nómina completa del período para TODAS las personas. Usa el admin
 * client porque cruza tablas financieras; los callers deciden qué exponer (el
 * panel admin muestra todo; la vista self-service filtra a la persona logueada).
 */
export async function buildPeriodPayroll(
  admin: SupabaseClient,
  periodo: string
): Promise<PeriodPayrollResult> {
  const [
    { data: settingsRow },
    { data: clientsRaw },
    { data: servicesRaw },
    { data: usersRaw },
    { data: itemsRaw },
    { data: paymentsRaw },
    { data: sessionsRaw },
    { data: pubsRaw },
    { data: splitRaw },
    { data: dgApprovalsRaw },
  ] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin
      .from("clients")
      .select(
        "id, nombre, cm_id, disenador_id, audiovisual_id, media_buyer_id, coordinador_id, cerrado_por_id, fecha_inicio"
      )
      .eq("estado", "activo")
      .eq("es_interno", false),
    admin
      .from("client_services")
      .select(
        "cliente_id, tipo, pack, pack_detalle, monto_mensual, facturacion, activo, costo_override, costo_pct, costo_override_user, created_at, media_buyer_user_id, media_buyer_aplica"
      )
      .eq("activo", true),
    admin
      .from("users")
      .select("id, nombre, rol, rol_secundario, alias_cbu, cbu, titular_cuenta")
      .eq("activo", true),
    admin
      .from("payroll_items")
      .select("id, user_id, tipo, concepto, monto, cliente_id, notas")
      .eq("periodo", periodo),
    admin
      .from("team_payments")
      .select("id, user_id, concepto, monto, fecha_pago")
      .eq("periodo", periodo),
    admin
      .from("production_sessions")
      .select("id, fecha, monto, cliente_id, lugar, asistentes")
      .eq("periodo", periodo),
    // Publicaciones aprobadas/publicadas del período → pago por contenido real.
    admin
      .from("publications")
      .select("cliente_id, tipo, estado, fecha_publicacion, audiovisual_id, disenador_id")
      .in("estado", ["aprobado", "publicado"])
      .gte("fecha_publicacion", `${periodo}-01`)
      .lt("fecha_publicacion", `${nextPeriod(periodo)}-01`),
    // Excepción de reparto de coordinación de ESTE mes (vacío = default).
    admin
      .from("payroll_coordination_splits")
      .select("user_id, pct")
      .eq("periodo", periodo),
    // Manuales de marca aprobados por la coordinación de diseño ESTE mes.
    admin
      .from("client_onboarding")
      .select("cliente_id, dg_aprobado_at")
      .gte("dg_aprobado_at", `${periodo}-01`)
      .lt("dg_aprobado_at", `${nextPeriod(periodo)}-01`),
  ]);

  const settings: AgencySettings = mergeSettings(settingsRow);
  const clients = (clientsRaw ?? []) as PayrollClient[];
  const services = (servicesRaw ?? []) as ServiceRow[];
  const users = (usersRaw ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    rol_secundario: string | null;
    alias_cbu: string | null;
    cbu: string | null;
    titular_cuenta: string | null;
  }[];
  // Mira rol primario y secundario (quien cumple 2 funciones cuenta para ambas).
  const isRole = (u: { rol: string; rol_secundario: string | null }, r: string) =>
    u.rol === r || u.rol_secundario === r;
  const items = (itemsRaw ?? []) as {
    id: string;
    user_id: string;
    tipo: "comision" | "extra" | "ajuste";
    concepto: string;
    monto: number;
    cliente_id: string | null;
    notas: string | null;
  }[];
  const payments = (paymentsRaw ?? []) as {
    id: string;
    user_id: string;
    concepto: string;
    monto: number;
    fecha_pago: string | null;
  }[];

  const fallbackMediaBuyer = users.find((u) => isRole(u, "paid_media"))?.id ?? null;

  // ── Nómina automática (modelo de tarifas) ──
  const autoByUser = computeAutoPayroll(clients, services, settings.rates, fallbackMediaBuyer);

  // ── Diseño y edición por contenido REAL del mes ──
  // Las cuentas con acuerdo fijo (override) cobran un monto único que cubre toda
  // la gestión: no se les paga contenido aparte.
  const overrideClientIds = new Set(
    services
      .filter((s) => s.tipo === "gestion_redes" && s.costo_override != null)
      .map((s) => s.cliente_id)
  );
  const publications = (pubsRaw ?? []) as PayrollPublication[];
  // Desde julio 2026: por contenido real. Antes: por el pack contratado.
  const contentByUser =
    periodo >= CONTENT_PAYROLL_FROM
      ? computeContentPayroll(clients, publications, overrideClientIds, settings.rates, periodo)
      : computePackContentPayroll(clients, services, settings.rates);
  for (const [uid, lines] of contentByUser) {
    if (!autoByUser.has(uid)) autoByUser.set(uid, []);
    autoByUser.get(uid)!.push(...lines);
  }

  // Coordinación de DISEÑO: 5% del diseño publicado del mes + plus por manual de
  // marca aprobado, para quien tenga el rol coordinador_diseno (Bri). Usa la
  // misma base "por publicado" que los diseñadores → solo desde el corte.
  if (periodo >= CONTENT_PAYROLL_FROM) {
    const coordDiseno = users.find((u) => isRole(u, "coordinador_diseno"));
    if (coordDiseno) {
      const clienteNombre = new Map(clients.map((c) => [c.id, c.nombre]));
      const manualAprobados = ((dgApprovalsRaw ?? []) as { cliente_id: string }[])
        .filter((r) => clienteNombre.has(r.cliente_id)) // excluye internas/inactivas
        .map((r) => ({ clienteId: r.cliente_id, cliente: clienteNombre.get(r.cliente_id)! }));
      const dgLines = computeDesignCoordinationLines(
        clients,
        publications,
        overrideClientIds,
        settings.rates,
        periodo,
        manualAprobados
      );
      if (dgLines.length > 0) {
        if (!autoByUser.has(coordDiseno.id)) autoByUser.set(coordDiseno.id, []);
        autoByUser.get(coordDiseno.id)!.push(...dgLines);
      }
    }
  }

  // Fijo mensual del/los comercial(es) por gestión de mensajes y leads.
  const comercialFijo = settings.rates.comercial_fijo ?? COMERCIAL_FIXED_MENSUAL;
  for (const u of users) {
    if (!isRole(u, "comercial")) continue;
    if (comercialFijo <= 0) continue;
    if (!autoByUser.has(u.id)) autoByUser.set(u.id, []);
    autoByUser.get(u.id)!.push({
      clienteId: null,
      cliente: "—",
      concepto: "Gestión de mensajes (fijo mensual)",
      monto: comercialFijo,
      kind: "extra",
    });
  }

  // Comisión recurrente de coordinación: % del abono mensual del servicio de
  // gestión de redes de cada cuenta, atribuida a la coordinadora DE ESA CUENTA
  // (o repartida según la excepción del mes, si la hay).
  const coordPct = settings.rates.comision_coordinacion ?? 0;
  const fallbackCoordinador = users.find((u) => isRole(u, "coordinador"))?.id ?? null;
  const gdrByClient = new Map<string, number>();
  for (const s of services) {
    if (s.tipo !== "gestion_redes") continue;
    if (s.facturacion === "unico") continue;
    gdrByClient.set(
      s.cliente_id,
      (gdrByClient.get(s.cliente_id) ?? 0) + (Number(s.monto_mensual) || 0)
    );
  }
  const coordSplit = ((splitRaw ?? []) as { user_id: string; pct: number }[]).map((s) => ({
    userId: s.user_id,
    pct: Number(s.pct),
  })) as CoordinationSplit[];
  const coordByUser = computeCoordinationPayroll(
    clients,
    gdrByClient,
    coordPct,
    fallbackCoordinador,
    coordSplit.length > 0 ? coordSplit : null
  );
  for (const [uid, lines] of coordByUser) {
    if (!autoByUser.has(uid)) autoByUser.set(uid, []);
    autoByUser.get(uid)!.push(...lines);
  }

  // ── Comisión de cierre AUTOMÁTICA del primer mes ──
  // Cada cliente cuya fecha de inicio cae en este período genera, una sola vez,
  // la comisión del comercial que lo cerró (clients.cerrado_por_id), calculada
  // sobre el abono mensual recurrente. Si ya se cargó una comisión manual para
  // esa cuenta, no se duplica. El bonus por volumen (más abajo) también cuenta
  // estos cierres automáticos.
  const recurringByClient = new Map<string, number>();
  for (const s of services) {
    if (s.facturacion === "unico") continue;
    recurringByClient.set(
      s.cliente_id,
      (recurringByClient.get(s.cliente_id) ?? 0) + (Number(s.monto_mensual) || 0)
    );
  }
  const cierrePct = settings.rates.comision_cierre ?? 0.1;
  const firstMonthCommissions = selectFirstMonthCommissions(
    clients,
    recurringByClient,
    periodo,
    cierrePct,
    (clienteId) => items.some((i) => i.tipo === "comision" && i.cliente_id === clienteId)
  );
  const autoCierreBasesByUser = new Map<string, number[]>();
  for (const fc of firstMonthCommissions) {
    if (!autoByUser.has(fc.closerId)) autoByUser.set(fc.closerId, []);
    autoByUser.get(fc.closerId)!.push({
      clienteId: fc.clienteId,
      cliente: fc.cliente,
      concepto: `Comisión cierre (${Math.round(cierrePct * 100)}%) · primer mes`,
      monto: fc.monto,
      kind: "comision",
    });
    const arr = autoCierreBasesByUser.get(fc.closerId) ?? [];
    arr.push(fc.base);
    autoCierreBasesByUser.set(fc.closerId, arr);
  }

  // Jornadas de producción del mes. Reparto (ver lib/jornada): viáticos en partes
  // iguales + resto 50% director / 30% acompañante / 20% agencia. Por convención
  // asistentes[0] = director/a, asistentes[1] = acompañante.
  const sessions = (sessionsRaw ?? []) as {
    id: string;
    fecha: string;
    monto: number;
    cliente_id: string | null;
    lugar: string | null;
    asistentes: string[];
  }[];
  for (const s of sessions) {
    const asistentes = s.asistentes ?? [];
    if (asistentes.length === 0) continue;
    const directorId = asistentes[0];
    const acompananteId = asistentes[1] ?? null;
    const split = computeJornadaSplit(Number(s.monto), !!acompananteId);
    const detalle = s.lugar ?? new Date(s.fecha + "T12:00:00").toLocaleDateString("es-AR");
    if (!autoByUser.has(directorId)) autoByUser.set(directorId, []);
    autoByUser.get(directorId)!.push({
      clienteId: s.cliente_id,
      cliente: "—",
      concepto: `Jornada de producción (dirige) · ${detalle}`,
      monto: split.director,
      kind: "extra",
    });
    if (acompananteId && split.acompanante != null) {
      if (!autoByUser.has(acompananteId)) autoByUser.set(acompananteId, []);
      autoByUser.get(acompananteId)!.push({
        clienteId: s.cliente_id,
        cliente: "—",
        concepto: `Jornada de producción (acompaña) · ${detalle}`,
        monto: split.acompanante,
        kind: "extra",
      });
    }
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const clientById = new Map(clients.map((c) => [c.id, c.nombre]));
  const salaryConcepto = `Sueldo ${periodo}`;

  // Costo de entrega de servicios que no son gestión de redes (branding, web,
  // botly, diseño suelto…): % del monto o fijo, pagado a quien lo entrega. Los
  // recurrentes se pagan cada mes; los de cobro único, solo en el mes en que se
  // cargaron (created_at). Las cuentas internas (JD MEDIA) no se incluyen.
  for (const s of services) {
    const esUnico = (s.facturacion ?? "mensual") === "unico";
    if (esUnico && (s.created_at ?? "").slice(0, 7) !== periodo) continue;
    const dc = serviceDeliveryCost(s);
    if (!dc || !dc.userId || dc.monto <= 0) continue;
    if (!autoByUser.has(dc.userId)) autoByUser.set(dc.userId, []);
    autoByUser.get(dc.userId)!.push({
      clienteId: s.cliente_id,
      cliente: clientById.get(s.cliente_id) ?? "—",
      concepto: `${SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo}${esUnico ? " (proyecto)" : ""}`,
      monto: dc.monto,
      kind: "extra",
    });
  }

  // Combinar auto + ítems manuales en una nómina por persona.
  const personIds = new Set<string>([...autoByUser.keys(), ...items.map((i) => i.user_id)]);

  const people: PersonPayroll[] = [];
  for (const uid of personIds) {
    const u = userById.get(uid);
    if (!u) continue; // persona inactiva con ítems viejos: la salteamos
    const baseAutoLines = autoByUser.get(uid) ?? [];

    // Bonus por volumen de cierres del mes (closer): +2% cada 2 clientes, tope 6%.
    // Cuenta tanto las comisiones manuales como las automáticas del primer mes.
    const cierresManual = items
      .filter((i) => i.user_id === uid && i.tipo === "comision")
      .map((i) => decodeCommissionNote(i.notas))
      .filter(
        (d): d is { role: "closer" | "both" | "ref"; base: number } =>
          !!d && (d.role === "closer" || d.role === "both")
      )
      .map((d) => d.base);
    const cierreBases = [...cierresManual, ...(autoCierreBasesByUser.get(uid) ?? [])];
    const bonusPct = closerVolumeBonusPct(cierreBases.length);
    const bonusLine: PayrollLine | null =
      bonusPct > 0
        ? {
            clienteId: null,
            cliente: "—",
            concepto: `Bonus por volumen · ${cierreBases.length} cierres (${Math.round(
              bonusPct * 100
            )}%)`,
            monto: Math.round(cierreBases.reduce((a, b) => a + b, 0) * bonusPct),
            kind: "comision",
          }
        : null;

    const autoLines = bonusLine ? [...baseAutoLines, bonusLine] : baseAutoLines;
    const manualLines = items.filter((i) => i.user_id === uid);

    const auto = autoLines.reduce((a, l) => a + l.monto, 0);
    const manual = manualLines.reduce((a, l) => a + Number(l.monto), 0);
    const pago = payments.find((p) => p.concepto === salaryConcepto && p.user_id === uid);

    people.push({
      userId: uid,
      nombre: u.nombre,
      rol: u.rol,
      alias: u.alias_cbu ?? u.cbu ?? null,
      titular: u.titular_cuenta ?? null,
      autoLines,
      manualItems: manualLines.map((i) => ({
        id: i.id,
        tipo: i.tipo,
        concepto: i.concepto,
        monto: Number(i.monto),
        cliente: i.cliente_id ? clientById.get(i.cliente_id) ?? null : null,
        clienteId: i.cliente_id,
      })),
      total: auto + manual,
      registrado: !!pago,
      pagado: !!pago?.fecha_pago,
    });
  }
  people.sort((a, b) => b.total - a.total);

  // ── Datos para los diálogos del panel admin ──
  // (recurringByClient ya se calculó arriba para la comisión automática.)
  const clientOptions = clients
    .map((c) => ({ id: c.id, nombre: c.nombre, abono: recurringByClient.get(c.id) ?? 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const teamOptions = users
    .map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totalNomina = people.reduce((a, p) => a + p.total, 0);

  return {
    periodo,
    people,
    totalNomina,
    salaryConcepto,
    clientOptions,
    teamOptions,
    commission: {
      cierre: settings.rates.comision_cierre ?? 0.1,
      leadPropio: settings.rates.comision_lead_propio ?? 0.05,
    },
    coordinacion: { pct: coordPct, split: coordSplit },
  };
}
