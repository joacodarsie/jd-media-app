"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCircle2, Clock, ExternalLink, Loader2, Pencil } from "lucide-react";
import { aprobarTarea, pedirArchivo, pedirCambios } from "@/app/(app)/tareas/aprobacion-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ItemAprobar {
  id: string;
  ticket: string | null;
  titulo: string;
  cliente: string | null;
  persona: string | null;
  /** "vencida hace 3 días" / "quedan 5 h" — el reloj de las 24 h hábiles. */
  reloj: { texto: string; vencida: boolean } | null;
  /** Solo las piezas del calendario. */
  pieza: {
    /** "YYYY-MM-DD" o null. */
    sale: string | null;
    archivo: string | null;
    tieneArchivo: boolean;
  } | null;
}

/**
 * Lo que espera la aprobación de la dirección creativa, para decidir desde acá.
 *
 * Por qué (12/10/2026): la bandeja era una lista de links; aprobar exigía
 * entrar a cada tarea, y Santi lo hacía por fuera (WhatsApp, Canva) creyendo
 * que ya estaba. Ahora cada fila trae el archivo, "Aprobar" y "Pedir cambios".
 * Las piezas van primero y por fecha de publicación: lo que sale antes, arriba.
 */
export function BandejaAprobar({
  titulo,
  items,
  puedeDecidir,
}: {
  titulo: string;
  items: ItemAprobar[];
  puedeDecidir: boolean;
}) {
  const piezas = items.filter((i) => i.pieza);
  const otras = items.filter((i) => !i.pieza);
  return (
    <section className="rounded-xl border bg-card md:col-span-2">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold">
          {titulo} <span className="font-normal text-muted-foreground">({items.length})</span>
        </h2>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {piezas.length > 0 && (
          <Grupo nombre="Piezas del calendario · por fecha de publicación">
            {piezas.map((i) => (
              <Fila key={i.id} item={i} puedeDecidir={puedeDecidir} />
            ))}
          </Grupo>
        )}
        {otras.length > 0 && (
          <Grupo nombre="Otros entregables (arranques, piezas sueltas)">
            {otras.map((i) => (
              <Fila key={i.id} item={i} puedeDecidir={puedeDecidir} />
            ))}
          </Grupo>
        )}
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Aprobar acá mueve también la pieza del calendario. Si lo aprobaste por WhatsApp o Canva,
        marcalo acá: la app no se entera sola.
      </p>
    </section>
  );
}

function Grupo({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-muted/50 px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {nombre}
      </div>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function fechaCorta(ymd: string) {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

function Fila({ item: i, puedeDecidir }: { item: ItemAprobar; puedeDecidir: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pedido, setPedido] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [hecha, setHecha] = useState<null | "aprobada" | "cambios">(null);
  const hoy = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD en hora local
  const yaSalio = !!i.pieza?.sale && i.pieza.sale < hoy;

  function correr(fn: () => Promise<{ error?: string } | { ok: true }>, ok: "aprobada" | "cambios") {
    start(async () => {
      const r = await fn();
      if ("error" in r && r.error) return void toast.error(r.error);
      setHecha(ok);
      setCambios(false);
      toast.success(ok === "aprobada" ? "Aprobada" : "Cambios pedidos");
      router.refresh();
    });
  }

  return (
    <li className={cn("px-4 py-2 text-sm", hecha && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
          {i.ticket ?? "—"}
        </span>
        <Link href={`/tareas/${i.id}`} className="min-w-0 flex-1 truncate hover:underline">
          {i.titulo}
          {i.cliente && !i.titulo.includes(i.cliente) && (
            <span className="text-muted-foreground"> · {i.cliente}</span>
          )}
        </Link>
        <span className="truncate text-xs text-muted-foreground">{i.persona ?? "—"}</span>
        {i.pieza?.sale ? (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              yaSalio ? "font-medium text-red-600" : "text-muted-foreground"
            )}
            title={yaSalio ? "La fecha de publicación ya pasó" : undefined}
          >
            {yaSalio ? `debía salir el ${fechaCorta(i.pieza.sale)}` : `sale el ${fechaCorta(i.pieza.sale)}`}
          </span>
        ) : (
          i.reloj && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-xs",
                i.reloj.vencida ? "font-medium text-red-600" : "text-amber-700"
              )}
            >
              <Clock className="h-3 w-3" />
              {i.reloj.texto}
            </span>
          )
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-16">
        {i.pieza?.archivo ? (
          <a
            href={i.pieza.archivo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs hover:bg-accent"
          >
            <ExternalLink className="h-3 w-3" /> Ver archivo
          </a>
        ) : i.pieza && !i.pieza.tieneArchivo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">Falta el archivo: no se puede aprobar todavía</span>
        ) : null}
        {hecha ? (
          <span className="text-xs font-medium">
            {hecha === "aprobada" ? "✅ Aprobada" : "✏️ Cambios pedidos"}
          </span>
        ) : (
          puedeDecidir && (
            <>
              {/* Sin archivo no se aprueba: se le pide a quien la tiene, de un toque (18/10/2026). */}
              {i.pieza && !i.pieza.tieneArchivo && (
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  disabled={pending || pedido}
                  onClick={() =>
                    start(async () => {
                      const r = await pedirArchivo(i.id);
                      if ("error" in r && r.error) return void toast.error(r.error);
                      setPedido(true);
                      toast.success(r && "yaAvisado" in r && r.yaAvisado ? "Ya se lo habías pedido hoy" : `Listo, le avisamos a ${i.persona?.split(" ")[0] ?? "quien la tiene"}`);
                    })
                  }
                >
                  {pedido ? "✓ Pedido" : `📎 Pedirle el archivo${i.persona ? ` a ${i.persona.split(" ")[0]}` : ""}`}
                </Button>
              )}
              {!(i.pieza && !i.pieza.tieneArchivo) && (
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={pending}
                onClick={() => correr(() => aprobarTarea(i.id), "aprobada")}
              >
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Aprobar
              </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                disabled={pending}
                onClick={() => setCambios((v) => !v)}
              >
                <Pencil className="h-3 w-3" /> Pedir cambios
              </Button>
            </>
          )
        )}
      </div>
      {cambios && !hecha && (
        <div className="mt-2 space-y-1.5 pl-16">
          <Textarea
            rows={2}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Qué hay que corregir (así se hace una sola vuelta)"
            autoFocus
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={pending || detalle.trim().length < 10}
            onClick={() => correr(() => pedirCambios(i.id, detalle), "cambios")}
          >
            Mandar cambios
          </Button>
        </div>
      )}
    </li>
  );
}
