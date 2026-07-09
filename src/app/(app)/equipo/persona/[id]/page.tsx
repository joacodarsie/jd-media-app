import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CreditCard,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  User as UserIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { ROLE_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { currentPeriod } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import type { AppUser, Position, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonalInfoDialog } from "@/components/personal-info-dialog";
import { MiSueldoCard } from "@/components/mi-sueldo-card";
import {
  MovimientosHistorialCard,
  type MovimientoRow,
} from "@/components/movimientos-historial-card";

export const dynamic = "force-dynamic";

export default async function PersonaDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const isAdmin = me.rol === "admin";
  const isSelf = me.id === params.id;
  const canSeePersonal = isAdmin || isSelf;
  if (!canSeePersonal) notFound();

  const supabase = createClient();
  const admin = createAdmin();
  const periodo = currentPeriod();
  const [{ data: user }, payroll, { data: paymentsRaw }] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "id, nombre, email, avatar_url, area, rol, position_id, secondary_position_ids, activo, telefono, fecha_ingreso"
        )
        .eq("id", params.id)
        .maybeSingle(),
      // Sueldo del mes en curso (acceso ya gateado a admin o la propia persona).
      buildPeriodPayroll(admin, periodo).catch(() => null),
      // Historial de pagos al equipo de esta persona (últimos 12).
      admin
        .from("team_payments")
        .select("id, periodo, concepto, monto, moneda, fecha_programada, fecha_pago")
        .eq("user_id", params.id)
        .order("periodo", { ascending: false })
        .order("fecha_programada", { ascending: false })
        .limit(12),
    ]);
  if (!user) notFound();
  const u = user as AppUser;
  const position = u.position_id
    ? ((
        await supabase
          .from("positions")
          .select("id, nombre, area, descripcion, services")
          .eq("id", u.position_id)
          .maybeSingle()
      ).data as Position | null)
    : null;

  // Sueldo calculado del mes en curso para esta persona.
  const miSueldo = payroll?.people.find((p) => p.userId === params.id) ?? null;

  // Historial de pagos normalizado para la card.
  const hoy = new Date().toISOString().slice(0, 10);
  const paymentRows: MovimientoRow[] = (
    (paymentsRaw ?? []) as {
      id: string;
      periodo: string;
      concepto: string;
      monto: number;
      moneda: string;
      fecha_programada: string;
      fecha_pago: string | null;
    }[]
  ).map((p) => ({
    id: p.id,
    concepto: p.concepto,
    periodo: p.periodo,
    monto: Number(p.monto),
    moneda: p.moneda,
    estado: p.fecha_pago ? "pagado" : p.fecha_programada < hoy ? "vencido" : "pendiente",
    fecha: p.fecha_pago ?? p.fecha_programada,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/equipo/personas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Personas
        </Link>
        <PersonalInfoDialog
          user={u}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" /> Editar datos
            </Button>
          }
        />
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-foreground">
            {u.nombre.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{u.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {position ? (
                <Link
                  href={`/equipo/${position.id}`}
                  className="font-medium hover:underline"
                >
                  {position.nombre}
                </Link>
              ) : (
                "Sin puesto"
              )}
              {" · "}
              {ROLE_LABEL[u.rol as UserRole] ?? u.rol}
              {" · "}
              {u.area}
            </p>
          </div>
        </div>
      </div>

      {/* Sueldo calculado del mes en curso (automático, real) */}
      <MiSueldoCard person={miSueldo} periodo={periodo} title="Sueldo de este mes" />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Datos de contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={Mail} label="Email">
              <a href={`mailto:${u.email}`} className="hover:underline">
                {u.email}
              </a>
            </Row>
            {u.telefono && (
              <Row icon={Phone} label="Teléfono">
                <a href={`tel:${u.telefono}`} className="hover:underline">
                  {u.telefono}
                </a>
              </Row>
            )}
            {u.fecha_ingreso && (
              <Row icon={CalendarDays} label="En la agencia desde">
                {fmtDate(u.fecha_ingreso)}
              </Row>
            )}
            {u.dni_cuit && (
              <Row icon={UserIcon} label="DNI / CUIT">
                {u.dni_cuit}
              </Row>
            )}
          </CardContent>
        </Card>

        {/* Datos bancarios (el sueldo real del mes está en la card de arriba) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos bancarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {u.cbu || u.alias_cbu || u.titular_cuenta ? (
              <>
                {u.alias_cbu && (
                  <Row icon={KeyRound} label="Alias">
                    <code className="select-all rounded bg-muted px-1.5 py-0.5 text-xs">
                      {u.alias_cbu}
                    </code>
                  </Row>
                )}
                {u.cbu && (
                  <Row icon={CreditCard} label="CBU">
                    <code className="select-all rounded bg-muted px-1.5 py-0.5 text-xs">
                      {u.cbu}
                    </code>
                  </Row>
                )}
                {u.titular_cuenta && (
                  <Row icon={UserIcon} label="Titular">
                    {u.titular_cuenta}
                  </Row>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin datos bancarios cargados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de pagos al equipo */}
      <MovimientosHistorialCard
        title="Historial de pagos"
        rows={paymentRows}
        estadoLabels={{ pagado: "Pagado", pendiente: "Programado", vencido: "Atrasado" }}
        emptyText="Todavía no hay pagos registrados para esta persona."
      />

      {position && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Puesto
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/equipo/${position.id}`}
              className="text-base font-semibold hover:underline"
            >
              {position.nombre}
            </Link>
            {position.descripcion && (
              <p className="mt-1 text-muted-foreground">{position.descripcion}</p>
            )}
            <Link
              href={`/equipo/${position.id}`}
              className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
            >
              Ver alcance y procesos completos →
            </Link>
          </CardContent>
        </Card>
      )}

      {u.notas_personales && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
            {u.notas_personales}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}
