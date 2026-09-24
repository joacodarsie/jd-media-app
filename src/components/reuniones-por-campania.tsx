"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, MessageCircle, Send, Video, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cuandoReunion, diaAr } from "@/lib/prospecting/reunion";
import { intlWhatsappLink } from "@/lib/prospecting/shared";
import { AgendarReunionDialog } from "@/components/agendar-reunion-dialog";
import { BotonPropuesta } from "@/components/prospecting-contacts-table";
import { updateContact } from "@/app/(app)/prospeccion/actions";

export interface ReunionRow {
  id: string;
  empresa: string;
  contactoNombre: string | null;
  telefono: string | null;
  /** null = quedó en "reunión" sin día (marcada antes del 24/9). */
  fecha: string | null;
  meetLink: string | null;
  quien: string | null;
  campaniaId: string;
  campania: string;
  tienePropuesta: boolean;
  /** Estado "Propuesta enviada": la reunión ya fue, falta su respuesta. */
  propuestaEnviada: boolean;
}

/**
 * Las reuniones con prospectos de todas las campañas, en un solo lugar.
 * Dentro de cada campaña: primero las que ya pasaron y nadie resolvió, después
 * las próximas por fecha y al final las que esperan respuesta a la propuesta.
 */
export function ReunionesPorCampania({
  filas,
  hoy,
  ahora,
}: {
  filas: ReunionRow[];
  hoy: string;
  ahora: string;
}) {
  const router = useRouter();
  const [reprogramar, setReprogramar] = useState<ReunionRow | null>(null);
  const [pending, start] = useTransition();

  const pasada = (r: ReunionRow) =>
    !r.propuestaEnviada &&
    !!r.fecha &&
    r.fecha < ahora &&
    diaAr(r.fecha) !== hoy;
  const orden = (r: ReunionRow) =>
    r.propuestaEnviada
      ? `3${r.fecha ?? ""}`
      : pasada(r)
        ? "0"
        : r.fecha
          ? `1${r.fecha}`
          : "2";

  const grupos = new Map<string, { nombre: string; filas: ReunionRow[] }>();
  for (const r of filas) {
    const g = grupos.get(r.campaniaId) ?? { nombre: r.campania, filas: [] };
    g.filas.push(r);
    grupos.set(r.campaniaId, g);
  }
  const lista = [...grupos.entries()]
    .map(([id, g]) => ({
      id,
      ...g,
      filas: g.filas.sort((a, b) => orden(a).localeCompare(orden(b))),
    }))
    .sort((a, b) => orden(a.filas[0]).localeCompare(orden(b.filas[0])));

  const agendadas = filas.filter((r) => !r.propuestaEnviada);
  const deHoy = agendadas.filter(
    (r) => r.fecha && diaAr(r.fecha) === hoy,
  ).length;
  const proximas = agendadas.filter((r) => r.fecha && !pasada(r)).length;
  const esperando = filas.length - agendadas.length;
  const sinResolver = filas.filter(pasada).length;

  function pasarA(r: ReunionRow, estado: "propuesta" | "descartado") {
    start(async () => {
      const res = await updateContact(r.id, { estado });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(
        estado === "propuesta"
          ? `${r.empresa}: propuesta enviada.`
          : `${r.empresa} pasó a "No / Descartado".`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reuniones</h1>
        <p className="text-muted-foreground">
          {filas.length === 0
            ? "No hay reuniones agendadas con prospectos."
            : [
                deHoy ? `${deHoy} hoy` : null,
                `${proximas} por delante`,
                sinResolver
                  ? `${sinResolver} ya pasaron y falta decir cómo salieron`
                  : null,
                esperando
                  ? `${esperando} ${esperando === 1 ? "propuesta espera" : "propuestas esperan"} respuesta`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>

      {lista.map((g) => (
        <Card key={g.id}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
              <p className="truncate font-semibold">{g.nombre}</p>
              <Link
                href={`/prospeccion/${g.id}/contactos`}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Ver campaña →
              </Link>
            </div>
            <ul>
              {g.filas.map((r) => {
                const ya = pasada(r);
                const esHoy = !!r.fecha && diaAr(r.fecha) === hoy;
                const wa = intlWhatsappLink(r.telefono, "");
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-3 last:border-0",
                      ya && "bg-amber-50 dark:bg-amber-950/40",
                    )}
                  >
                    <div className="w-28 shrink-0 text-sm">
                      {r.fecha ? (
                        <span
                          className={cn(
                            "font-medium",
                            esHoy &&
                              !r.propuestaEnviada &&
                              "text-violet-600 dark:text-violet-300",
                            r.propuestaEnviada &&
                              "font-normal text-muted-foreground",
                          )}
                        >
                          {r.propuestaEnviada
                            ? `Reunión ${cuandoReunion(r.fecha).split(",")[0]}`
                            : esHoy
                              ? `Hoy, ${cuandoReunion(r.fecha).split(", ")[1]}`
                              : cuandoReunion(r.fecha)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin día</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.empresa}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          r.contactoNombre,
                          r.quien ? `la lleva ${r.quien}` : null,
                          r.tienePropuesta && !r.propuestaEnviada
                            ? "propuesta armada"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {ya && (
                          <span className="text-amber-700 dark:text-amber-300">
                            {" "}
                            · ¿cómo salió?
                          </span>
                        )}
                        {r.propuestaEnviada && (
                          <span className="text-amber-700 dark:text-amber-300">
                            {" "}
                            · propuesta enviada
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {r.meetLink && !ya && !r.propuestaEnviada && (
                        <a
                          href={r.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Entrar a la reunión"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                        >
                          <Video className="h-4 w-4" />
                        </a>
                      )}
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Escribirle por WhatsApp"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-emerald-600"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      {!r.propuestaEnviada && (
                        <button
                          onClick={() => setReprogramar(r)}
                          title={r.fecha ? "Reprogramar" : "Ponerle día y hora"}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                        >
                          <CalendarClock className="h-4 w-4" />
                        </button>
                      )}
                      <BotonPropuesta contactoId={r.id} empresa={r.empresa} />
                      {!r.propuestaEnviada && (
                        <button
                          onClick={() => pasarA(r, "propuesta")}
                          disabled={pending}
                          title="Propuesta enviada"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-amber-600 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => pasarA(r, "descartado")}
                        disabled={pending}
                        title="No avanzó (pasa a descartado)"
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-rose-600 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      <AgendarReunionDialog
        contacto={
          reprogramar
            ? {
                id: reprogramar.id,
                empresa: reprogramar.empresa,
                reunion_fecha: reprogramar.fecha,
                meet_link: reprogramar.meetLink,
              }
            : null
        }
        onClose={() => setReprogramar(null)}
        onAgendada={() => router.refresh()}
      />
    </div>
  );
}
