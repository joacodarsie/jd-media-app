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
  FileText,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta/instagram";
import { IgConnect } from "@/components/ig-connect";
import { IgRefreshButton } from "@/components/ig-refresh-button";
import { IgPublicationsList, type PubItem } from "@/components/ig-publications-list";

export const dynamic = "force-dynamic";

/** Suma de una métrica diaria en los últimos N snapshots (period total). */
function sumLast(snaps: Snap[], key: "reach" | "profile_views" | "interactions", n: number): number {
  return snaps.slice(0, n).reduce((acc, s) => acc + (Number(s[key]) || 0), 0);
}

function mediaKind(t: string): PubItem["kind"] {
  if (t === "VIDEO") return "reel";
  if (t === "CAROUSEL_ALBUM") return "carrusel";
  return "post";
}

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
  media?: IgMediaLite[];
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

/** Chip del mix de contenido (ej: "4 reels"). Atenuado si es 0. */
function MixBadge({ n, label }: { n: number; label: string }) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 font-medium " +
        (n > 0 ? "bg-primary/10 text-foreground" : "bg-muted/40 text-muted-foreground")
      }
    >
      {n} {label}
    </span>
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

  // Métricas de 28 días: las calculamos sumando los snapshots diarios (la API de
  // Meta dejó de servir el período "days_28" para estas métricas y devuelve 0).
  const diasConDatos = Math.min(snaps.length, 28);
  const reach28 = sumLast(snaps, "reach", 28);
  const views28 = sumLast(snaps, "profile_views", 28);
  const inter28 = sumLast(snaps, "interactions", 28);

  // Publicaciones del mes (con su tipo) + historias acumuladas del mes.
  const monthMedia = latest?.detalle?.media ?? latest?.detalle?.top_media ?? [];
  const monthStartISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const { data: storiesRaw } = await admin
    .from("ig_stories")
    .select("story_id, permalink, thumbnail_url, posted_at, reach, replies")
    .eq("cliente_id", c.id)
    .gte("posted_at", monthStartISO)
    .order("posted_at", { ascending: false });
  const stories = (storiesRaw ?? []) as {
    story_id: string;
    permalink: string | null;
    thumbnail_url: string | null;
    posted_at: string | null;
    reach: number | null;
    replies: number | null;
  }[];

  // Mix de contenido del mes.
  const mix = {
    reel: monthMedia.filter((m) => m.media_type === "VIDEO").length,
    post: monthMedia.filter((m) => m.media_type === "IMAGE").length,
    carrusel: monthMedia.filter((m) => m.media_type === "CAROUSEL_ALBUM").length,
    historia: stories.length,
  };

  // Lista unificada de publicaciones (feed + historias) para el listado filtrable.
  const pubItems: PubItem[] = [
    ...monthMedia.map((m) => ({
      id: m.id,
      kind: mediaKind(m.media_type),
      permalink: m.permalink,
      thumbnail_url: m.thumbnail_url,
      caption: m.caption,
      timestamp: m.timestamp,
      reach: m.reach,
      like_count: m.like_count,
      comments_count: m.comments_count,
      saved: m.saved,
      replies: null,
    })),
    ...stories.map((s) => ({
      id: s.story_id,
      kind: "historia" as const,
      permalink: s.permalink,
      thumbnail_url: s.thumbnail_url,
      caption: null,
      timestamp: s.posted_at,
      reach: s.reach,
      like_count: null,
      comments_count: null,
      saved: null,
      replies: s.replies,
    })),
  ];

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
        <div className="flex items-center gap-2">
          <Link
            href={`/reporte/cliente/${c.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4 text-primary" /> Reporte mensual
          </Link>
          {connected && <IgRefreshButton clientId={c.id} />}
        </div>
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
              label={diasConDatos >= 28 ? "Alcance (28 días)" : `Alcance (${diasConDatos} días)`}
              value={reach28 > 0 ? fmt(reach28) : "—"}
              icon={Radar}
            />
            <Kpi
              label="Visitas al perfil"
              value={views28 > 0 ? fmt(views28) : "—"}
              icon={Eye}
            />
            <Kpi
              label="Interacciones"
              value={inter28 > 0 ? fmt(inter28) : "—"}
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

          {/* Contenido del mes: mix por tipo + listado filtrable */}
          {pubItems.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Publicaciones del mes</h2>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <MixBadge n={mix.reel} label="reels" />
                  <MixBadge n={mix.post} label="posteos" />
                  <MixBadge n={mix.carrusel} label="carruseles" />
                  <MixBadge n={mix.historia} label="historias" />
                </div>
              </div>
              <IgPublicationsList items={pubItems} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Todavía no hay publicaciones registradas este mes. Aparecen acá cuando se
              actualizan los resultados.
            </p>
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
