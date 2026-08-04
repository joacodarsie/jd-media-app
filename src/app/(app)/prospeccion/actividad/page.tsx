import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DIAS_INACTIVO,
  resumirActividad,
  type ContactoActividad,
} from "@/lib/prospecting/actividad";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "coordinador", "comercial", "prospecting"];
/** Quiénes se espera que prospecten (los que aparecen en la tabla). */
const ROLES_PROSPECTAN = ["comercial", "prospecting", "coordinador", "admin"];

/**
 * "¿Quién está escribiendo?" — el tablero de la prospección manual.
 *
 * Existe porque la app tenía 132 contactos cargados y **1 solo contactado en
 * los últimos 7 días**. Nadie mentía: simplemente nadie miraba. Un contacto que
 * nadie contacta no vale nada, y la única forma de que el hábito ocurra es que
 * el número esté a la vista todos los días.
 */
export default async function ActividadProspeccionPage() {
  await requireRole(ALLOWED);
  const admin = createAdmin();
  const hoy = hoyYmd();

  const [{ data: contactosRaw }, { data: usersRaw }] = await Promise.all([
    admin.from("prospecting_contacts").select("asignado_a, contactado_at, estado, reunion_at"),
    admin.from("users").select("id, nombre, email, rol, rol_secundario").eq("activo", true),
  ]);

  const personas = ((usersRaw ?? []) as {
    id: string;
    nombre: string;
    email: string | null;
    rol: string;
    rol_secundario: string | null;
  }[])
    .filter(
      (u) => ROLES_PROSPECTAN.includes(u.rol) || ROLES_PROSPECTAN.includes(u.rol_secundario ?? "")
    )
    .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }));

  const r = resumirActividad(
    (contactosRaw ?? []) as ContactoActividad[],
    personas,
    hoy
  );

  const sinDueno = ((contactosRaw ?? []) as ContactoActividad[]).filter(
    (c) => c.contactado_at && !c.asignado_a
  ).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/prospeccion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Prospección
        </Link>
        <h1 className="mt-1 text-2xl font-bold">¿Quién está escribiendo?</h1>
        <p className="text-muted-foreground">
          Mensajes en frío enviados por cada uno. La meta del equipo es de{" "}
          <b>{r.metaEquipoHoy} por día</b>, repartida según quién prospecta.
        </p>
      </div>

      {r.nadieEscribioHoy ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Hoy todavía no escribió nadie.
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Los contactos ya están cargados con teléfono y mensaje listo. Entrá a una
            campaña y usá <b>Despachar</b>: son 3 clics por contacto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Hoy" valor={`${r.totalHoy} / ${r.metaEquipoHoy}`} destacado />
          <Stat label="Esta semana" valor={r.totalSemana} />
          <Stat label="Cumplieron hoy" valor={`${r.filas.filter((f) => f.cumpleHoy).length} de ${r.filas.length}`} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Persona</th>
                  <th className="px-3 py-2 text-right font-medium">Hoy</th>
                  <th className="px-3 py-2 text-right font-medium">Semana</th>
                  <th className="px-3 py-2 text-right font-medium">Mes</th>
                  <th className="px-3 py-2 text-right font-medium">Interesados</th>
                  <th className="px-3 py-2 text-right font-medium">Reuniones</th>
                  <th className="px-3 py-2 text-left font-medium">Último mensaje</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {f.nombre}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        meta {f.meta}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums font-semibold",
                        f.cumpleHoy
                          ? "text-emerald-600 dark:text-emerald-400"
                          : f.hoy === 0
                            ? "text-muted-foreground"
                            : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {f.hoy}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.semana}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.mes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.interesados || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{f.reuniones || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {f.ultimoDia
                        ? f.diasSinEscribir === 0
                          ? "hoy"
                          : `hace ${f.diasSinEscribir} ${f.diasSinEscribir === 1 ? "día" : "días"}`
                        : "nunca"}
                    </td>
                  </tr>
                ))}
                {r.filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      No hay nadie con rol comercial o de prospección.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {r.colgados.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">
            Hace {DIAS_INACTIVO} días o más que no escriben
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.colgados.map((f) => f.nombre).join(", ")}
          </p>
        </div>
      )}

      {sinDueno > 0 && (
        <p className="text-xs text-muted-foreground">
          Hay {sinDueno} contactos marcados como contactados <b>sin dueño</b>: son de antes
          de que el estado se auto-asignara, así que no suman a nadie en esta tabla.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: string | number;
  destacado?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", destacado && "border-primary/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
