import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import {
  computeAutoPayroll,
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
  ] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin
      .from("clients")
      .select("id, nombre, cm_id, disenador_id, audiovisual_id, media_buyer_id")
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
    const autoLines = autoByUser.get(uid) ?? [];
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
      />
    </div>
  );
}
