import Link from "next/link";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { periodLabel } from "@/lib/finanzas";
import { cargarReunionesDelMes } from "@/lib/retencion/reuniones-del-mes-run";
import { ESTADO_REUNION, type EstadoReunion } from "@/lib/retencion/invitar-reunion";
import { InvitarReunionBoton, PedirEncuestaBoton } from "@/components/invitar-reunion-boton";
import { cn } from "@/lib/utils";

/**
 * Las reuniones mensuales del mes en Mi día (22/10/2026): cada cuenta con en
 * qué está (sin invitar, invitada, agendada, hecha) y el botón para invitar al
 * cliente a elegir su turno. Quien tiene los tickets ve los suyos; dirección,
 * todos. Si están todas hechas, no se muestra.
 */
const TONO: Record<EstadoReunion, string> = {
  sin_invitar: "bg-red-500/15 text-red-700 dark:text-red-300",
  invitada: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  agendada: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  hecha: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};
const ICONO: Record<EstadoReunion, string> = { sin_invitar: "✉️", invitada: "⏳", agendada: "📅", hecha: "✅" };

export async function ReunionesDelMes({ userId, todas }: { userId: string; todas: boolean }) {
  const hoy = hoyYmd();
  const filas = await cargarReunionesDelMes(createAdmin(), { hoy, userId: todas ? null : userId }).catch(() => []);
  if (!filas.length) return null;
  const hechas = filas.filter((f) => f.estado === "hecha").length;
  const faltan = filas.length - hechas;
  // Las hechas sin encuesta siguen a la vista: después de la reunión se pide (22/10/2026).
  const sinEncuesta = filas.filter((f) => f.estado === "hecha" && !f.encuesta);
  if (faltan === 0 && sinEncuesta.length === 0) return null;
  const sinInvitar = filas.filter((f) => f.estado === "sin_invitar").length;
  const mes = periodLabel(hoy.slice(0, 7)).toLowerCase().replace(/\s*(de\s+)?\d{4}$/, "");

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">🤝</span>
          <div>
            <h2 className="font-semibold">Reuniones de cierre de {mes}</h2>
            <p className="text-xs text-muted-foreground">
              {sinInvitar > 0 ? (
                <>
                  <b className="text-foreground">{sinInvitar} sin invitar.</b> Mandales el link: cada cliente elige su día y hora en el portal.
                </>
              ) : (
                "Todas invitadas. Si alguna no elige en 2 días, reenviá."
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums leading-none">
            {hechas}
            <span className="text-sm font-normal text-muted-foreground"> / {filas.length}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">hechas</p>
        </div>
      </div>

      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {(["hecha", "agendada", "invitada"] as EstadoReunion[]).map((e) => {
          const n = filas.filter((f) => f.estado === e).length;
          return n ? (
            <span
              key={e}
              className={cn(e === "hecha" ? "bg-emerald-500" : e === "agendada" ? "bg-sky-500" : "bg-amber-500")}
              style={{ width: `${(n / filas.length) * 100}%` }}
            />
          ) : null;
        })}
      </div>

      <ul className="mt-3 divide-y">
        {filas
          .filter((f) => f.estado !== "hecha" || !f.encuesta)
          .map((f) => (
            <li key={f.ticketId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-lg" aria-hidden="true">{ICONO[f.estado]}</span>
                <span className="min-w-0">
                  <Link href={`/clientes/${f.clienteId}`} className="block truncate text-sm font-medium hover:underline">
                    {f.cuenta}
                  </Link>
                  <span className="block text-[11px] text-muted-foreground">
                    {f.ultima ? `Última: ${f.ultima.slice(8, 10)}/${f.ultima.slice(5, 7)}` : "Nunca tuvo reunión"}
                    {todas && f.responsable ? ` · ${f.responsable.split(" ")[0]}` : ""}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-9 sm:justify-end sm:pl-0">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONO[f.estado])}>
                  {f.estado === "agendada" && f.agendada ? f.agendada : ESTADO_REUNION[f.estado].label}
                </span>
                {f.estado === "hecha" ? (
                  <PedirEncuestaBoton clienteId={f.clienteId} />
                ) : f.estado !== "agendada" ? (
                  <InvitarReunionBoton clienteId={f.clienteId} ticketId={f.ticketId} yaInvitada={f.estado === "invitada"} />
                ) : null}
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}
