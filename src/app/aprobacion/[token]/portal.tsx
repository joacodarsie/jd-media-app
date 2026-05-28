"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  MessageSquareWarning,
  MessageSquare,
  Clock,
  CalendarDays,
  List,
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicPub {
  id: string;
  titulo: string;
  descripcion: string | null;
  copy: string | null;
  guion: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  hashtags: string | null;
  asset_url: string | null;
  referencia_url: string | null;
  estado: string;
  notas_revision: string | null;
  publicacion_url: string | null;
  resubido_tiktok: boolean;
}

interface PublicComment {
  id: string;
  publication_id: string;
  contenido: string;
  created_at: string;
}

const ESTADO_LABEL: Record<string, string> = {
  idea: "Idea",
  en_diseno: "En diseño",
  guion: "Guion",
  edicion: "Edición",
  revision_creativa: "En revisión",
  revision_cliente: "Esperando tu revisión",
  aprobado: "Aprobado",
  publicado: "Publicado",
  rechazado: "Pediste cambios",
};

const ESTADO_COLOR: Record<string, string> = {
  idea: "bg-slate-200 text-slate-800",
  en_diseno: "bg-blue-200 text-blue-900",
  guion: "bg-indigo-200 text-indigo-900",
  edicion: "bg-purple-200 text-purple-900",
  revision_creativa: "bg-amber-200 text-amber-900",
  revision_cliente: "bg-orange-200 text-orange-900",
  aprobado: "bg-lime-200 text-lime-900",
  publicado: "bg-emerald-600 text-white",
  rechazado: "bg-rose-200 text-rose-900",
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

type View = "pendientes" | "calendario" | "todas";

export function ApprovalPortal({
  token,
  publicaciones,
  comentarios,
}: {
  token: string;
  publicaciones: PublicPub[];
  comentarios: PublicComment[];
}) {
  const [view, setView] = useState<View>("pendientes");
  const [openPub, setOpenPub] = useState<string | null>(null);

  // Indexar comentarios por publicación
  const commentsByPub = useMemo(() => {
    const m = new Map<string, PublicComment[]>();
    for (const c of comentarios) {
      const list = m.get(c.publication_id) ?? [];
      list.push(c);
      m.set(c.publication_id, list);
    }
    return m;
  }, [comentarios]);

  const pendientes = publicaciones.filter((p) => p.estado === "revision_cliente");
  const otras = publicaciones.filter((p) => p.estado !== "revision_cliente");

  return (
    <div className="space-y-6">
      {/* Tabs de vista */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border bg-card p-0.5">
          <ViewBtn
            icon={Sparkles}
            label={`Para revisar (${pendientes.length})`}
            active={view === "pendientes"}
            onClick={() => setView("pendientes")}
            highlight={pendientes.length > 0}
          />
          <ViewBtn
            icon={CalendarDays}
            label="Calendario"
            active={view === "calendario"}
            onClick={() => setView("calendario")}
          />
          <ViewBtn
            icon={List}
            label={`Todas (${publicaciones.length})`}
            active={view === "todas"}
            onClick={() => setView("todas")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Podés dejar comentarios o pedir cambios en cualquier pieza. Tu equipo
          los va a ver al toque.
        </p>
      </div>

      {view === "pendientes" && (
        <>
          {pendientes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
                <p className="font-medium">No tenés piezas para revisar.</p>
                <p className="text-sm text-muted-foreground">
                  Cuando el equipo te mande algo nuevo va a aparecer acá.
                </p>
              </CardContent>
            </Card>
          ) : (
            <section className="space-y-3">
              {pendientes.map((p) => (
                <PubCard
                  key={p.id}
                  pub={p}
                  token={token}
                  canDecide
                  comments={commentsByPub.get(p.id) ?? []}
                />
              ))}
            </section>
          )}
        </>
      )}

      {view === "calendario" && (
        <CalendarView
          publicaciones={publicaciones}
          commentsByPub={commentsByPub}
          token={token}
          onOpenPub={setOpenPub}
          openPub={openPub}
        />
      )}

      {view === "todas" && (
        <section className="space-y-3">
          {publicaciones.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Aún no hay contenido cargado.
              </CardContent>
            </Card>
          ) : (
            <>
              {pendientes.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Esperan tu revisión
                </h3>
              )}
              {pendientes.map((p) => (
                <PubCard
                  key={p.id}
                  pub={p}
                  token={token}
                  canDecide
                  comments={commentsByPub.get(p.id) ?? []}
                />
              ))}
              {otras.length > 0 && (
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Todo el calendario
                </h3>
              )}
              {otras.map((p) => (
                <PubCard
                  key={p.id}
                  pub={p}
                  token={token}
                  canDecide={false}
                  comments={commentsByPub.get(p.id) ?? []}
                />
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ViewBtn({
  icon: Icon,
  label,
  active,
  onClick,
  highlight,
}: {
  icon: typeof CalendarDays;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : highlight
            ? "text-foreground hover:bg-muted"
            : "text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function CalendarView({
  publicaciones,
  commentsByPub,
  token,
  onOpenPub,
  openPub,
}: {
  publicaciones: PublicPub[];
  commentsByPub: Map<string, PublicComment[]>;
  token: string;
  onOpenPub: (id: string | null) => void;
  openPub: string | null;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const m = new Map<string, PublicPub[]>();
    for (const p of publicaciones) {
      if (!p.fecha_publicacion) continue;
      const k = p.fecha_publicacion.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [publicaciones]);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const startDow = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startDow);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const openPubData = openPub ? publicaciones.find((p) => p.id === openPub) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const t = new Date();
            setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
          }}
        >
          Hoy
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b text-xs font-medium text-muted-foreground">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = ymd(d);
            const items = byDay.get(key) ?? [];
            const isToday = ymd(new Date()) === key;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[96px] border-b border-r p-1.5 text-xs last:border-r-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="mb-1">
                  <span
                    className={cn(
                      "font-medium",
                      isToday &&
                        "rounded-full bg-primary px-1.5 text-primary-foreground"
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onOpenPub(p.id)}
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium",
                        ESTADO_COLOR[p.estado] ?? ""
                      )}
                      title={`${p.titulo} · ${ESTADO_LABEL[p.estado]}`}
                    >
                      {p.titulo}
                    </button>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{items.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openPubData && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
          onClick={() => onOpenPub(null)}
        >
          <div
            className="w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-2xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <PubCard
              pub={openPubData}
              token={token}
              canDecide={openPubData.estado === "revision_cliente"}
              comments={commentsByPub.get(openPubData.id) ?? []}
              onClose={() => onOpenPub(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PubCard({
  pub,
  token,
  canDecide,
  comments,
  onClose,
}: {
  pub: PublicPub;
  token: string;
  canDecide: boolean;
  comments: PublicComment[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const [decisionNote, setDecisionNote] = useState("");
  const [comentario, setComentario] = useState("");
  const [pending, start] = useTransition();
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  async function decide(decision: "aprobado" | "rechazado") {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await sb.rpc("jd_client_decision", {
      p_token: token,
      p_pub_id: pub.id,
      p_decision: decision,
      p_comentario: decisionNote || null,
    });
    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      alert(
        "No se pudo guardar: " +
          (result?.error ?? error?.message ?? "intentá de nuevo")
      );
      return;
    }
    onClose?.();
    router.refresh();
  }

  async function sendComment() {
    if (!comentario.trim()) return;
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await sb.rpc("jd_client_add_comment", {
      p_token: token,
      p_pub_id: pub.id,
      p_contenido: comentario,
    });
    const result = data as { ok: boolean; error?: string } | null;
    if (error || !result?.ok) {
      alert(
        "No se pudo enviar el comentario: " +
          (result?.error ?? error?.message ?? "intentá de nuevo")
      );
      return;
    }
    setComentario("");
    setShowCommentBox(false);
    router.refresh();
  }

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{pub.titulo}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{pub.tipo}</span>
              <span>·</span>
              <span>{pub.red}</span>
              {pub.fecha_publicacion && (
                <>
                  <span>·</span>
                  <span>
                    <Clock className="mr-1 inline h-3 w-3" />
                    {new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge className={ESTADO_COLOR[pub.estado] ?? ""}>
            {ESTADO_LABEL[pub.estado] ?? pub.estado}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pub.asset_url && (
          <a
            href={pub.asset_url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border bg-muted"
          >
            {/\.(jpg|jpeg|png|gif|webp)$/i.test(pub.asset_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pub.asset_url}
                alt={pub.titulo}
                className="max-h-96 w-full object-contain"
              />
            ) : (
              <div className="p-4 text-sm">
                Ver pieza: <span className="underline">{pub.asset_url}</span>
              </div>
            )}
          </a>
        )}
        {pub.copy && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Texto / Copy
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{pub.copy}</p>
          </div>
        )}
        {pub.hashtags && (
          <p className="text-xs text-blue-700 dark:text-blue-400">
            {pub.hashtags}
          </p>
        )}
        {pub.publicacion_url && (
          <a
            href={pub.publicacion_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
          >
            Ver publicación final ↗
          </a>
        )}
        {pub.notas_revision && (
          <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">Nota anterior:</span>{" "}
            {pub.notas_revision}
          </div>
        )}

        {/* Comentarios previos */}
        {comments.length > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              Tus comentarios anteriores ({comments.length})
            </div>
            <ul className="space-y-1.5 text-sm">
              {comments.map((c) => (
                <li key={c.id} className="rounded bg-background p-2">
                  <p className="whitespace-pre-wrap">{c.contenido}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botones acciones */}
        <div className="space-y-2 border-t pt-3">
          {canDecide && (
            <>
              {showRejectBox && (
                <Textarea
                  placeholder="¿Qué cambiarías?"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="min-h-[80px]"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => start(() => decide("aprobado"))}
                  disabled={pending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
                </Button>
                {!showRejectBox ? (
                  <Button variant="outline" onClick={() => setShowRejectBox(true)}>
                    <MessageSquareWarning className="mr-2 h-4 w-4" />
                    Pedir cambios
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={pending || !decisionNote.trim()}
                    onClick={() => start(() => decide("rechazado"))}
                  >
                    Enviar pedido de cambios
                  </Button>
                )}
              </div>
            </>
          )}

          {!showCommentBox ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentBox(true)}
              className="gap-1.5 text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {canDecide ? "Dejar un comentario adicional" : "Comentar"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                autoFocus
                placeholder="Escribí lo que quieras decirle al equipo sobre esta pieza..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => start(() => sendComment())}
                  disabled={pending || !comentario.trim()}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar comentario
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCommentBox(false);
                    setComentario("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
