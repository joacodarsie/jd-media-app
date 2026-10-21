import Link from "next/link";
import { Target } from "lucide-react";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarDatosObjetivos } from "@/lib/objetivos/cargar";
import {
  diaDe,
  mesDe,
  metricasDe,
  objetivosDePersona,
  semaforoObjetivo,
  semanaDe,
  type Avance,
  type FilaObjetivo,
  type Periodo,
  type PersonaObj,
} from "@/lib/objetivos/equipo";
import { cn } from "@/lib/utils";

/**
 * «Tus objetivos» en Mi día (21/10/2026). Pedido del dueño: que cada rol vea
 * su objetivo del mes bajado a la semana y al día, para ir viendo cómo lo
 * cumple. Todo se mide solo con lo que pasa en la plataforma.
 */
export async function TusObjetivos({ persona, titulo = "Tus objetivos" }: { persona: PersonaObj; titulo?: string }) {
  if (metricasDe(persona).length === 0) return null;
  const admin = createAdmin();
  const hoy = hoyYmd();
  const mes = mesDe(hoy);
  const semana = semanaDe(hoy);
  const desde = semana.desde < mes.desde ? semana.desde : mes.desde;
  const hasta = semana.hasta > mes.hasta ? semana.hasta : mes.hasta;
  const [datos, { data: metasRaw }] = await Promise.all([
    cargarDatosObjetivos(admin, desde, hasta),
    admin.from("objetivos_persona").select("user_id, metrica, meta_semanal, meta_mensual").eq("user_id", persona.id),
  ]);
  const metas = new Map<string, { semanal: number | null; mensual: number | null }>();
  for (const m of (metasRaw ?? []) as { user_id: string; metrica: string; meta_semanal: number | null; meta_mensual: number | null }[]) {
    metas.set(`${m.user_id}:${m.metrica}`, {
      semanal: m.meta_semanal == null ? null : Number(m.meta_semanal),
      mensual: m.meta_mensual == null ? null : Number(m.meta_mensual),
    });
  }
  const filas = objetivosDePersona(persona, datos, metas, hoy);
  if (!filas.length) return null;
  const periodos = { hoy: diaDe(hoy), semana, mes };

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> {titulo}
        </h2>
        <Link href="/objetivos/equipo" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Ver los de todos →
        </Link>
      </div>
      <ul className="divide-y">
        {filas.map((f) => (
          <Fila key={f.id} f={f} periodos={periodos} />
        ))}
      </ul>
    </section>
  );
}

function Fila({ f, periodos }: { f: FilaObjetivo; periodos: { hoy: Periodo; semana: Periodo; mes: Periodo } }) {
  const celdas: { titulo: string; a: Avance; p: Periodo }[] = f.foto
    ? [{ titulo: "Hoy", a: f.mes, p: periodos.mes }]
    : [
        ...(f.hoy ? [{ titulo: "Hoy", a: f.hoy, p: periodos.hoy }] : []),
        ...(f.semana ? [{ titulo: "Semana", a: f.semana, p: periodos.semana }] : []),
        { titulo: "Mes", a: f.mes, p: periodos.mes },
      ];
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{f.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{f.ayuda}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {celdas.map((c) => (
          <Celda key={c.titulo} titulo={c.titulo} a={c.a} unidad={f.unidad} menos={f.menosEsMejor} p={c.p} />
        ))}
      </div>
    </li>
  );
}

const fmt = (n: number) => n.toLocaleString("es-AR");

function Celda({ titulo, a, unidad, menos, p }: { titulo: string; a: Avance; unidad: "n" | "%"; menos: boolean; p: Periodo }) {
  const estado = semaforoObjetivo(a, menos, p);
  // Un % sin meta es que no hubo nada que medir (ej. ninguna encuesta respondida).
  const v = unidad === "%" ? (a.meta == null && a.valor === 0 ? "—" : `${a.valor}%`) : fmt(a.valor);
  const meta = a.meta == null ? null : unidad === "%" ? `${a.meta}%` : fmt(a.meta);
  const pct = a.meta && a.meta > 0 ? Math.min(100, Math.round((a.valor / a.meta) * 100)) : menos ? 0 : null;
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-sm tabular-nums">
        <b
          className={cn(
            estado === "bien" && "text-emerald-600 dark:text-emerald-400",
            estado === "regular" && "text-amber-600 dark:text-amber-400",
            estado === "mal" && "text-red-600 dark:text-red-400"
          )}
        >
          {v}
        </b>
        {meta != null && (
          <span className="text-xs text-muted-foreground">
            {" "}
            {menos ? "· máx" : "de"} {meta}
          </span>
        )}
      </p>
      {pct != null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              estado === "bien" && "bg-emerald-500",
              estado === "regular" && "bg-amber-500",
              estado === "mal" && "bg-red-500",
              estado == null && "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
