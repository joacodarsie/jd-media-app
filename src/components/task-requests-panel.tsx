"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/dates";
import { resolverPedido } from "@/app/(app)/tareas/pedidos-actions";

export interface PedidoFila {
  id: string;
  motivo: string;
  motivoLabel: string;
  sugerencia: string;
  detalle: string | null;
  creadoEl: string;
  taskId: string;
  quien: string;
  tarea: string;
  area: string | null;
  cuenta: string | null;
}

/**
 * Los pedidos abiertos del equipo, arriba de Tareas y solo para coordinación.
 *
 * Cada uno se resuelve en el mismo lugar: se elige qué hacer con la tarea
 * (reasignarla, archivarla, correr la fecha) y se aplica en el mismo clic. Si
 * hubiera que aprobar acá y después ir a arreglar la tarea a otra pantalla, no
 * lo haría nadie.
 */
export function TaskRequestsPanel({
  pedidos,
  usuarios,
}: {
  pedidos: PedidoFila[];
  usuarios: { id: string; nombre: string }[];
}) {
  if (pedidos.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
        <AlertCircle className="h-4 w-4" />
        El equipo reportó {pedidos.length} problema{pedidos.length === 1 ? "" : "s"}
      </h2>
      <div className="mt-2 space-y-2">
        {pedidos.map((p) => (
          <Pedido key={p.id} p={p} usuarios={usuarios} />
        ))}
      </div>
    </div>
  );
}

function Pedido({ p, usuarios }: { p: PedidoFila; usuarios: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [accion, setAccion] = useState<"nada" | "reasignar" | "archivar" | "correr_fecha">(
    p.motivo === "no_me_corresponde" ? "reasignar" : p.motivo === "no_llego" || p.motivo === "falta_material" ? "correr_fecha" : "nada",
  );
  const [quienNuevo, setQuienNuevo] = useState("");
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");

  async function resolver(aprobada: boolean) {
    if (aprobada && accion === "reasignar" && !quienNuevo) {
      toast.error("Elegí a quién se la pasás.");
      return;
    }
    if (aprobada && accion === "correr_fecha" && !fecha) {
      toast.error("Poné la fecha nueva.");
      return;
    }
    setOcupado(true);
    const r = await resolverPedido(p.id, aprobada, {
      nota,
      accion: aprobada ? accion : "nada",
      nuevoAsignadoId: quienNuevo || null,
      nuevaFecha: fecha || null,
    });
    setOcupado(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(aprobada ? "Resuelto y avisado." : "Marcado como que queda igual.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-lg border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {p.motivoLabel}
          </span>{" "}
          {p.tarea}
        </p>
        <Link
          href={`/tareas/${p.taskId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          ver la tarea <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Lo reportó {p.quien} · {fmtDate(p.creadoEl, "dd/MM HH:mm")}
        {p.cuenta && ` · ${p.cuenta}`}
        {p.area && ` · ${p.area}`}
      </p>
      {p.detalle && <p className="mt-1.5 rounded-md bg-muted/50 p-2 text-[13px]">{p.detalle}</p>}
      <p className="mt-1.5 text-xs text-muted-foreground">Sugerido: {p.sugerencia}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={accion}
          onChange={(e) => setAccion(e.target.value as typeof accion)}
          className="h-8 rounded-md border bg-background px-2 text-xs [color-scheme:light] dark:[color-scheme:dark]"
        >
          <option value="nada">Solo responder</option>
          <option value="reasignar">Pasársela a…</option>
          <option value="correr_fecha">Correr la fecha</option>
          <option value="archivar">Archivar la tarea</option>
        </select>

        {accion === "reasignar" && (
          <select
            value={quienNuevo}
            onChange={(e) => setQuienNuevo(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          >
            <option value="">Elegir persona…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        )}

        {accion === "correr_fecha" && (
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        )}

        <Input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Respuesta para quien lo reportó (opcional)"
          className="h-8 min-w-[200px] flex-1 text-xs"
        />

        <Button size="sm" disabled={ocupado} onClick={() => resolver(true)}>
          {ocupado ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
          Resolver
        </Button>
        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => resolver(false)}>
          <X className="mr-1 h-3.5 w-3.5" /> Queda igual
        </Button>
      </div>
    </div>
  );
}
