import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { fmtARS } from "@/lib/finanzas";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { ConciliacionAcciones } from "@/components/conciliacion-acciones";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Fila {
  clave: string;
  fecha: string;
  monto: number;
  tipo: "cobro" | "sueldo";
  detalle: string | null;
  descripcion: string | null;
  cuenta: string | null;
  estado: "marcado" | "sin_match" | "omitido" | "confirmado" | "deshecho";
  mensaje: string | null;
}

const ETIQUETA: Record<Fila["estado"], string> = {
  marcado: "Marcado, falta que confirmes",
  sin_match: "No supe dónde va",
  omitido: "No toca el abono",
  confirmado: "Confirmado",
  deshecho: "Deshecho",
};

/**
 * Cobros y pagos detectados (1/11/2026).
 *
 * La planilla del dueño ve cada movimiento del banco; cuando es un cobro de un
 * cliente o un sueldo, la app lo marca sola y lo deja acá para que el dueño
 * diga si estuvo bien. Lo que no pudo ubicar también aparece, para resolverlo.
 */
export default async function ConciliacionPage() {
  await requireFeature("finanzas");
  const { data, error } = await createAdmin()
    .from("movimientos_planilla")
    .select("clave, fecha, monto, tipo, detalle, descripcion, cuenta, estado, mensaje")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(150);

  const filas = (error ? [] : (data ?? [])) as Fila[];
  const porRevisar = filas.filter((f) => f.estado === "marcado" || f.estado === "sin_match");
  const revisados = filas.filter((f) => !porRevisar.includes(f));

  const lista = (xs: Fila[], acciones: boolean) => (
    <Card>
      <CardContent className="divide-y p-0">
        {xs.map((f) => (
          <div key={f.clave} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {f.mensaje || f.detalle || f.descripcion}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(f.fecha)} · {f.tipo === "cobro" ? "Entró" : "Salió"} {fmtARS(Number(f.monto))}
                {f.cuenta ? ` · ${f.cuenta}` : ""}
                {f.detalle ? ` · ${f.detalle}` : ""}
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                  f.estado === "marcado" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                  f.estado === "sin_match" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                  (f.estado === "confirmado" || f.estado === "omitido") && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                  f.estado === "deshecho" && "bg-muted text-muted-foreground",
                )}
              >
                {ETIQUETA[f.estado]}
              </span>
            </div>
            {acciones && <ConciliacionAcciones clave={f.clave} estado={f.estado} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cobros y pagos detectados</h1>
        <p className="text-muted-foreground">
          Lo que la planilla vio en el banco y la app marcó sola: cobros de clientes y sueldos del equipo.
          Confirmá que esté bien o deshacelo con un toque.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm">Falta aplicar la migración 0228 en Supabase.</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Para revisar {porRevisar.length ? `(${porRevisar.length})` : ""}
        </h2>
        {porRevisar.length ? (
          lista(porRevisar, true)
        ) : (
          <p className="text-sm text-muted-foreground">Nada pendiente. Cuando entre un cobro o salga un sueldo, aparece acá.</p>
        )}
      </section>

      {revisados.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ya revisados</h2>
          {lista(revisados, false)}
        </section>
      )}
    </div>
  );
}
