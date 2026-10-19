import Link from "next/link";
import { ArrowLeft, ExternalLink, Heart, MessageCircle } from "lucide-react";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { InspoFuentes } from "@/components/inspo-fuentes";
import {
  deEstaSemana,
  ETIQUETA_FORMATO,
  ETIQUETA_UNA,
  formatosQueRinden,
  lasQueLaRompieron,
  type Formato,
  type PiezaInspo,
} from "@/lib/inspo/inspo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMOJI: Record<Formato, string> = { reel: "🎬", carrusel: "🗂️", foto: "🖼️", video: "📹" };

function Tarjeta({ p, i }: { p: PiezaInspo; i: number }) {
  const fecha = p.publicado_at ? new Date(p.publicado_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "";
  return (
    <a
      href={p.permalink ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
      style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-muted to-muted/40">
        {p.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagen} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">{EMOJI[p.formato]}</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {EMOJI[p.formato]} {ETIQUETA_UNA[p.formato]}
        </span>
        {p.rendimiento != null && p.rendimiento >= 1.5 && (
          <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground shadow">
            {p.rendimiento.toLocaleString("es-AR")}× su normal
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-semibold">{p.cuenta}</span>
          <span className="shrink-0 text-muted-foreground">{fecha}</span>
        </div>
        {p.caption && <p className="line-clamp-3 text-xs text-muted-foreground">{p.caption}</p>}
        <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" /> {(p.likes ?? 0).toLocaleString("es-AR")}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> {(p.comentarios ?? 0).toLocaleString("es-AR")}
          </span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}

/**
 * Inspo (19/10/2026): contenido real de Instagram relacionado a cada cuenta,
 * para que la CM se inspire sin salir a buscar. Lo que mejor funcionó en sus
 * cuentas de referencia en los últimos meses, lo que publicaron esta semana y
 * qué formatos rinden más.
 */
export default async function InspoPage({ searchParams }: { searchParams?: { cliente?: string } }) {
  const me = await requireUser();
  const admin = createAdmin();
  const esStaff = userInRoles(me, ["admin", "coordinador", "coordinador_diseno"]);
  let q = admin.from("clients").select("id, nombre, rubro").eq("estado", "activo").eq("es_interno", false).order("nombre");
  if (!esStaff) q = q.or(`cm_id.eq.${me.id},disenador_id.eq.${me.id},audiovisual_id.eq.${me.id},media_buyer_id.eq.${me.id}`);
  const { data: cRaw } = await q;
  const cuentas = (cRaw ?? []) as { id: string; nombre: string; rubro: string | null }[];
  const actual = cuentas.find((c) => c.id === searchParams?.cliente) ?? cuentas[0] ?? null;

  const [{ data: fRaw, error: fErr }, { data: pRaw }] = actual
    ? await Promise.all([
        admin.from("inspo_fuentes").select("id, tipo, valor, error, origen").eq("cliente_id", actual.id).order("created_at"),
        admin
          .from("inspo_piezas")
          .select("media_id, cuenta, permalink, caption, producto, publicado_at, likes, comentarios, imagen, rendimiento")
          .eq("cliente_id", actual.id)
          .gte("publicado_at", new Date(Date.now() - 180 * 86_400_000).toISOString())
          .order("publicado_at", { ascending: false })
          .limit(600),
      ])
    : [{ data: [], error: null }, { data: [] }];
  const fuentes = (fRaw ?? []) as { id: string; tipo: "cuenta" | "hashtag"; valor: string; error: string | null; origen?: string | null }[];
  const piezas: PiezaInspo[] = ((pRaw ?? []) as {
    media_id: string;
    cuenta: string | null;
    permalink: string | null;
    caption: string | null;
    producto: Formato;
    publicado_at: string | null;
    likes: number | null;
    comentarios: number | null;
    imagen: string | null;
    rendimiento: number | null;
  }[]).map((p) => ({ ...p, id: p.media_id, formato: p.producto, rendimiento: p.rendimiento == null ? null : Number(p.rendimiento) }));

  const formatos = formatosQueRinden(piezas);
  // Tendencias: qué formato rinde más en las referencias de TODAS las cuentas, último mes.
  const { data: tRaw } = await admin
    .from("inspo_piezas")
    .select("producto, rendimiento, media_id")
    .gte("publicado_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .not("rendimiento", "is", null)
    .limit(5000);
  const tendencias = formatosQueRinden(
    ((tRaw ?? []) as { producto: Formato; rendimiento: number; media_id: string }[]).map((x) => ({
      id: x.media_id,
      cuenta: null,
      permalink: null,
      caption: null,
      formato: x.producto,
      publicado_at: null,
      likes: null,
      comentarios: null,
      imagen: null,
      rendimiento: Number(x.rendimiento),
    }))
  );
  const maxF = Math.max(1, ...formatos.map((f) => f.rendimiento));
  const semana = deEstaSemana(piezas, Date.now());
  const top = lasQueLaRompieron(piezas);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contenidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Contenidos
        </Link>
        <h1 className="mt-1 text-2xl font-bold">💡 Inspo</h1>
        <p className="text-muted-foreground">
          Contenido real de Instagram de las cuentas que sirven de referencia para cada marca: qué les funcionó, qué publicaron esta semana y qué formatos rinden más.
        </p>
      </div>

      {cuentas.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No tenés cuentas asignadas.</p>
      ) : (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {cuentas.map((c) => (
            <Link
              key={c.id}
              href={`/contenidos/inspo?cliente=${c.id}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                c.id === actual?.id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:bg-muted"
              )}
            >
              {c.nombre}
            </Link>
          ))}
        </div>
      )}

      {actual && (
        <>
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Referencias de {actual.nombre}</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Sumá cuentas que comuniquen como queremos que comunique {actual.nombre}
              {actual.rubro ? ` (${actual.rubro.toLowerCase()})` : ""}: competencia que lo hace bien, marcas de otro país del mismo rubro, o
              referentes de estilo (tienen que ser públicas y de empresa o creador). Si nadie cargó nada, la IA propone cuentas del rubro (✨) y
              sumamos las que nombró el cliente en su reunión (🗣️); todas se verifican en Instagram. Se actualizan solas cada semana.
            </p>
            {fErr ? (
              <p className="text-sm text-red-600">Falta aplicar la migración 0207.</p>
            ) : (
              <InspoFuentes clienteId={actual.id} fuentes={fuentes} />
            )}
          </section>

          {piezas.length === 0 ? (
            fuentes.length > 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Todavía no trajimos publicaciones. Tocá el botón de actualizar.
              </p>
            ) : null
          ) : (
            <>
              {formatos.length > 0 && (
                <section className="rounded-xl border bg-card p-4">
                  <h2 className="text-sm font-semibold">📈 Qué formato rinde más en sus referencias</h2>
                  <p className="mb-3 text-xs text-muted-foreground">Cuánto rinde cada formato contra lo normal de cada cuenta (1× = lo habitual).</p>
                  <ul className="jd-cascada space-y-2">
                    {formatos.map((f, i) => (
                      <li key={f.formato} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                        <span>
                          {EMOJI[f.formato]} {ETIQUETA_FORMATO[f.formato]}
                        </span>
                        <span className="h-3 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn("block h-full rounded-full", i === 0 ? "bg-primary" : "bg-foreground/25")}
                            style={{ width: `${(f.rendimiento / maxF) * 100}%` }}
                          />
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          <b className="text-foreground">{f.rendimiento.toLocaleString("es-AR")}×</b> · {f.cantidad}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {tendencias.length > 0 && (
                <section className="rounded-xl border bg-gradient-to-r from-primary/10 via-transparent to-transparent p-4">
                  <h2 className="text-sm font-semibold">🌎 Tendencia del mes en todas las referencias de la agencia</h2>
                  <p className="mb-2 text-xs text-muted-foreground">Qué formato le está rindiendo más a las cuentas que seguimos, de todos los rubros.</p>
                  <div className="flex flex-wrap gap-2">
                    {tendencias.map((t, i) => (
                      <span
                        key={t.formato}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", i === 0 && "border-primary bg-primary/15 font-semibold")}
                      >
                        {EMOJI[t.formato]} {ETIQUETA_FORMATO[t.formato]} <b className="tabular-nums">{t.rendimiento.toLocaleString("es-AR")}×</b>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {semana.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold">🗓️ Lo que publicaron esta semana</h2>
                  <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                    {semana.slice(0, 12).map((p, i) => (
                      <div key={p.id} className="w-48 shrink-0 snap-start">
                        <Tarjeta p={p} i={i} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold">🔥 Las que la rompieron (últimos meses)</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Rindieron al menos el doble de lo normal en su cuenta. Mirá el gancho, el formato y el tono: eso es lo que está funcionando.
                </p>
                {top.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Ninguna pieza se despegó todavía. Sumá más referencias para tener con qué comparar.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {top.map((p, i) => (
                      <Tarjeta key={p.id} p={p} i={i} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
