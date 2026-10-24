import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { cargarEquipos, type CuentaVista, type EquipoVista, type Persona } from "@/lib/equipos/cargar";
import { BloquePlegable } from "@/components/bloque-plegable";
import { CaraPersona } from "@/components/cara-persona";

export const dynamic = "force-dynamic";

/**
 * Mi equipo (24/10/2026, pedido del dueño): la agencia se maneja por equipos
 * —cada uno con su grupo de WhatsApp— y la plataforma los tenía escondidos en
 * Coordinación. Acá cada persona ve su equipo: su gente, sus cuentas y lo que
 * está pendiente en cada una. Dirección y coordinación ven todos, cuánto lugar
 * queda en cada uno (tope de 8) y si alcanza para la meta de 50 cuentas.
 */
export default async function MiEquipoPage() {
  const me = await requireUser();
  const staff = userInRoles(me, ["admin", "coordinador"]);
  const d = await cargarEquipos(createAdmin(), hoyYmd());
  const mios = d.equipos.filter((e) => e.miembros.some((m) => m.id === me.id));
  const visibles = staff ? d.equipos : mios;
  const c = d.capacidad;
  const nombre = (id: string) => d.personas.get(id)?.nombre.split(" ")[0] ?? "—";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">👥 {staff ? "Equipos" : mios.length > 1 ? "Mis equipos" : "Mi equipo"}</h1>
          <p className="text-sm text-muted-foreground">
            {staff
              ? "Cada equipo con su gente y sus cuentas. Tocá uno para ver cómo viene cada cuenta."
              : "Tu gente y tus cuentas: lo que está pendiente en cada una."}
          </p>
        </div>
        {me.rol === "admin" && (
          <Link href="/coordinacion/equipos" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Settings2 className="h-3.5 w-3.5" /> Armar equipos
          </Link>
        )}
      </div>

      {staff && (
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">¿Llegamos a {c.meta} cuentas?</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              <b className="text-lg text-foreground">{c.enEquipos}</b> de {c.capacidad} lugares ocupados
            </span>
          </div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {d.equipos.map((e) => (
              <span
                key={e.id}
                className="border-r border-card bg-primary last:border-r-0"
                style={{ width: `${(e.lugar.cuentas / Math.max(1, c.capacidad)) * 100}%` }}
                title={`${e.nombre}: ${e.lugar.cuentas} de ${e.tope}`}
              />
            ))}
          </div>
          <p className="mt-3 text-sm">
            {c.lugaresQueFaltan === 0 ? (
              <>
                ✅ <b>Alcanza:</b> con los {d.equipos.length} equipos llenos ({c.capacidad} lugares) y las {c.fueraDeEquipo} cuentas fuera de equipo se llega a {c.maximo}. No hace falta armar equipos nuevos.
              </>
            ) : (
              <>
                ⚠️ Con los equipos llenos se llega a {c.maximo}: faltan <b>{c.lugaresQueFaltan} lugares</b>, o sea {c.equiposQueFaltan} equipo{c.equiposQueFaltan === 1 ? "" : "s"} más (o subir el tope).
              </>
            )}
          </p>
          {d.sugerido && (
            <p className="mt-1 text-sm text-muted-foreground">
              👉 La próxima cuenta va al <b className="text-foreground">{d.sugerido.nombre}</b> ({d.sugerido.libres} lugares libres).
            </p>
          )}
          {d.carga.some((p) => p.conEquiposLlenos > 8) && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                ▸ Quién se satura primero si los equipos se llenan
              </summary>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {d.carga
                  .filter((p) => p.conEquiposLlenos > 8)
                  .map((p) => (
                    <li key={p.userId} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                      <span>
                        <b>{nombre(p.userId)}</b> <span className="text-xs text-muted-foreground">· {p.equipos.length} equipos</span>
                      </span>
                      <span className="tabular-nums text-xs">
                        hoy {p.hoy} → <b className={cn(p.conEquiposLlenos > 16 && "text-red-600 dark:text-red-400")}>{p.conEquiposLlenos}</b> cuentas
                      </span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Todavía no estás en ningún equipo. Si ya trabajás con uno, avisale a la coordinación para que te sume.
        </p>
      ) : (
        <div className="space-y-2">
          {visibles.map((e) => (
            <Equipo key={e.id} e={e} personas={d.personas} nombre={nombre} abierto={!staff} />
          ))}
        </div>
      )}

      {staff && d.fuera.length > 0 && (
        <BloquePlegable
          emoji="🧩"
          titulo="Cuentas fuera de equipo"
          resumen={d.fuera.map((x) => x.nombre).join(" · ")}
          pegado
        >
          <ul className="divide-y">
            {d.fuera.map((x) => (
              <FilaCuenta key={x.id} c={x} nombre={nombre} />
            ))}
          </ul>
        </BloquePlegable>
      )}
    </div>
  );
}

function Equipo({ e, personas, nombre, abierto }: { e: EquipoVista; personas: Map<string, Persona>; nombre: (id: string) => string; abierto: boolean }) {
  const enRojo = e.cuentas.filter((c) => c.semaforo === "mal").length;
  const conDiferencias = e.cuentas.filter((c) => c.diferencias.length).length;
  const quienes = e.miembros.filter((m) => m.rol !== "Pauta").map((m) => nombre(m.id));
  return (
    <BloquePlegable
      id={`equipo-${e.id}`}
      emoji="👥"
      titulo={e.nombre}
      resumen={quienes.join(" · ")}
      abierto={abierto}
      pegado
      derecha={
        <span className="flex items-center gap-1.5">
          {enRojo > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">{enRojo} en rojo</span>}
          {conDiferencias > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">revisar equipo</span>}
          <span className="text-sm tabular-nums">
            <b>{e.lugar.cuentas}</b>
            <span className="text-muted-foreground">/{e.tope}</span>
          </span>
        </span>
      }
    >
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {e.miembros.map((m) => {
          const p = personas.get(m.id);
          return (
            <Link key={m.id + m.rol} href={`/equipo/persona/${m.id}`} className="flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-xs hover:bg-muted">
              <CaraPersona nombre={p?.nombre ?? "—"} url={p?.avatar_url ?? null} className="h-6 w-6 text-[10px]" />
              <span>
                <b>{nombre(m.id)}</b> <span className="text-muted-foreground">{m.rol === "También" ? "también" : m.rol}</span>
              </span>
              {(p?.vencidas ?? 0) > 0 && <span className="text-red-600 dark:text-red-400">{p!.vencidas} venc.</span>}
            </Link>
          );
        })}
      </div>
      <ul className="divide-y">
        {e.cuentas.map((c) => (
          <FilaCuenta key={c.id} c={c} nombre={nombre} />
        ))}
        {e.lugar.libres > 0 && (
          <li className="px-4 py-2.5 text-xs text-muted-foreground">
            {e.lugar.libres} lugar{e.lugar.libres === 1 ? "" : "es"} libre{e.lugar.libres === 1 ? "" : "s"} para cuentas nuevas
          </li>
        )}
      </ul>
      {e.notas && <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">{e.notas}</p>}
    </BloquePlegable>
  );
}

const PUNTO = { bien: "bg-emerald-500", regular: "bg-amber-500", mal: "bg-red-500" } as const;

function FilaCuenta({ c, nombre }: { c: CuentaVista; nombre: (id: string) => string }) {
  const pendientes = [
    c.piezasAtrasadas > 0 && { txt: `${c.piezasAtrasadas} pieza${c.piezasAtrasadas === 1 ? "" : "s"} atrasada${c.piezasAtrasadas === 1 ? "" : "s"}`, rojo: true, href: `/contenidos?cliente=${c.id}` },
    c.ideasSinAprobar > 0 && { txt: `${c.ideasSinAprobar} sin aprobar`, rojo: false, href: `/contenidos?cliente=${c.id}` },
    c.tareasVencidas > 0 && { txt: `${c.tareasVencidas} tarea${c.tareasVencidas === 1 ? "" : "s"} vencida${c.tareasVencidas === 1 ? "" : "s"}`, rojo: true, href: `/clientes/${c.id}` },
  ].filter(Boolean) as { txt: string; rojo: boolean; href: string }[];
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.semaforo ? PUNTO[c.semaforo] : "bg-muted-foreground/30")} title={c.alertas.join(" · ") || undefined} />
        <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
          {c.nombre}
          {c.planMeta > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {c.planHechas}/{c.planMeta} del mes
            </span>
          )}
        </Link>
        {pendientes.length ? (
          <span className="flex flex-wrap gap-1.5">
            {pendientes.map((p) => (
              <Link
                key={p.txt}
                href={p.href}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  p.rojo ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                )}
              >
                {p.txt}
              </Link>
            ))}
          </span>
        ) : (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">al día ✓</span>
        )}
      </div>
      {c.diferencias.length > 0 && (
        <p className="mt-1 pl-5 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠️ {c.diferencias.join(" · ")}. Corregilo en la ficha o en el equipo.
        </p>
      )}
      {!c.team_id && (
        <p className="mt-0.5 pl-5 text-[11px] text-muted-foreground">
          CM: {c.cm_id ? nombre(c.cm_id) : "—"} · Diseño: {c.disenador_id ? nombre(c.disenador_id) : "—"}
        </p>
      )}
    </li>
  );
}
