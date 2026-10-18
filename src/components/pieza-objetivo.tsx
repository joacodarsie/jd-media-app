/**
 * El porqué de una pieza y cómo le fue (17/10/2026): el objetivo, la meta y
 * el resultado que la plataforma trajo de Instagram, con una barra hasta la
 * meta. Se usa en el detalle de la pieza y en el portal del cliente.
 */
import { estadoDeMeta, objetivoDe, TEXTO_ESTADO, type EstadoMeta } from "@/lib/medicion/objetivos";
import { cn } from "@/lib/utils";

const COLOR: Record<EstadoMeta, string> = {
  superada: "bg-emerald-500",
  cumplida: "bg-emerald-500",
  cerca: "bg-amber-400",
  lejos: "bg-rose-500",
  sin_dato: "bg-muted-foreground/30",
  sin_meta: "bg-muted-foreground/30",
};

const fmt = (n: number) => n.toLocaleString("es-AR");

export function PiezaObjetivo({
  objetivo,
  meta,
  valor,
  publicada,
  compacto = false,
}: {
  objetivo: string | null | undefined;
  meta: number | null | undefined;
  valor: number | null | undefined;
  /** Si ya salió: antes de publicarse no hay resultado que esperar. */
  publicada: boolean;
  compacto?: boolean;
}) {
  const def = objetivoDe(objetivo);
  if (!def) {
    if (compacto) return null;
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Esta pieza no tiene objetivo. Editala y elegí para qué sale y cuánto esperamos: la plataforma lo mide sola.
      </p>
    );
  }
  const v = valor ?? null;
  const estado = estadoDeMeta(v, meta ?? null);
  const pct = v !== null && meta ? Math.min(100, (v / meta) * 100) : 0;

  if (compacto) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
        🎯 {v !== null ? fmt(v) : "–"}
        {meta ? `/${fmt(meta)}` : ""}
      </span>
    );
  }

  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:bg-amber-500/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-semibold">🎯 {def.titulo}</h4>
        <span className="text-xs text-muted-foreground">
          {meta ? `Meta: ${fmt(meta)} ${def.unidad}` : "Sin meta"}
        </span>
      </div>
      {publicada ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", COLOR[estado])} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{v !== null ? fmt(v) : "–"}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {TEXTO_ESTADO[estado]}
            {estado === "sin_dato" && def.automatico ? " · se mide sola a los 2 días de publicada" : ""}
            {estado === "sin_dato" && !def.automatico ? " · la community carga las consultas que trajo" : ""}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{def.ayuda} Se mide después de publicada.</p>
      )}
    </div>
  );
}
