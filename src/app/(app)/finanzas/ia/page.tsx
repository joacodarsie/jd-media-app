import Link from "next/link";
import { ArrowLeft, Bot, TrendingUp } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = {
  ruta: string;
  modelo: string;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  costo_usd: number | string;
  created_at: string;
};

const usd = (n: number) =>
  n >= 1 ? `US$ ${n.toFixed(2)}` : `US$ ${n.toFixed(4)}`;
const num = (n: number) => n.toLocaleString("es-AR");

export default async function GastoIaPage() {
  await requireFeature("finanzas");
  const admin = createAdmin();

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const inicioMesPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const res = await admin
    .from("ai_usage")
    .select("ruta, modelo, user_id, input_tokens, output_tokens, costo_usd, created_at")
    .gte("created_at", inicioMesPrev)
    .order("created_at", { ascending: false });

  if (res.error && (res.error as { code?: string }).code === "42P01") {
    return (
      <Wrapper>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Falta aplicar la migración <b>0134_ai_usage</b> en Supabase. Después de
          aplicarla, esta pantalla se empieza a llenar sola con cada uso de la IA.
        </div>
      </Wrapper>
    );
  }

  const rows = ((res.data ?? []) as Row[]).map((r) => ({
    ...r,
    costo_usd: Number(r.costo_usd) || 0,
  }));
  const delMes = rows.filter((r) => r.created_at >= inicioMes);
  const delMesPrev = rows.filter((r) => r.created_at < inicioMes);

  const total = delMes.reduce((a, r) => a + r.costo_usd, 0);
  const totalPrev = delMesPrev.reduce((a, r) => a + r.costo_usd, 0);
  const tokensIn = delMes.reduce((a, r) => a + (r.input_tokens || 0), 0);
  const tokensOut = delMes.reduce((a, r) => a + (r.output_tokens || 0), 0);

  // Desglose por función
  const porRuta = new Map<string, { costo: number; llamadas: number }>();
  for (const r of delMes) {
    const cur = porRuta.get(r.ruta) ?? { costo: 0, llamadas: 0 };
    cur.costo += r.costo_usd;
    cur.llamadas += 1;
    porRuta.set(r.ruta, cur);
  }
  const rutas = [...porRuta.entries()].sort((a, b) => b[1].costo - a[1].costo);

  // Desglose por persona
  const { data: users } = await admin.from("users").select("id, nombre");
  const nombreDe = new Map(
    ((users ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
  );
  const porUser = new Map<string, number>();
  for (const r of delMes) {
    const k = r.user_id ? nombreDe.get(r.user_id) ?? "—" : "Sistema / cron";
    porUser.set(k, (porUser.get(k) ?? 0) + r.costo_usd);
  }
  const personas = [...porUser.entries()].sort((a, b) => b[1] - a[1]);

  const mesLabel = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <Wrapper>
      {/* Totales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label={`Gasto de ${mesLabel}`}
          value={usd(total)}
          sub={`${delMes.length} llamadas`}
          destacado
        />
        <Stat label="Mes anterior" value={usd(totalPrev)} sub={`${delMesPrev.length} llamadas`} />
        <Stat
          label="Tokens del mes"
          value={`${num(tokensIn + tokensOut)}`}
          sub={`${num(tokensIn)} entrada · ${num(tokensOut)} salida`}
        />
      </div>

      {delMes.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 font-medium">Todavía no hay consumo registrado este mes</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Se llena solo a medida que se usa la IA (buscar leads, sacar contactos,
            generar mensajes). Volvé después de usar alguna de esas funciones.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Por función */}
          <div className="rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" /> En qué se va
            </h2>
            <ul className="mt-3 space-y-2">
              {rutas.map(([ruta, v]) => {
                const pct = total > 0 ? Math.round((v.costo / total) * 100) : 0;
                return (
                  <li key={ruta}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{ruta}</span>
                      <span className="shrink-0 tabular-nums">{usd(v.costo)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                        {v.llamadas} llamada{v.llamadas === 1 ? "" : "s"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Por persona */}
          <div className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Quién la usa</h2>
            <ul className="mt-3 space-y-1.5">
              {personas.map(([nombre, costo]) => (
                <li key={nombre} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{nombre}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {usd(costo)}
                  </span>
                </li>
              ))}
            </ul>

            <h2 className="mt-5 font-semibold">Últimas llamadas</h2>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {delMes.slice(0, 8).map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {r.ruta} · {r.modelo.replace("claude-", "")}
                  </span>
                  <span className="shrink-0 tabular-nums">{usd(r.costo_usd)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los costos son estimados según la lista de precios de Anthropic (Sonnet
        US$3/US$15 y Haiku US$1/US$5 por millón de tokens). Sirven para comparar
        entre funciones y detectar desvíos, no como factura exacta.
      </p>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bot className="h-6 w-6 text-primary" /> Gasto de IA
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Cuánto cuesta la inteligencia artificial de la app, en qué función se va
          y quién la usa. Sirve para decidir dónde conviene un modelo más barato.
        </p>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  destacado,
}: {
  label: string;
  value: string;
  sub?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 ${destacado ? "border-primary/40" : ""}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
