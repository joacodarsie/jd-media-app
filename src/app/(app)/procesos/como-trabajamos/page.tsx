import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hoyYmd } from "@/lib/dates";
import { hitosRegulares, type Hito } from "@/lib/ciclo/ciclo";
import { NOMBRE_ROL, ROLES } from "@/lib/equipo/roles";
import { TONO } from "@/components/rol-vista";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cómo trabajamos" };

/**
 * «Cómo trabajamos» (21/10/2026): las fechas que mueven a todo el equipo, en
 * una sola página y en dibujos. Pedido del dueño: que la explicación de las
 * fechas sea una sección aparte y que cada rol después se vincule a esto.
 * Fuente: el ciclo quincenal (`lib/ciclo`) y los roles (`lib/equipo/roles`).
 */

const QUIEN: Record<Hito["responsable"], { emoji: string; nombre: string }> = {
  cm: { emoji: "📱", nombre: "Community" },
  director: { emoji: "✨", nombre: "Dir. creativa" },
  cliente: { emoji: "🙋", nombre: "Cliente" },
  equipo: { emoji: "🎨", nombre: "Diseño y edición" },
};

const ICONO: Record<Hito["clave"], string> = {
  calendario: "🗓️",
  aprueba_director_calendario: "✨",
  aprueba_cliente_calendario: "🙋",
  material: "📦",
  produccion: "🎨",
  aprueba_director_piezas: "✨",
  aprueba_cliente_piezas: "🙋",
  publica: "📣",
};

const dia = (f: string) => +f.slice(8, 10);
const tramo = (h: Hito) => (h.desde === h.hasta ? `${dia(h.desde)}` : `${dia(h.desde)} al ${dia(h.hasta)}`);

const REGLAS = [
  { icono: "🌗", titulo: "Por quincenas", texto: "Se publica desde el 1 y desde el 16." },
  { icono: "⏩", titulo: "Dos semanas de ventaja", texto: "Lo que sale el 16 se arma del 1 al 15." },
  { icono: "✨", titulo: "Todo pasa por la dirección creativa", texto: "Calendarios y piezas, antes que el cliente." },
  { icono: "⏳", titulo: "El cliente tiene un día", texto: "Si no contesta a tiempo, se da por aprobado." },
];

const PLATA = [
  { icono: "💰", dias: "1 al 5", titulo: "Pagan los clientes", texto: "El mes que arranca, por adelantado." },
  { icono: "💸", dias: "7", titulo: "Cobra el equipo", texto: "El mes trabajado, a mes vencido." },
  { icono: "📄", dias: "25", titulo: "Carta acuerdo", texto: "A cada cliente, con lo del mes siguiente." },
  { icono: "🚪", dias: "15", titulo: "Aviso de baja", texto: "Hasta el 15: ese es el último mes. Después, paga el siguiente." },
];

export default async function ComoTrabajamosPage() {
  await requireUser();
  const { data: pos } = await createClient().from("positions").select("id, area");
  const puestoDe = new Map(((pos ?? []) as { id: string; area: string | null }[]).map((p) => [p.area, p.id]));
  const hoy = dia(hoyYmd());
  // Un mes de 31 días como molde: las fechas son siempre las mismas.
  const segunda = hitosRegulares("2026-10-16");
  const primera = hitosRegulares("2026-11-01");
  const carriles = ROLES.filter((r) => r.ciclo.length > 0);
  const arranque = ROLES.flatMap((r) => r.arranque.map((a) => ({ ...a, rol: r })))
    .sort((a, b) => a.dia - b.dia);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/procesos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Procesos
      </Link>

      <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="text-4xl" aria-hidden="true">🗓️</p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Cómo trabajamos</h1>
        <p className="text-muted-foreground">Las fechas que mueven a todo el equipo, todos los meses.</p>
      </header>

      {/* Reglas de oro */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REGLAS.map((r, i) => (
          <div
            key={r.titulo}
            className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border bg-card p-4 duration-500"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <span className="text-3xl" aria-hidden="true">{r.icono}</span>
            <p className="mt-2 font-semibold leading-tight">{r.titulo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.texto}</p>
          </div>
        ))}
      </section>

      {/* El camino de una quincena */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-lg font-semibold">El camino de cada quincena</h2>
        <p className="text-xs text-muted-foreground">Los mismos 8 pasos, dos veces por mes.</p>
        <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {segunda.map((h, i) => {
            const q = QUIEN[h.responsable];
            return (
              <li
                key={h.clave}
                className="animate-in fade-in zoom-in-95 relative flex flex-col items-center rounded-xl bg-muted/40 p-3 text-center duration-500"
                style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-2xl shadow-sm ring-1 ring-border" aria-hidden="true">
                  {ICONO[h.clave]}
                </span>
                <p className="mt-2 text-xs font-semibold leading-tight">{h.titulo.replace("Santi", "Dir. creativa")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {q.emoji} {q.nombre}
                </p>
                <div className="mt-2 w-full space-y-1 text-[11px] tabular-nums">
                  <p className="rounded-md bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-800 dark:text-sky-200">{tramo(h)}</p>
                  <p className="rounded-md bg-violet-500/15 px-1.5 py-0.5 font-semibold text-violet-800 dark:text-violet-200">{tramo(primera[i])}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Para publicar desde el 16</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Para publicar desde el 1 del mes siguiente</span>
        </div>
      </section>

      {/* El mes de cada rol */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-lg font-semibold">El mes de cada rol</h2>
        <p className="text-xs text-muted-foreground">Cada fila es un rol; cada cuadradito, un día. Pasá el mouse para ver qué toca.</p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[760px] space-y-1">
            <div className="grid items-end gap-0.5" style={{ gridTemplateColumns: "170px repeat(31, minmax(0, 1fr))" }}>
              <span />
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <span
                  key={d}
                  className={cn("text-center text-[10px] tabular-nums text-muted-foreground", d === hoy && "font-bold text-foreground")}
                >
                  {d === 1 || d === 16 ? "📣" : ""}
                  <br />
                  {d}
                </span>
              ))}
            </div>
            {carriles.map((r) => {
              const t = TONO[r.tono];
              const deDia = new Map<number, string>();
              for (const h of r.ciclo) for (const d of h.dias) if (!deDia.has(d)) deDia.set(d, h.que);
              return (
                <div key={r.area} className="grid items-center gap-0.5" style={{ gridTemplateColumns: "170px repeat(31, minmax(0, 1fr))" }}>
                  <Link href={puestoDe.get(r.area) ? `/equipo/${puestoDe.get(r.area)}` : "/equipo"} className="flex items-center gap-1.5 truncate pr-2 text-xs font-medium hover:underline">
                    <span aria-hidden="true">{r.emoji}</span> <span className="truncate">{(NOMBRE_ROL[r.area] ?? r.area).replace("Coordinación de ", "Coord. ")}</span>
                  </Link>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const que = deDia.get(d);
                    return (
                      <span
                        key={d}
                        title={que ? `Día ${d}: ${que}` : `Día ${d}`}
                        className={cn(
                          "h-6 rounded-[4px]",
                          que ? t.fuerte : "bg-muted/50",
                          d === hoy && "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Arranque */}
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <h2 className="text-lg font-semibold">🚀 Una cuenta nueva: 15 días</h2>
          <p className="text-xs text-muted-foreground">Del diagnóstico a la primera publicación. Después entra a las quincenas.</p>
          <ol className="relative mt-4 space-y-2.5 border-l-2 border-dashed pl-5">
            {arranque.map((a) => {
              const t = TONO[a.rol.tono];
              return (
                <li key={`${a.dia}-${a.rol.area}-${a.que}`} className="relative">
                  <span className={cn("absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white", t.fuerte)}>
                    {a.dia}
                  </span>
                  <p className="text-sm">
                    <span aria-hidden="true">{a.rol.emoji}</span> {a.que}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{NOMBRE_ROL[a.rol.area] ?? a.rol.area}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* La plata */}
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <h2 className="text-lg font-semibold">💰 Las fechas de la plata</h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {PLATA.map((p) => (
              <div key={p.titulo} className="rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{p.icono}</span>
                  <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-background">Día {p.dias}</span>
                </div>
                <p className="mt-2 text-sm font-semibold">{p.titulo}</p>
                <p className="text-xs text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Link
        href="/procesos"
        className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm font-medium text-primary hover:bg-primary/10"
      >
        <span>🧩 Ver cada proceso paso a paso, con dónde se hace en la plataforma</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
