import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  Users,
  Eye,
  Heart,
  Radar,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta/instagram";
import { IgConnect } from "@/components/ig-connect";
import { IgRefreshButton } from "@/components/ig-refresh-button";

export const dynamic = "force-dynamic";

interface IgMediaLite {
  id: string;
  caption: string | null;
  media_type: string;
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  reach: number | null;
  saved: number | null;
}
interface Detalle {
  month?: { reach?: number; profile_views?: number; interactions?: number };
  top_media?: IgMediaLite[];
}
interface Snap {
  fecha: string;
  followers: number;
  follows: number;
  media_count: number;
  reach: number;
  profile_views: number;
  interactions: number;
  detalle: Detalle | null;
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");

function Kpi({
  label,
  value,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  delta?: number | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {delta != null && delta !== 0 && (
        <div
          className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${
            delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta > 0 ? "+" : ""}
          {fmt(delta)} en 30 días
        </div>
      )}
    </div>
  );
}

/** Sparkline simple de seguidores (orden cronológico). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 320;
  const h = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function ResultadosPage({ params }: { params: { id: string } }) {
  const me = await requireUser();

  const admin = createAdmin();
  const { data: client } = await admin
    .from("clients")
    .select("id, nombre, ig_user_id, ig_username, instagram_url, cm_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const c = client as {
    id: string;
    nombre: string;
    ig_user_id: string | null;
    ig_username: string | null;
    instagram_url: string | null;
    cm_id: string | null;
  };

  // Acceso: staff, media buyer, o el CM asignado a la cuenta.
  const canSee = isStaff(me.rol) || me.rol === "paid_media" || c.cm_id === me.id;
  if (!canSee) notFound();

  const connected = !!c.ig_user_id;

  const { data: snapsRaw } = await admin
    .from("ig_snapshots")
    .select("fecha, followers, follows, media_count, reach, profile_views, interactions, detalle")
    .eq("cliente_id", c.id)
    .order("fecha", { ascending: false })
    .limit(60);
  const snaps = (snapsRaw ?? []) as Snap[];
  const latest = snaps[0] ?? null;

  // Crecimiento de seguidores: último vs el snapshot más cercano a 30 días atrás.
  let delta30: number | null = null;
  if (latest) {
    const target = new Date(latest.fecha);
    target.setDate(target.getDate() - 30);
    const targetISO = target.toISOString().slice(0, 10);
    const prev = snaps.find((s) => s.fecha <= targetISO) ?? snaps[snaps.length - 1];
    if (prev && prev.fecha !== latest.fecha) delta30 = latest.followers - prev.followers;
  }

  const month = latest?.detalle?.month ?? null;
  const topMedia = latest?.detalle?.top_media ?? [];
  // Seguidores en orden cronológico para el sparkline.
  const followersSeries = [...snaps].reverse().map((s) => s.followers);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/clientes/${c.id}`}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {c.nombre}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-primary" /> Resultados
          </h1>
          <p className="text-muted-foreground">
            Los resultados de Instagram de <b>{c.nombre}</b>: seguidores, alcance, visitas al
            perfil e interacciones. Se actualizan solos cada día.
          </p>
        </div>
        {connected && <IgRefreshButton clientId={c.id} />}
      </div>

      {!metaConfigured() && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Falta conectar Meta (token del sistema). Avisale al admin.</span>
        </div>
      )}

      {/* Conexión de la cuenta */}
      <IgConnect clientId={c.id} connected={connected} username={c.ig_username} />

      {connected && !latest && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Todavía no hay datos. Tocá <b>Actualizar ahora</b> para traer los primeros resultados
          (después se actualiza solo cada día).
        </div>
      )}

      {latest && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Seguidores" value={fmt(latest.followers)} icon={Users} delta={delta30} />
            <Kpi
              label="Alcance (28 días)"
              value={month?.reach ? fmt(month.reach) : "—"}
              icon={Radar}
            />
            <Kpi
              label="Visitas al perfil"
              value={month?.profile_views ? fmt(month.profile_views) : "—"}
              icon={Eye}
            />
            <Kpi
              label="Interacciones"
              value={month?.interactions ? fmt(month.interactions) : "—"}
              icon={Heart}
            />
            <Kpi label="Publicaciones" value={fmt(latest.media_count)} icon={BarChart3} />
          </div>

          {/* Crecimiento de seguidores */}
          {followersSeries.length >= 2 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">Crecimiento de seguidores</div>
                <div className="text-xs text-muted-foreground">
                  {snaps[snaps.length - 1]?.fecha} → {latest.fecha}
                </div>
              </div>
              <Sparkline values={followersSeries} />
            </div>
          )}

          {/* Top publicaciones */}
          {topMedia.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Publicaciones destacadas (último mes)</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {topMedia.map((m) => (
                  <a
                    key={m.id}
                    href={m.permalink ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-lg border bg-card transition hover:border-primary/40"
                  >
                    <div className="relative aspect-square bg-muted">
                      {m.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {m.media_type}
                        </div>
                      )}
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {m.media_type === "VIDEO" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrusel" : "Post"}
                      </span>
                    </div>
                    <div className="space-y-1 p-2">
                      {m.caption && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{m.caption}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {m.reach != null && (
                          <span className="inline-flex items-center gap-1">
                            <Radar className="h-3 w-3" /> {fmt(m.reach)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {fmt(m.like_count)}
                        </span>
                        {m.saved != null && m.saved > 0 && (
                          <span className="inline-flex items-center gap-1">★ {fmt(m.saved)}</span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Último dato: {latest.fecha}.{" "}
            {c.instagram_url && (
              <a
                href={c.instagram_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Ver perfil <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </>
      )}
    </div>
  );
}
