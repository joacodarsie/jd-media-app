import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import type { Position } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiSueldoCard } from "@/components/mi-sueldo-card";
import { BankDetailsCard } from "@/components/bank-details-card";
import { WhatsAppOptinCard } from "@/components/whatsapp-optin-card";
import { GoogleCalendarCard } from "@/components/google-calendar-card";
import { BrowserNotificationsCard } from "@/components/browser-notifications-card";
import { ReplayTourButton } from "@/components/replay-tour-button";
import { PushToggle } from "@/components/push-toggle";
import { Markdown } from "@/components/markdown";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MiPerfilPage() {
  const me = await requireUser();
  const supabase = createClient();

  const periodo = currentPeriod();
  const [{ data: position }, payroll] = await Promise.all([
    me.position_id
      ? supabase
          .from("positions")
          .select("id, nombre, area, descripcion, alcance_incluye, alcance_excluye, kpis, procesos, services, pago_default_monto, pago_default_moneda, pago_default_frecuencia")
          .eq("id", me.position_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Nómina del mes en curso; solo renderizamos la fila de la persona logueada.
    buildPeriodPayroll(createAdmin(), periodo).catch(() => null),
  ]);

  const miSueldo = payroll?.people.find((p) => p.userId === me.id) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">Tu puesto, tu pago y tus datos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <div>
              <strong>{me.nombre}</strong>
            </div>
            <div className="text-muted-foreground">{me.email}</div>
            <div className="text-muted-foreground">{me.area}</div>
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Si querés volver a hacer el recorrido inicial por la app:
            </p>
            <ReplayTourButton />
          </div>
        </CardContent>
      </Card>

      {position && (() => {
        const p = position as Position & {
          alcance_incluye?: string | null;
          alcance_excluye?: string | null;
          kpis?: string | null;
          procesos?: string | null;
        };
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4" /> Tu puesto y tu proceso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <Link href={`/equipo/${p.id}`} className="font-semibold hover:underline">
                  {p.nombre}
                </Link>
                {p.descripcion && (
                  <p className="mt-1 text-muted-foreground">{p.descripcion}</p>
                )}
              </div>

              {(p.alcance_incluye || p.alcance_excluye) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.alcance_incluye && (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        Qué entra
                      </div>
                      <Markdown>{p.alcance_incluye}</Markdown>
                    </div>
                  )}
                  {p.alcance_excluye && (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                        Qué no entra
                      </div>
                      <Markdown>{p.alcance_excluye}</Markdown>
                    </div>
                  )}
                </div>
              )}

              {p.kpis && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    KPIs / objetivos
                  </div>
                  <Markdown>{p.kpis}</Markdown>
                </div>
              )}

              {p.procesos && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tu proceso (SOP)
                  </div>
                  <Markdown>{p.procesos}</Markdown>
                </div>
              )}

              <Link
                href={`/equipo/${p.id}`}
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                Ver el puesto completo →
              </Link>
            </CardContent>
          </Card>
        );
      })()}

      <MiSueldoCard person={miSueldo} periodo={periodo} />

      <BankDetailsCard
        initialAlias={(me as unknown as { alias_cbu?: string | null }).alias_cbu ?? null}
        initialCbu={(me as unknown as { cbu?: string | null }).cbu ?? null}
        initialTitular={
          (me as unknown as { titular_cuenta?: string | null }).titular_cuenta ?? null
        }
      />

      <GoogleCalendarCard userId={me.id} isAdmin={me.rol === "admin"} />

      <BrowserNotificationsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notificaciones push (móvil + escritorio)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PushToggle />
        </CardContent>
      </Card>

      <WhatsAppOptinCard
        initialPhone={
          (me as unknown as { whatsapp_phone?: string | null }).whatsapp_phone ?? null
        }
        initialOptin={
          (me as unknown as { whatsapp_optin?: boolean }).whatsapp_optin ?? false
        }
      />
    </div>
  );
}
