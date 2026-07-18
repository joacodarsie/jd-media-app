import Link from "next/link";
import { Megaphone, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers } from "@/lib/cache";
import { getChangelogEntries, latestEntryDate } from "@/lib/help/changelog";
import { NovedadesSeenMarker } from "@/components/novedades-seen-marker";
import { PortalNotices, type PortalNoticeRow } from "@/components/portal-notices";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Portal (ex Novedades): avisos importantes de dirección al equipo (con
 * destinatarios y confirmación de lectura) + las novedades de la plataforma.
 */
export default async function PortalPage({
  searchParams,
}: {
  searchParams?: { v?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();
  const vista = searchParams?.v === "novedades" ? "novedades" : "avisos";
  const isAdmin = me.rol === "admin";

  // Avisos visibles para mí (RLS filtra destinatarios) + mis lecturas.
  // Si la migración 0126 no está aplicada, las queries fallan en silencio.
  const [{ data: noticesRaw }, { data: readsRaw }, users] = await Promise.all([
    supabase
      .from("portal_notices")
      .select("id, titulo, cuerpo, destinatarios, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("portal_notice_reads")
      .select("notice_id")
      .eq("user_id", me.id),
    getActiveUsers(),
  ]);
  const reads = new Set(
    ((readsRaw ?? []) as { notice_id: string }[]).map((r) => r.notice_id)
  );
  const nameById = new Map(users.map((u) => [u.id, u.nombre]));
  const notices: PortalNoticeRow[] = (
    (noticesRaw ?? []) as Omit<PortalNoticeRow, "leida" | "autor">[]
  ).map((n) => ({
    ...n,
    leida: reads.has(n.id),
    autor: (n.created_by && nameById.get(n.created_by)) || "Dirección",
  }));

  const entries = getChangelogEntries();
  const latest = latestEntryDate();
  const unread = notices.filter((n) => !n.leida).length;

  const tab = (v: string, label: string, badge?: number) => (
    <Link
      href={v === "avisos" ? "/portal" : `/portal?v=${v}`}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
        vista === v
          ? "border-foreground bg-foreground text-background"
          : "bg-background hover:bg-accent"
      }`}
    >
      {label}
      {badge ? (
        <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Portal
            </div>
            <h1 className="text-2xl font-bold">Portal del equipo</h1>
            <p className="text-sm text-muted-foreground">
              Avisos importantes de dirección y novedades de la plataforma.
            </p>
          </div>
        </div>
        <Link
          href="/ayuda"
          className="hidden items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:inline-flex"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Centro de ayuda
        </Link>
      </div>

      <div className="flex gap-2">
        {tab("avisos", "📣 Avisos", unread)}
        {tab("novedades", "✨ Novedades de la app")}
      </div>

      {vista === "avisos" ? (
        <PortalNotices
          notices={notices}
          users={users.map((u) => ({ id: u.id, nombre: u.nombre }))}
          isAdmin={isAdmin}
          meId={me.id}
        />
      ) : (
        <>
          <NovedadesSeenMarker latestDate={latest} />
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Sin novedades por ahora.
            </div>
          ) : (
            <ol className="relative space-y-8 border-l-2 border-border/60 pl-6">
              {entries.map((e, i) => (
                <li key={`${e.date}-${i}`} className="relative">
                  <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {formatDate(e.date)}
                    </span>
                    {i === 0 && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        Último
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-bold tracking-tight">{e.title}</h2>
                  <article className="mt-2 space-y-2 text-[14.5px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {e.bodyMarkdown}
                    </ReactMarkdown>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
