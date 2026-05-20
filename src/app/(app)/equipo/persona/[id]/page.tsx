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
import { PAY_FREQUENCY_LABEL, ROLE_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import type { AppUser, Compensation, Position, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonalInfoDialog } from "@/components/personal-info-dialog";
import { CompensationFormDialog } from "@/components/compensation-form-dialog";

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
  const [{ data: user }, { data: comp }] = await Promise.all([
    supabase.from("users").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("compensation").select("*").eq("user_id", params.id).maybeSingle(),
  ]);
  if (!user) notFound();
  const u = user as AppUser;
  const position = u.position_id
    ? ((await supabase.from("positions").select("*").eq("id", u.position_id).maybeSingle()).data as Position | null)
    : null;
  const c = comp as Compensation | null;

  const eff = c ?? {
    monto: position?.pago_default_monto ?? null,
    moneda: position?.pago_default_moneda ?? "ARS",
    frecuencia: position?.pago_default_frecuencia ?? null,
    forma_pago: position?.pago_default_forma ?? null,
    notas: position?.pago_default_notas ?? null,
  };

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

        {/* Pago */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Pago</CardTitle>
            {isAdmin && (
              <CompensationFormDialog
                userId={u.id}
                userName={u.nombre}
                current={c}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                }
              />
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {eff.monto == null ? (
              <p className="text-muted-foreground">
                Sin compensación cargada todavía.
              </p>
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums">
                  {eff.moneda} {Number(eff.monto).toLocaleString("es-AR")}
                  {eff.frecuencia && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      · {PAY_FREQUENCY_LABEL[eff.frecuencia] ?? eff.frecuencia}
                    </span>
                  )}
                </div>
                {eff.forma_pago && (
                  <Row icon={CreditCard} label="Forma de pago">
                    {eff.forma_pago}
                  </Row>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {c ? "Override individual." : "Heredado del puesto."}
                </p>
              </>
            )}

            {/* Datos bancarios */}
            {(u.cbu || u.alias_cbu || u.titular_cuenta) && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <h4 className="text-xs font-semibold text-muted-foreground">
                  Datos bancarios
                </h4>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
