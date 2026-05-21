"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MessageSquareWarning, Clock } from "lucide-react";

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
}

const ESTADO_LABEL: Record<string, string> = {
  revision_cliente: "Esperando tu revisión",
  aprobado: "Aprobada por vos",
  rechazado: "Pediste cambios",
  publicado: "Publicada",
};

const ESTADO_COLOR: Record<string, string> = {
  revision_cliente: "bg-amber-100 text-amber-800",
  aprobado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-700",
  publicado: "bg-green-600 text-white",
};

export function ApprovalPortal({
  token,
  publicaciones,
}: {
  token: string;
  publicaciones: PublicPub[];
}) {
  const pendientes = publicaciones.filter((p) => p.estado === "revision_cliente");
  const otras = publicaciones.filter((p) => p.estado !== "revision_cliente");

  return (
    <div className="space-y-6">
      {pendientes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <p className="font-medium">No tenés piezas para revisar.</p>
            <p className="text-sm text-muted-foreground">
              Cuando el equipo te mande algo nuevo, va a aparecer acá.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Para revisar ({pendientes.length})
          </h2>
          {pendientes.map((p) => (
            <PubCard key={p.id} pub={p} token={token} canDecide />
          ))}
        </section>
      )}

      {otras.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historial reciente
          </h2>
          {otras.slice(0, 10).map((p) => (
            <PubCard key={p.id} pub={p} token={token} canDecide={false} />
          ))}
        </section>
      )}
    </div>
  );
}

function PubCard({
  pub,
  token,
  canDecide,
}: {
  pub: PublicPub;
  token: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [pending, start] = useTransition();
  const [showRejectBox, setShowRejectBox] = useState(false);

  async function decide(decision: "aprobado" | "rechazado") {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await sb.rpc("jd_client_decision", {
      p_token: token,
      p_pub_id: pub.id,
      p_decision: decision,
      p_comentario: comentario || null,
    });
    if (error || !(data as { ok: boolean })?.ok) {
      alert("No se pudo guardar. Probá de nuevo o avisanos.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
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
        {pub.notas_revision && (
          <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-semibold">Notas previas:</span>{" "}
            {pub.notas_revision}
          </div>
        )}

        {canDecide && (
          <div className="space-y-2 border-t pt-3">
            {showRejectBox && (
              <Textarea
                placeholder="¿Qué cambiarías?"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="min-h-[80px]"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  start(() => {
                    decide("aprobado");
                  })
                }
                disabled={pending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
              </Button>
              {!showRejectBox ? (
                <Button
                  variant="outline"
                  onClick={() => setShowRejectBox(true)}
                >
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Pedir cambios
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={pending || !comentario.trim()}
                  onClick={() =>
                    start(() => {
                      decide("rechazado");
                    })
                  }
                >
                  Enviar pedido de cambios
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
