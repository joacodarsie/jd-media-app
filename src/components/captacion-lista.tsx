"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intlWhatsappLink } from "@/lib/prospecting/shared";
import { marcarHecho, desmarcar } from "@/app/(app)/captacion/actions";
import type { AccionDelDia } from "@/lib/captacion/plan";

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  referido: {
    texto: "Referido",
    clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  reactivacion: {
    texto: "Reactivar",
    clase: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
};

export function CaptacionLista({ acciones }: { acciones: AccionDelDia[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filtro, setFiltro] = useState<"todos" | "referido" | "reactivacion">("todos");
  const [incentivo, setIncentivo] = useState("");
  const [hechoLocal, setHechoLocal] = useState<Set<string>>(new Set());

  const visibles = useMemo(
    () =>
      acciones.filter(
        (a) => filtro === "todos" || a.tipo === filtro
      ),
    [acciones, filtro]
  );

  /** El incentivo se agrega al vuelo: no hace falta regenerar nada. */
  function mensajeDe(a: AccionDelDia): string {
    if (a.tipo !== "referido" || !incentivo.trim()) return a.mensaje;
    return `${a.mensaje}\n\nY si cierra, ${incentivo.trim()}.`;
  }

  function copiar(a: AccionDelDia) {
    navigator.clipboard.writeText(mensajeDe(a));
    toast.success("Mensaje copiado");
  }

  function abrirWhatsApp(a: AccionDelDia) {
    const link = intlWhatsappLink(a.telefono, mensajeDe(a));
    if (!link) {
      toast.error("Este cliente no tiene un teléfono válido cargado.");
      return;
    }
    window.open(link, "_blank");
    marcar(a);
  }

  function marcar(a: AccionDelDia) {
    setHechoLocal((s) => new Set(s).add(a.clienteId + a.tipo));
    start(async () => {
      const res = await marcarHecho({
        tipo: a.tipo,
        targetId: a.clienteId,
        targetNombre: a.empresa,
      });
      if (res?.error) {
        toast.error(res.error);
        setHechoLocal((s) => {
          const n = new Set(s);
          n.delete(a.clienteId + a.tipo);
          return n;
        });
        return;
      }
      router.refresh();
    });
  }

  function deshacer(a: AccionDelDia) {
    setHechoLocal((s) => {
      const n = new Set(s);
      n.delete(a.clienteId + a.tipo);
      return n;
    });
    start(async () => {
      await desmarcar(a.tipo, a.clienteId);
      router.refresh();
    });
  }

  if (!acciones.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 font-medium">Le escribiste a todos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No queda nadie en la lista. Cargá contactos nuevos o esperá las
          respuestas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center rounded-md border bg-card p-0.5">
          {(["todos", "referido", "reactivacion"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFiltro(k)}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                filtro === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "todos" ? "Todos" : k === "referido" ? "Referidos" : "Reactivar"} (
              {k === "todos"
                ? acciones.length
                : acciones.filter((a) => a.tipo === k).length}
              )
            </button>
          ))}
        </div>
        <div className="min-w-[240px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">
            Incentivo por referido (opcional, se agrega al mensaje)
          </label>
          <Input
            value={incentivo}
            onChange={(e) => setIncentivo(e.target.value)}
            className="mt-1 h-9"
            placeholder="te descuento medio mes de abono"
          />
        </div>
      </div>

      <ul className="space-y-2">
        {visibles.map((a) => {
          const hecho = hechoLocal.has(a.clienteId + a.tipo);
          const et = ETIQUETA[a.tipo];
          return (
            <li
              key={a.clienteId + a.tipo}
              className={`rounded-xl border bg-card p-3 ${hecho ? "opacity-50" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${et.clase}`}
                    >
                      {et.texto}
                    </span>
                    <span className="font-medium">{a.empresa}</span>
                    {a.persona && (
                      <span className="text-sm text-muted-foreground">· {a.persona}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.motivo}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {hecho ? (
                    <Button variant="ghost" size="sm" onClick={() => deshacer(a)} disabled={pending}>
                      <Undo2 className="mr-1.5 h-4 w-4" /> Deshacer
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => copiar(a)}>
                        <Copy className="mr-1.5 h-4 w-4" /> Copiar
                      </Button>
                      <Button size="sm" onClick={() => abrirWhatsApp(a)} disabled={!a.telefono}>
                        <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcar(a)}
                        disabled={pending}
                        title="Ya le escribí por otro lado"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Ver el mensaje
                </summary>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-xs">
                  {mensajeDe(a)}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
