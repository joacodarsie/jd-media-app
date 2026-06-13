import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import {
  computeAutoPayroll,
  closerVolumeBonusPct,
  decodeCommissionNote,
  COMERCIAL_FIXED_MENSUAL,
  type PayrollClient,
  type PayrollService,
  type PayrollLine,
} from "@/lib/payroll";
import { currentPeriod } from "@/lib/finanzas";
import { SueldosPanel, type PersonPayroll, type MediaBuyerAccount } from "@/components/sueldos-panel";

export const dynamic = "force-dynamic";

interface ServiceRow extends PayrollService {
  monto_mensual: number | null;
  facturacion: string | null;
  activo: boolean;
}

export default async function SueldosPage({
  searchParams,
}: {
  searchParams: { periodo?: string };
}) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const periodo = searchParams.periodo ?? currentPeriod();

  const [
    { data: settingsRow },
    { data: clientsRaw },
    { data: servicesRaw },
    { data: usersRaw },
    { data: itemsRaw },
    { data: paymentsRaw },
    { data: sessionsRaw },
  ] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin
      .from("clients")
      .select("id, nombre, cm_id, disenador_id, audiovisual_id, media_buyer_id, coordinador_id")
      .eq("estado", "activo")
      .eq("es_interno", false),
    admin
      .from("client_services")
      .select(
        "cliente_id, tipo, pack, pack_detalle, monto_mensual, facturacion, activo, costo_override, costo_override_user, media_buyer_user_id, media_buyer_aplica"
      )
      .eq("activo", true),
    admin.from("users").select("id, nombre, rol, alias_cbu, cbu, titular_cuenta").eq("activo", true),
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
  ]);

  const settings: AgencySettings = mergeSettings(settingsRow);
  const clients = (clientsRaw ?? []) as PayrollClient[];
  const services = (servicesRaw ?? []) as ServiceRow[];
  const users = (usersRaw ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    alias_cbu: string | null;
    cbu: string | null;
    titular_cuenta: string | null;
  }[];
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

  const fallbackMediaBuyer =
    users.find((u) => u.rol === "paid_media")?.id ?? null;

  // ── Nómina automática (modelo de tarifas) ──
  const autoByUser = computeAutoPayroll(clients, services, settings.rates, fallbackMediaBuyer);

  // Fijo mensual del/los comercial(es) por gestión de mensajes y leads (aparte
  // de las comisiones). Editable desde Coordinación.
  const comercialFijo = settings.rates.comercial_fijo ?? COMERCIAL_FIXED_MENSUAL;
  for (const u of users) {
    if (u.rol !== "comercial") continue;
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
  // gestión de redes de cada cuenta, atribuida al coordinador/a DE ESA CUENTA
  // (clients.coordinador_id; fallback al único coordinador activo).
  const coordPct = settings.rates.comision_coordinacion ?? 0;
  const fallbackCoordinador = users.find((u) => u.rol === "coordinador")?.id ?? null;
  if (coordPct > 0) {
    const gdrByClient = new Map<string, number>();
    for (const s of services) {
      if (s.tipo !== "gestion_redes") continue;
      if (s.facturacion === "unico") continue;
      gdrByClient.set(
        s.cliente_id,
        (gdrByClient.get(s.cliente_id) ?? 0) + (Number(s.monto_mensual) || 0)
      );
    }
    for (const c of clients) {
      const abono = gdrByClient.get(c.id) ?? 0;
      if (abono <= 0) continue;
      const who = c.coordinador_id ?? fallbackCoordinador;
      if (!who) continue;
      const monto = Math.round(abono * coordPct);
      if (!autoByUser.has(who)) autoByUser.set(who, []);
      autoByUser.get(who)!.push({
        clienteId: c.id,
        cliente: c.nombre,
        concepto: `Coordinación gestión de redes (${Math.round(coordPct * 100)}%)`,
        monto,
        kind: "comision",
      });
    }
  }

  // Jornadas de producción del mes: el monto se reparte en partes iguales
  // entre los asistentes y se suma a la nómina de cada uno.
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
    const porPersona = Math.round(Number(s.monto) / asistentes.length);
    const detalle = s.lugar ?? new Date(s.fecha + "T12:00:00").toLocaleDateString("es-AR");
    for (const uid of asistentes) {
      if (!autoByUser.has(uid)) autoByUser.set(uid, []);
      autoByUser.get(uid)!.push({
        clienteId: s.cliente_id,
        cliente: "—",
        concepto: `Jornada de producción · ${detalle}`,
        monto: porPersona,
        kind: "extra",
      });
    }
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const clientById = new Map(clients.map((c) => [c.id, c.nombre]));
  const SALARY_CONCEPTO = `Sueldo ${periodo}`;

  // Combinar auto + ítems manuales en una nómina por persona.
  const personIds = new Set<string>([
    ...autoByUser.keys(),
    ...items.map((i) => i.user_id),
  ]);

  const people: PersonPayroll[] = [];
  for (const uid of personIds) {
    const u = userById.get(uid);
    if (!u) continue; // persona inactiva con ítems viejos: la salteamos
    const baseAutoLines = autoByUser.get(uid) ?? [];

    // Bonus por volumen de cierres del mes (closer): +2% cada 2 clientes, tope 6%.
    const cierres = items
      .filter((i) => i.user_id === uid && i.tipo === "comision")
      .map((i) => decodeCommissionNote(i.notas))
      .filter(
        (d): d is { role: "closer" | "both" | "ref"; base: number } =>
          !!d && (d.role === "closer" || d.role === "both")
      );
    const bonusPct = closerVolumeBonusPct(cierres.length);
    const bonusLine: PayrollLine | null =
      bonusPct > 0
        ? {
            clienteId: null,
            cliente: "—",
            concepto: `Bonus por volumen · ${cierres.length} cierres (${Math.round(
              bonusPct * 100
            )}%)`,
            monto: Math.round(cierres.reduce((a, c) => a + c.base, 0) * bonusPct),
            kind: "comision",
          }
        : null;

    const autoLines = bonusLine ? [...baseAutoLines, bonusLine] : baseAutoLines;
    const manualLines: PayrollLine[] = items
      .filter((i) => i.user_id === uid)
      .map((i) => ({
        clienteId: i.cliente_id,
        cliente: i.cliente_id ? clientById.get(i.cliente_id) ?? "—" : "—",
        concepto: i.concepto,
        monto: Number(i.monto),
        kind: i.tipo,
      }));

    const auto = autoLines.reduce((a, l) => a + l.monto, 0);
    const manual = manualLines.reduce((a, l) => a + l.monto, 0);
    const pago = payments.find((p) => p.concepto === SALARY_CONCEPTO && p.user_id === uid);

    people.push({
      userId: uid,
      nombre: u.nombre,
      rol: u.rol,
      alias: u.alias_cbu ?? u.cbu ?? null,
      titular: u.titular_cuenta ?? null,
      autoLines,
      manualItems: items
        .filter((i) => i.user_id === uid)
        .map((i) => ({
          id: i.id,
          tipo: i.tipo,
          concepto: i.concepto,
          monto: Number(i.monto),
          cliente: i.cliente_id ? clientById.get(i.cliente_id) ?? null : null,
        })),
      total: auto + manual,
      registrado: !!pago,
      pagado: !!pago?.fecha_pago,
    });
  }
  people.sort((a, b) => b.total - a.total);

  // ── Datos para los diálogos ──
  // Clientes con abono recurrente (para base de comisión).
  const recurringByClient = new Map<string, number>();
  for (const s of services) {
    if (s.facturacion === "unico") continue;
    recurringByClient.set(
      s.cliente_id,
      (recurringByClient.get(s.cliente_id) ?? 0) + (Number(s.monto_mensual) || 0)
    );
  }
  const clientOptions = clients
    .map((c) => ({ id: c.id, nombre: c.nombre, abono: recurringByClient.get(c.id) ?? 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const teamOptions = users
    .map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Cuentas con media buyer (servicio paid_media activo) para el toggle.
  const mbAccounts: MediaBuyerAccount[] = [];
  for (const s of services) {
    if (s.tipo !== "paid_media") continue;
    const nombre = clientById.get(s.cliente_id);
    if (!nombre) continue;
    mbAccounts.push({
      clienteId: s.cliente_id,
      cliente: nombre,
      aplica: s.media_buyer_aplica !== false,
      userId: s.media_buyer_user_id ?? fallbackMediaBuyer,
    });
  }
  mbAccounts.sort((a, b) => a.cliente.localeCompare(b.cliente));

  const totalNomina = people.reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Sueldos</h1>
        <p className="text-muted-foreground">
          Nómina del mes calculada automática desde el modelo de tarifas
          (CM, diseño, edición, media buyer y acuerdos fijos), más comisiones y
          extras que cargues a mano. Solo vos lo ves.
        </p>
      </div>
      <SueldosPanel
        periodo={periodo}
        people={people}
        totalNomina={totalNomina}
        salaryConcepto={SALARY_CONCEPTO}
        clientOptions={clientOptions}
        teamOptions={teamOptions}
        mbAccounts={mbAccounts}
        commission={{
          cierre: settings.rates.comision_cierre ?? 0.1,
          leadPropio: settings.rates.comision_lead_propio ?? 0.05,
        }}
      />
    </div>
  );
}
