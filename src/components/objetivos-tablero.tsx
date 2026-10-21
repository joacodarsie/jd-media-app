import Link from "next/link";
import { Target } from "lucide-react";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarDatosObjetivos } from "@/lib/objetivos/cargar";
import { mesDe, objetivosDePersona, semaforoObjetivo, semanaDe, type PersonaObj } from "@/lib/objetivos/equipo";
import { CaraPersona } from "@/components/cara-persona";
import { NOMBRE_ROL } from "@/lib/equipo/roles";
import { cn } from "@/lib/utils";

/**
 * Los objetivos de todo el equipo en una mirada (21/10/2026), para Dirección:
 * cada persona con sus objetivos del mes en verde, amarillo o rojo. Un clic
 * abre su ficha con el detalle de hoy, la semana y el mes.
 */
export async function ObjetivosTablero() {
  const admin = createAdmin();
  const hoy = hoyYmd();
  const mes = mesDe(hoy);
  const semana = semanaDe(hoy);
  const desde = semana.desde < mes.desde ? semana.desde : mes.desde;
  const [datos, { data: us }, { data: ms }] = await Promise.all([
    cargarDatosObjetivos(admin, desde, mes.hasta),
    admin.from("users").select("id, nombre, rol, rol_secundario, area, area_secundaria, avatar_url").eq("activo", true).order("nombre"),
    admin.from("objetivos_persona").select("user_id, metrica, meta_semanal, meta_mensual"),
  ]);
  const metas = new Map<string, { semanal: number | null; mensual: number | null }>();
  for (const m of (ms ?? []) as { user_id: string; metrica: string; meta_semanal: number | null; meta_mensual: number | null }[]) {
    metas.set(`${m.user_id}:${m.metrica}`, { semanal: m.meta_semanal, mensual: m.meta_mensual });
  }
  const filas = ((us ?? []) as (PersonaObj & { avatar_url: string | null })[])
    .map((p) => ({ p, objetivos: objetivosDePersona(p, datos, metas, hoy) }))
    .filter((x) => x.objetivos.length > 0);
  if (!filas.length) return null;

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> Objetivos del equipo · este mes
        </h2>
        <Link href="/objetivos/equipo" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Ver el detalle →
        </Link>
      </div>
      <ul className="divide-y">
        {filas.map(({ p, objetivos }) => (
          <li key={p.id} className="py-2.5">
            <Link href={`/equipo/persona/${p.id}`} className="group flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="flex w-48 shrink-0 items-center gap-2">
                <CaraPersona nombre={p.nombre} url={p.avatar_url} className="h-8 w-8 text-xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium group-hover:underline">{p.nombre}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{NOMBRE_ROL[p.area ?? ""] ?? p.area}</span>
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {objetivos.map((o) => {
                  const e = semaforoObjetivo(o.mes, o.menosEsMejor, mes);
                  const v = o.unidad === "%" ? (o.mes.meta == null && o.mes.valor === 0 ? "—" : `${o.mes.valor}%`) : o.mes.valor.toLocaleString("es-AR");
                  const m = o.mes.meta == null ? "" : o.unidad === "%" ? ` / ${o.mes.meta}%` : ` / ${o.mes.meta.toLocaleString("es-AR")}`;
                  return (
                    <span
                      key={o.id}
                      title={o.ayuda}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                        e === "bien" && "border-emerald-500/40 bg-emerald-500/10",
                        e === "regular" && "border-amber-500/40 bg-amber-500/10",
                        e === "mal" && "border-red-500/40 bg-red-500/10"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          e === "bien" ? "bg-emerald-500" : e === "regular" ? "bg-amber-500" : e === "mal" ? "bg-red-500" : "bg-muted-foreground/40"
                        )}
                      />
                      <span className="text-muted-foreground">{o.label}</span>
                      <b className="tabular-nums">
                        {v}
                        <span className="font-normal text-muted-foreground">{m}</span>
                      </b>
                    </span>
                  );
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
