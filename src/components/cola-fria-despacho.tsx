"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap,
  Check,
  PhoneOff,
  SkipForward,
  MessageCircle,
  CalendarCheck,
  AtSign,
  Globe,
  Send,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  intlWhatsappLink,
  waDigits,
  instagramUrl,
  ensureHttp,
  personalizarMensaje,
} from "@/lib/prospecting/shared";
import { tieneWhatsapp, type ContactoFrio } from "@/lib/captacion/cola-fria";
import { updateContact, bulkSetContactoEstado } from "@/app/(app)/prospeccion/actions";

/** Los escritos sin despachar sobreviven a un refresh o a cerrar la pestaña. */
const LS_ESCRITOS = "cola-fria:escritos";
function leerEscritos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_ESCRITOS) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function fechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "2-digit" });
}

/** Mensaje elegido de cada campaña, resuelto en el server. */
export type MensajesPorCampana = Record<string, { texto: string; label: string } | undefined>;

/**
 * La cola fría del día, cruzando campañas.
 *
 * El flujo es el mismo que el despacho de una campaña —copiar número, copiar
 * mensaje, marcar— porque ya está probado y el equipo lo conoce. Lo que cambia
 * es que la cola es de la PERSONA y no de la campaña, y que acá sí se puede
 * marcar **Agendó reunión**: al 13/9/2026 los 1.090 contactos tenían cero
 * reuniones registradas, así que el embudo no tenía su paso más importante.
 *
 * Pedido de Santi (24/9): el botón verde ya no manda el contacto a
 * "contactado" de una. Lo marca como **escrito** y arriba aparece
 * **Despachar**, que pasa todos los escritos juntos. Así un toque de más se
 * deshace antes de que cuente.
 */
export function ColaFriaDespacho({
  cola,
  seguimientos,
  mensajes,
  hechosHoy,
  faltanHoy,
  meta,
  pendientesTotal,
  conWhatsapp,
}: {
  cola: ContactoFrio[];
  seguimientos: ContactoFrio[];
  mensajes: MensajesPorCampana;
  hechosHoy: number;
  faltanHoy: number;
  meta: number;
  pendientesTotal: number;
  conWhatsapp: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saltados, setSaltados] = useState<Set<string>>(new Set());
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  // Escritos sin despachar: todavía no cuentan como contactados en la base.
  const [escritos, setEscritos] = useState<string[]>([]);
  const [despachando, startDespacho] = useTransition();
  const [, startTransition] = useTransition();

  // Recuperar los escritos guardados, solo los que siguen en la cola.
  useEffect(() => {
    const enCola = new Set(cola.map((c) => c.id));
    setEscritos(leerEscritos().filter((id) => enCola.has(id)));
  }, [cola]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_ESCRITOS, JSON.stringify(escritos));
    } catch {
      /* sin storage: queda en memoria */
    }
  }, [escritos]);
  // Avisar antes de irse con escritos sin despachar.
  useEffect(() => {
    if (escritos.length === 0) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [escritos.length]);

  const escritosSet = useMemo(() => new Set(escritos), [escritos]);
  const pendientesVista = useMemo(
    () => cola.filter((c) => !saltados.has(c.id) && !hechos.has(c.id) && !escritosSet.has(c.id)),
    [cola, saltados, hechos, escritosSet]
  );
  const actual = pendientesVista[0] ?? null;
  const porId = useMemo(() => new Map(cola.map((c) => [c.id, c])), [cola]);

  // Los escritos cuentan para la meta del día: el mensaje ya salió.
  const hoyTotal = hechosHoy + hechos.size + escritos.length;
  const faltan = Math.max(0, faltanHoy - hechos.size - escritos.length);

  function marcarEscrito(c: ContactoFrio) {
    setEscritos((p) => (p.includes(c.id) ? p : [...p, c.id]));
  }
  function deshacerEscrito(id: string) {
    setEscritos((p) => p.filter((x) => x !== id));
  }
  function despacharEscritos() {
    const ids = [...escritos];
    if (ids.length === 0) return;
    startDespacho(async () => {
      const res = await bulkSetContactoEstado(ids, "contactado");
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setHechos((p) => new Set([...p, ...ids]));
      setEscritos([]);
      toast.success(`${ids.length} contacto${ids.length === 1 ? "" : "s"} pasado${ids.length === 1 ? "" : "s"} a contactados.`);
      router.refresh();
    });
  }

  const barraEscritos =
    escritos.length > 0 ? (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 dark:border-emerald-500/40 dark:bg-emerald-500/10">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            <b className="tabular-nums">{escritos.length}</b> escrito{escritos.length === 1 ? "" : "s"} sin despachar
          </span>
          <Button
            size="sm"
            onClick={despacharEscritos}
            disabled={despachando}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {despachando ? "Despachando…" : `Despachar ${escritos.length}`}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {escritos.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => deshacerEscrito(id)}
              title="Sacarlo: vuelve a la cola"
              className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] hover:bg-muted"
            >
              <span className="truncate">{porId.get(id)?.empresa ?? "contacto"}</span>
              <Undo2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    ) : null;
  const pct = meta > 0 ? Math.min(100, Math.round((hoyTotal / meta) * 100)) : 0;

  function mensajeDe(c: ContactoFrio): string {
    const tpl = mensajes[c.campaign_id]?.texto;
    if (!tpl) return "";
    return personalizarMensaje(tpl, { empresa: c.empresa, contacto: c.contacto_nombre });
  }

  /** Marca en el server; la fila sale de la cola sola. */
  function marcar(c: ContactoFrio, como: "contactado" | "no_se_pudo" | "reunion") {
    setHechos((p) => new Set(p).add(c.id));
    startTransition(async () => {
      const patch =
        como === "no_se_pudo"
          ? { contactable: false }
          : { estado: como === "reunion" ? "reunion" : "contactado", contactable: true };
      const res = await updateContact(c.id, patch);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setHechos((p) => {
          const n = new Set(p);
          n.delete(c.id);
          return n;
        });
        router.refresh();
      } else if (como === "reunion") {
        toast.success("Reunión agendada. Va al embudo de la Máquina de clientes.");
      }
    });
  }

  if (pendientesTotal === 0 && seguimientos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No tenés contactos fríos asignados. Pedile al director que te reparta una
        tanda desde{" "}
        <Link href="/prospeccion" className="underline hover:text-foreground">
          Prospección
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Tus contactos fríos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tu lista de todas las campañas juntas, con los que sí tienen WhatsApp
            arriba. El mensaje de cada campaña ya viene escrito.
          </p>
        </div>
        {(pendientesVista.length > 0 || escritos.length > 0) && (
          <Button
            onClick={() => setAbierto(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Zap className="mr-2 h-4 w-4" />{" "}
            {pendientesVista.length > 0 ? `Escribirle a ${pendientesVista.length}` : "Despachar los escritos"}
          </Button>
        )}
      </div>

      {/* Meta del día: el número chico contra el que se mide. */}
      {meta > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <b className="tabular-nums">{hoyTotal}</b> de{" "}
              <span className="tabular-nums">{meta}</span> mensajes hoy
            </span>
            <span
              className={cn(
                "text-xs",
                faltan === 0
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              )}
            >
              {faltan === 0 ? "✅ Meta cumplida" : `Faltan ${faltan}`}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                faltan === 0 ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {barraEscritos && <div className="mt-3">{barraEscritos}</div>}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          <b className="text-foreground tabular-nums">{pendientesTotal}</b> sin tocar
        </span>
        <span>
          <b className="text-foreground tabular-nums">{conWhatsapp}</b> con WhatsApp
        </span>
        {seguimientos.length > 0 && (
          <span>
            <b className="text-amber-600 tabular-nums dark:text-amber-400">
              {seguimientos.length}
            </b>{" "}
            esperando seguimiento
          </span>
        )}
      </div>

      {/* ── Despacho, uno por uno ── */}
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="overflow-x-hidden sm:max-w-lg">
          <DialogHeader className="min-w-0">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate">Tu cola de hoy</span>
            </DialogTitle>
          </DialogHeader>

          {barraEscritos}

          {actual ? (
            <div className="min-w-0 space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold" title={actual.empresa}>
                    {actual.empresa}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {actual.contacto_nombre
                      ? `${actual.contacto_nombre}${actual.contacto_rol ? ` · ${actual.contacto_rol}` : ""}`
                      : "Sin persona de contacto"}
                    {fechaCorta(actual.created_at) && (
                      <> · prospectado el {fechaCorta(actual.created_at)}</>
                    )}
                    {actual.telefono && (
                      <>
                        {" · "}
                        <span className="tabular-nums">{actual.telefono}</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  quedan {pendientesVista.length}
                </span>
              </div>

              {!tieneWhatsapp(actual.telefono) && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  ☎️ {actual.telefono ? "Este número parece un fijo" : "No tiene teléfono"}:
                  probá por Instagram o buscá el celular en la web. Si no se puede,
                  marcalo con <b>No se pudo</b> así no vuelve a aparecer.
                </p>
              )}

              {(actual.instagram || actual.sitio_web) && (
                <div className="flex flex-wrap gap-2">
                  {actual.instagram && (
                    <a
                      href={instagramUrl(actual.instagram) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      <AtSign className="h-3.5 w-3.5" /> {actual.instagram}
                    </a>
                  )}
                  {actual.sitio_web && (
                    <a
                      href={ensureHttp(actual.sitio_web) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      <Globe className="h-3.5 w-3.5" /> Sitio
                    </a>
                  )}
                </div>
              )}

              {mensajeDe(actual) ? (
                <div className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  {mensajeDe(actual)}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  La campaña de este contacto no tiene mensajes generados: el
                  WhatsApp se abre vacío.{" "}
                  <Link
                    href={`/prospeccion/${actual.campaign_id}`}
                    className="underline hover:text-foreground"
                  >
                    Generalos acá
                  </Link>
                  .
                </p>
              )}

              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
                  <CopiarBoton
                    label="1 · Copiar número"
                    text={waDigits(actual.telefono ?? "") ?? actual.telefono ?? ""}
                  />
                  <CopiarBoton
                    label="2 · Copiar mensaje"
                    text={mensajeDe(actual)}
                    disabled={!mensajeDe(actual)}
                  />
                </div>
                <Button
                  onClick={() => marcarEscrito(actual)}
                  className="h-11 min-w-0 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Check className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">3 · Ya le escribí, siguiente</span>
                </Button>
                <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const wa = intlWhatsappLink(actual.telefono, mensajeDe(actual));
                      if (wa) window.open(wa, "_blank", "noopener,noreferrer");
                      else toast.error("Este contacto no tiene un número usable.");
                    }}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Abrir WA</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => marcar(actual, "no_se_pudo")}
                    className="text-rose-600 dark:text-rose-400"
                  >
                    <PhoneOff className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">No se pudo</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaltados((p) => new Set(p).add(actual.id))}
                  >
                    <SkipForward className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Saltar</span>
                  </Button>
                </div>
                {/* El paso que nunca se registraba: sin esto el embudo no tiene
                    su métrica más importante. */}
                <Button
                  variant="outline"
                  onClick={() => marcar(actual, "reunion")}
                  className="h-10 min-w-0 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                >
                  <CalendarCheck className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">🎯 Agendó reunión</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm font-medium">
                {escritos.length > 0
                  ? "Terminaste la cola. Despachá los escritos de arriba para que cuenten."
                  : hechos.size > 0
                    ? `Listo: ${hechos.size} contacto${hechos.size === 1 ? "" : "s"} despachado${hechos.size === 1 ? "" : "s"}.`
                    : "No queda nada en la cola."}
              </p>
              {saltados.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSaltados(new Set())}>
                  Volver a los {saltados.size} que salteaste
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Los que hay que volver a tocar ── */}
      {seguimientos.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-medium">
            Esperando respuesta hace 3 días o más
          </p>
          <ul className="mt-2 space-y-1">
            {seguimientos.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{c.empresa}</span>
                <Link
                  href={`/prospeccion/${c.campaign_id}/contactos`}
                  className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
                >
                  abrir
                </Link>
              </li>
            ))}
          </ul>
          {seguimientos.length > 6 && (
            <p className="mt-1 text-xs text-muted-foreground">
              y {seguimientos.length - 6} más.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CopiarBoton({
  label,
  text,
  disabled,
}: {
  label: string;
  text: string;
  disabled?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={disabled || !text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1200);
        } catch {
          toast.error("No se pudo copiar.");
        }
      }}
      className="h-11 min-w-0"
    >
      {copiado ? (
        <>
          <Check className="mr-2 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">Copiado</span>
        </>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </Button>
  );
}
