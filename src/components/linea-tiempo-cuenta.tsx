/**
 * La línea de tiempo de la cuenta en su ficha (18/10/2026): alta, arranque,
 * primer pago, primera pieza, reuniones, crecimiento y hoy. La línea se dibuja
 * y los hitos entran uno tras otro. Los hitos los arma `lib/clientes/linea-tiempo`.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { armarLineaDeTiempo, type TipoHito } from "@/lib/clientes/linea-tiempo";
import { hoyYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";

const ICONO: Record<TipoHito, string> = {
  alta: "🚀",
  arranque: "🏁",
  cobro: "💳",
  pieza: "📸",
  reunion: "🤝",
  crecimiento: "📈",
  hoy: "📍",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (s: string) => `${+s.slice(8, 10)} ${MESES[+s.slice(5, 7) - 1]}`;

export async function LineaTiempoCuenta({ clienteId, fechaInicio }: { clienteId: string; fechaInicio: string | null }) {
  if (!fechaInicio) return null;
  const admin = createAdmin();
  const hoy = hoyYmd();

  const [{ data: madre }, { data: primera }, { count: piezas }, { data: reuniones }, { data: cobro }, { data: fotos }] =
    await Promise.all([
      admin
        .from("tasks")
        .select("id, estado, updated_at")
        .eq("cliente_id", clienteId)
        .is("parent_id", null)
        .like("titulo", "Onboarding 15 días — %")
        .neq("estado", "archivada")
        .limit(1)
        .maybeSingle(),
      admin
        .from("publications")
        .select("fecha_publicacion")
        .eq("cliente_id", clienteId)
        .eq("estado", "publicado")
        .order("fecha_publicacion", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("publications")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId)
        .eq("estado", "publicado"),
      admin.from("client_meetings").select("fecha").eq("cliente_id", clienteId),
      admin
        .from("client_invoices")
        .select("fecha_cobro")
        .eq("cliente_id", clienteId)
        .not("fecha_cobro", "is", null)
        .order("fecha_cobro", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("cuenta_fotos")
        .select("tipo, fecha, seguidores")
        .eq("client_id", clienteId)
        .order("fecha", { ascending: true }),
    ]);

  let arranque: { terminadoEl: string | null; hechos: number; total: number } | null = null;
  const m = madre as { id: string; estado: string; updated_at: string } | null;
  if (m) {
    const { data: pasos } = await admin.from("tasks").select("estado").eq("parent_id", m.id);
    const lista = (pasos ?? []) as { estado: string }[];
    arranque = {
      terminadoEl: m.estado === "completada" ? m.updated_at : null,
      hechos: lista.filter((p) => p.estado === "completada").length,
      total: lista.length,
    };
  }

  const fs = ((fotos ?? []) as { tipo: string; fecha: string; seguidores: number | null }[]).filter((f) => f.seguidores != null);
  const ini = fs.find((f) => f.tipo === "inicio") ?? fs[0];
  const ult = fs.at(-1);

  const hitos = armarLineaDeTiempo(
    {
      fechaInicio,
      arranque,
      primeraPieza: (primera as { fecha_publicacion: string } | null)?.fecha_publicacion ?? null,
      piezas: piezas ?? 0,
      reuniones: ((reuniones ?? []) as { fecha: string | null }[]).map((r) => r.fecha).filter((f): f is string => !!f),
      primerCobro: (cobro as { fecha_cobro: string } | null)?.fecha_cobro ?? null,
      seguidores: ini && ult && ult !== ini ? { inicio: ini.seguidores!, hoy: ult.seguidores!, fecha: ult.fecha } : null,
    },
    hoy
  );
  if (hitos.length < 2) return null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50 sm:p-5">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">La historia de la cuenta</div>
      <div className="relative overflow-x-auto pb-1">
        <div className="relative min-w-max">
          {/* La línea se dibuja de izquierda a derecha. */}
          <div className="absolute left-4 right-4 top-[15px] h-0.5 bg-border" aria-hidden="true" />
          <div className="jd-linea absolute left-4 right-4 top-[15px] h-0.5 bg-primary/70" aria-hidden="true" />
          <ol className="jd-cascada relative flex gap-2">
            {hitos.map((h, i) => (
              <li key={`${h.tipo}-${h.fecha}-${i}`} className="flex w-32 shrink-0 flex-col items-start px-1 sm:w-36">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-card text-base shadow-sm ring-2",
                    h.tipo === "hoy" ? "ring-primary" : "ring-border"
                  )}
                  aria-hidden="true"
                >
                  {ICONO[h.tipo]}
                </span>
                <span className="mt-2 text-[11px] tabular-nums text-muted-foreground">{fecha(h.fecha)}</span>
                <span className={cn("text-sm font-medium leading-tight", h.tipo === "hoy" && "text-primary-foreground dark:text-primary")}>
                  {h.tipo === "hoy" ? <span className="rounded bg-primary px-1">{h.titulo}</span> : h.titulo}
                </span>
                {h.detalle && <span className="mt-0.5 text-xs leading-snug text-muted-foreground">{h.detalle}</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
