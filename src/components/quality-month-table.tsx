"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, CalendarCheck, Copy, MessageCircle, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildSurveyMessage, surveyUrl } from "@/lib/clientes/encuesta";
import { whatsappLink } from "@/lib/payment-reminder";
import { registrarReunionMensual } from "@/app/(app)/clientes/actions";

export interface QualityRow {
  clienteId: string;
  nombre: string;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  portalToken: string | null;
  puntaje: number | null;
  queMejorar: string | null;
  reunionFecha: string | null;
}

/**
 * La ronda de calidad del mes en una sola pantalla: a quién le falta la encuesta
 * y con quién falta la reunión. Antes había que entrar a las 17 fichas de a una
 * para copiar el link — y no se hacía.
 */
export function QualityMonthTable({
  filas,
  periodo,
  miNombre,
}: {
  filas: QualityRow[];
  periodo: string;
  miNombre: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [copiado, setCopiado] = useState<string | null>(null);
  const [reunionDe, setReunionDe] = useState<QualityRow | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [pending, start] = useTransition();

  /**
   * El mensaje se arma en el click (no en el render) porque necesita el origin
   * del navegador: armarlo en el render daría un HTML distinto en el server y
   * en el cliente.
   */
  function mensajeDe(f: QualityRow): string | null {
    if (!f.portalToken) return null;
    return buildSurveyMessage({
      contactoNombre: f.contactoNombre,
      clienteNombre: f.nombre,
      periodo,
      url: surveyUrl(window.location.origin, f.portalToken),
      deParte: miNombre,
    });
  }

  function abrirWhatsapp(f: QualityRow) {
    const msg = mensajeDe(f);
    if (!msg) return void toast.error("Esta cuenta no tiene portal generado.");
    const link = whatsappLink(f.contactoTelefono, msg);
    if (!link) return void toast.error("Esta cuenta no tiene un teléfono usable.");
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function copiar(f: QualityRow) {
    const msg = mensajeDe(f);
    if (!msg) return void toast.error("Esta cuenta no tiene portal generado.");
    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(f.clienteId);
      setTimeout(() => setCopiado(null), 1800);
      toast.success("Mensaje copiado, listo para pegar");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function guardarReunion() {
    if (!reunionDe) return;
    start(async () => {
      const res = await registrarReunionMensual({
        clienteId: reunionDe.clienteId,
        periodo,
        fecha,
        notas: notas || null,
      });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Reunión registrada");
      setReunionDe(null);
      setNotas("");
      startTransition(() => router.refresh());
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cuenta</th>
              <th className="px-3 py-2">Encuesta del mes</th>
              <th className="px-3 py-2">Reunión del mes</th>
              <th className="px-3 py-2 text-right">Pedir la encuesta</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const puedeWa = !!f.portalToken && !!f.contactoTelefono;
              return (
                <tr key={f.clienteId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/clientes/${f.clienteId}`} className="font-medium hover:underline">
                      {f.nombre}
                    </Link>
                    {f.contactoNombre && (
                      <div className="text-[11px] text-muted-foreground">{f.contactoNombre}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {f.puntaje != null ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                            f.puntaje >= 4
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : f.puntaje === 3
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          )}
                        >
                          <Star className="h-3 w-3" /> {f.puntaje}/5
                        </span>
                        {f.queMejorar && (
                          <span
                            className="max-w-[220px] truncate text-[11px] text-muted-foreground"
                            title={f.queMejorar}
                          >
                            “{f.queMejorar}”
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin responder</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {f.reunionFecha ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        {new Date(f.reunionFecha + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setReunionDe(f)}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" /> Registrar
                      </Button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => copiar(f)}
                        disabled={!f.portalToken}
                        title={
                          f.portalToken
                            ? "Copiar el mensaje con el link"
                            : "Esta cuenta todavía no tiene portal generado"
                        }
                      >
                        {copiado === f.clienteId ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copiar
                      </Button>
                      {puedeWa ? (
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                          onClick={() => abrirWhatsapp(f)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">sin teléfono</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!reunionDe} onOpenChange={(o) => !o && setReunionDe(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reunión mensual · {reunionDe?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fecha-reunion">Fecha</Label>
              <Input
                id="fecha-reunion"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notas-reunion">Notas (opcional)</Label>
              <Textarea
                id="notas-reunion"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Qué pidieron, qué prometimos, cómo los vimos…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReunionDe(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={guardarReunion} disabled={pending} className="gap-1">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
