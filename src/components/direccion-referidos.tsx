import { Gift } from "lucide-react";
import { createAdmin } from "@/lib/supabase/admin";
import { PCT_RECOMENDADO, PCT_REFERIDO } from "@/lib/referidos/referidos";
import { fmtCurrency } from "@/lib/finanzas";

const ESTADO: Record<string, string> = {
  pendiente: "esperando que pague su 2.º mes",
  ganado: "ganó el descuento: sale en su próxima factura",
  aplicado: "descuento aplicado",
};

/**
 * "Referidos", en Dirección (13/10/2026): si el programa funciona. Cuánta
 * gente entró a la web con un link de recomendación, quién recomendó a quién y
 * cuánto se descontó. Todo se mueve solo; acá solo se mira.
 */
export async function DireccionReferidos() {
  const admin = createAdmin();
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: refs, error }, { count: entraron }] = await Promise.all([
    admin
      .from("referidos")
      .select(
        "id, estado, monto_descuento, aplicado_periodo, created_at, recomienda:clients!referidos_recomienda_id_fkey(nombre), nuevo:clients!referidos_nuevo_id_fkey(nombre)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("web_eventos").select("id", { count: "exact", head: true }).eq("tipo", "referido").gte("created_at", hace30),
  ]);
  if (error) return null;
  const filas = (refs ?? []) as unknown as {
    id: string;
    estado: string;
    monto_descuento: number | null;
    recomienda: { nombre: string } | null;
    nuevo: { nombre: string } | null;
  }[];
  const descontado = filas.reduce((a, r) => a + Number(r.monto_descuento ?? 0), 0);

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Gift className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Referidos</h2>
        <span className="text-xs text-muted-foreground">
          · {PCT_RECOMENDADO}% al que llega y {PCT_REFERIDO}% al cliente que lo recomendó
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Entraron a la web recomendados</div>
            <div className="text-2xl font-bold tabular-nums">{entraron ?? 0}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Últimos 30 días, con el link de un cliente.</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Cuentas que llegaron recomendadas</div>
            <div className="text-2xl font-bold tabular-nums">{filas.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Se anotan solas cuando en «¿De dónde vino?» eligen el cliente que lo recomendó.
            </div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Descontado a los que recomendaron</div>
            <div className="text-2xl font-bold tabular-nums">{fmtCurrency(descontado, "ARS")}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Lo que costó el programa hasta hoy.</div>
          </div>
        </div>
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía nadie llegó recomendado por el programa (arrancó el 13/10/2026). Luz les cuenta a los clientes a
            medida que cumplen 2 meses, y el botón ya está en su plataforma.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {filas.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                <b>{r.recomienda?.nombre ?? "—"}</b>
                <span className="text-muted-foreground">recomendó a</span>
                <b>{r.nuevo?.nombre ?? "—"}</b>
                <span className="ml-auto text-xs text-muted-foreground">
                  {ESTADO[r.estado] ?? r.estado}
                  {r.monto_descuento ? ` · ${fmtCurrency(Number(r.monto_descuento), "ARS")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
