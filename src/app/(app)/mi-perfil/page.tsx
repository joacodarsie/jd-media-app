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
import { Bell } from "lucide-react";
import { MiFoto } from "@/components/mi-foto";
import { SonidosToggle } from "@/components/sonidos-toggle";
import { MisDatosCard, MiAccesoCard } from "@/components/mis-datos-card";
import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { TusObjetivos } from "@/components/tus-objetivos";
import { mergeSettings } from "@/lib/coordinacion";
import { comoCobras, proximoCobro } from "@/lib/equipo/como-cobras";
import { hoyYmd } from "@/lib/dates";
import { RolVista, type PuestoDB } from "@/components/rol-vista";
import { rolDe } from "@/lib/equipo/roles";

export const dynamic = "force-dynamic";

export default async function MiPerfilPage() {
  const me = await requireUser();
  const supabase = createClient();

  const periodo = currentPeriod();
  // El puesto sale del área (uno por área), no de una asignación a mano (21/10/2026).
  // Con dos áreas (ej. Comercial + Dirección Creativa) se ven los dos manuales.
  const misAreas = [me.area, (me as { area_secundaria?: string | null }).area_secundaria].filter(Boolean) as string[];
  const [{ data: puestosRaw }, payroll] = await Promise.all([
    misAreas.length
      ? supabase
          .from("positions")
          .select("id, nombre, area, descripcion, alcance_incluye, alcance_excluye, kpis, procesos, services, pago_default_monto, pago_default_moneda, pago_default_frecuencia")
          .in("area", misAreas)
      : Promise.resolve({ data: [] }),
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

      <Card id="foto" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <MiFoto userId={me.id} nombre={me.nombre} url={me.avatar_url ?? null} urlWeb={me.avatar_web_url ?? null} fotoWeb={me.foto_web === "original" ? "original" : "gris"} />
          <SonidosToggle />
          <div className="space-y-1 border-t pt-3">
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

      {/* Datos personales, de facturación y el acceso (19/10/2026, 0209). */}
      {(() => {
        const u = me as unknown as { telefono?: string | null; whatsapp_phone?: string | null; dni_cuit?: string | null; condicion_fiscal?: string | null; domicilio?: string | null; acceso_confirmado_at?: string | null };
        return (
          <>
            <MisDatosCard
              nombre={me.nombre}
              telefono={u.telefono ?? u.whatsapp_phone ?? null}
              dniCuit={u.dni_cuit ?? null}
              condicionFiscal={u.condicion_fiscal ?? null}
              domicilio={u.domicilio ?? null}
            />
            <MiAccesoCard email={me.email} confirmado={!!u.acceso_confirmado_at} />
          </>
        );
      })()}

      {/* Tu rol, completo y visual (21/10/2026): la misma ficha del Directorio. */}
      {((puestosRaw ?? []) as Position[])
        .sort((a, b) => misAreas.indexOf(a.area) - misAreas.indexOf(b.area))
        .map((p) => {
          const rol = rolDe(p.area);
          return rol ? (
            <section key={p.id} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu rol y cómo se trabaja</h2>
              <RolVista rol={rol} puesto={p as unknown as PuestoDB} hoy={Number(hoyYmd().slice(8, 10))} compacto />
            </section>
          ) : null;
        })}

      {/* Cómo y cuándo cobrás: de las mismas tarifas que la nómina (21/10/2026). */}
      <ComoCobrasCard me={me as unknown as { id: string; rol: string; rol_secundario?: string | null; area?: string | null; area_secundaria?: string | null }} />

      {/* Tus objetivos, los mismos de Mi día. */}
      <Suspense fallback={null}>
        <TusObjetivos
          persona={{
            id: me.id,
            nombre: me.nombre,
            rol: me.rol,
            rol_secundario: (me as { rol_secundario?: string | null }).rol_secundario ?? null,
            area: me.area ?? null,
            area_secundaria: (me as { area_secundaria?: string | null }).area_secundaria ?? null,
          }}
        />
      </Suspense>

      <MiSueldoCard person={miSueldo} periodo={periodo} />

      <div id="cobro" className="scroll-mt-20" />
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

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

async function ComoCobrasCard({
  me,
}: {
  me: { id: string; rol: string; rol_secundario?: string | null; area?: string | null; area_secundaria?: string | null };
}) {
  const admin = createAdmin();
  const [{ data: settingsRow }, { data: extra }] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin.from("users").select("comercial_sin_fijo").eq("id", me.id).maybeSingle(),
  ]);
  const rates = mergeSettings(settingsRow).rates;
  const lineas = comoCobras({ ...me, comercial_sin_fijo: (extra as { comercial_sin_fijo?: boolean } | null)?.comercial_sin_fijo ?? false }, rates);
  const prox = proximoCobro(hoyYmd());
  const mesTrabajo = MESES[+prox.periodo.slice(5, 7) - 1];
  const diaPago = `7 de ${MESES[+prox.fecha.slice(5, 7) - 1]}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Cómo y cuándo cobrás
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {lineas.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-5">
            {lineas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Tu forma de cobro la acordás con la dirección.</p>
        )}
        <div className="rounded-lg bg-primary/10 px-3 py-2.5 ring-1 ring-primary/30">
          Se cobra <b>a mes vencido, el día 7</b>: lo que trabajás en {mesTrabajo} se transfiere el <b>{diaPago}</b>, al alias o CBU
          que cargues más abajo. El estimado del mes en curso lo ves en «Tu sueldo».
        </div>
      </CardContent>
    </Card>
  );
}
