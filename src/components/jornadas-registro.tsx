"use client";

/**
 * El registro de jornadas de producción (23/10/2026). Luz carga y confirma;
 * el dueño marca lo cobrado y lo pagado. Ver lib/jornadas/registro.ts.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock, History, Loader2, MapPin, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtARS } from "@/lib/finanzas";
import { cn } from "@/lib/utils";
import { hoyYmd } from "@/lib/dates";
import { JORNADA_PRECIO_HORA, JORNADA_PRECIO_HORA_EXTRA, precioJornada } from "@/lib/jornada";
import { ESTADO_JORNADA, estadoJornada, repartoJornada, resumenJornadas, type EstadoJornada } from "@/lib/jornadas/registro";
import type { JornadaFila } from "@/lib/jornadas/cargar";
import {
  borrarJornada,
  confirmarJornada,
  guardarJornada,
  marcarCobrado,
  marcarPagado,
  type JornadaForm,
} from "@/app/(app)/jornadas/actions";

interface Persona {
  id: string;
  nombre: string;
}
interface Cliente {
  id: string;
  nombre: string;
}

const TONO: Record<EstadoJornada, string> = {
  agendada: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  completar: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  cobrar: "bg-red-500/15 text-red-700 dark:text-red-300",
  pagar: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  cerrada: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};

const primerNombre = (n: string) => n.split(" ")[0];
function fechaLarga(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function duracion(h: number) {
  const extra = Math.max(0, h - 1);
  return extra ? `${h} h (1 + ${extra} extra)` : `${h} h`;
}

export function JornadasRegistro({
  jornadas,
  equipo,
  clientes,
  esDueno,
  filtroInicial = "todas",
}: {
  jornadas: JornadaFila[];
  equipo: Persona[];
  clientes: Cliente[];
  esDueno: boolean;
  filtroInicial?: EstadoJornada | "todas";
}) {
  const hoy = hoyYmd();
  const [filtro, setFiltro] = useState<EstadoJornada | "todas">(filtroInicial);
  const [editando, setEditando] = useState<JornadaFila | "nueva" | null>(null);
  const nombre = useMemo(() => new Map(equipo.map((p) => [p.id, p.nombre])), [equipo]);
  const res = resumenJornadas(jornadas, hoy);
  const conEstado = jornadas.map((j) => ({ j, e: estadoJornada(j, hoy) }));
  const cuenta = (e: EstadoJornada) => conEstado.filter((x) => x.e === e).length;
  const visibles = conEstado.filter((x) => filtro === "todas" || x.e === filtro);

  return (
    <div className="space-y-5 pb-12">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tarjeta emoji="✍️" titulo="Falta completar" valor={String(res.completar)} detalle="Ya se hicieron: confirmar duración y viáticos." onClick={() => setFiltro("completar")} />
        <Tarjeta emoji="💰" titulo="Falta cobrar" valor={fmtARS(res.faltaCobrar)} detalle={`${cuenta("cobrar")} jornada${cuenta("cobrar") === 1 ? "" : "s"}`} onClick={() => setFiltro("cobrar")} />
        <Tarjeta
          emoji="🤝"
          titulo="Falta pagar"
          valor={fmtARS(res.faltaPagar)}
          detalle={
            [...res.debePorPersona.entries()].map(([id, m]) => `${primerNombre(nombre.get(id) ?? "—")} ${fmtARS(m)}`).join(" · ") || "Nadie espera un pago"
          }
          onClick={() => setFiltro("pagar")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["todas", "completar", "cobrar", "pagar", "agendada", "cerrada"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", filtro === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {f === "todas" ? `Todas · ${jornadas.length}` : `${ESTADO_JORNADA[f].emoji} ${ESTADO_JORNADA[f].label} · ${cuenta(f)}`}
          </button>
        ))}
        <Button size="sm" className="ml-auto gap-1.5" onClick={() => setEditando("nueva")}>
          <Plus className="h-4 w-4" /> Nueva jornada
        </Button>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No hay jornadas acá.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibles.map(({ j, e }) => (
            <JornadaCard key={j.id} j={j} estado={e} nombre={nombre} esDueno={esDueno} onEditar={() => setEditando(j)} />
          ))}
        </div>
      )}

      {editando && (
        <JornadaDialog
          jornada={editando === "nueva" ? null : editando}
          equipo={equipo}
          clientes={clientes}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function Tarjeta({ emoji, titulo, valor, detalle, onClick }: { emoji: string; titulo: string; valor: string; detalle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-2xl border bg-card p-3 text-left transition hover:border-primary sm:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground sm:gap-2 sm:text-xs">
        <span className="text-base sm:text-lg" aria-hidden="true">{emoji}</span>
        <span className="truncate">{titulo}</span>
      </div>
      <div className="mt-1 truncate text-base font-bold tabular-nums sm:text-2xl">{valor}</div>
      <div className="mt-0.5 hidden line-clamp-2 text-xs text-muted-foreground sm:block">{detalle}</div>
    </button>
  );
}

function JornadaCard({
  j,
  estado,
  nombre,
  esDueno,
  onEditar,
}: {
  j: JornadaFila;
  estado: EstadoJornada;
  nombre: Map<string, string>;
  esDueno: boolean;
  onEditar: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const r = repartoJornada(j);
  const [cobro, setCobro] = useState(String(r.faltaCobrar || r.aCobrar));
  const [verHistorial, setVerHistorial] = useState(false);
  const correr = (fn: () => Promise<{ ok?: true; error?: string } | undefined>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div id={`j-${j.id}`} className="scroll-mt-24 flex flex-col rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="font-semibold">{j.cliente ?? "Sin cliente"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {fechaLarga(j.fecha)}
              {j.horaInicio ? ` · ${j.horaInicio} h` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {duracion(j.horas)}
            </span>
            {j.lugar && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {j.lugar}
              </span>
            )}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", TONO[estado])}>
          {ESTADO_JORNADA[estado].emoji} {ESTADO_JORNADA[estado].label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 text-center">
        <Monto titulo="Trabajo" valor={j.monto} />
        <Monto titulo={`Viáticos · ${j.viaticosLosPaga === "cliente" ? "cliente" : "agencia"}`} valor={j.viaticos} />
        <Monto titulo="A cobrar" valor={r.aCobrar} fuerte />
      </div>

      <div className="space-y-1.5 px-4 py-3">
        {r.partes.map((p) => {
          const pagado = p.debe <= 0;
          return (
            <div key={p.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="min-w-[7rem] font-medium">
                {primerNombre(nombre.get(p.userId) ?? "—")} <span className="text-xs font-normal text-muted-foreground">{p.rol}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtARS(p.trabajo)}
                {p.viaticos > 0 && ` + ${fmtARS(p.viaticos)} viát.`}
              </span>
              <span className="ml-auto font-semibold tabular-nums">{fmtARS(p.total)}</span>
              {pagado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                  <Check className="h-3 w-3" /> Pagado
                  {esDueno && (
                    <button type="button" title="Desmarcar" disabled={pending} onClick={() => correr(() => marcarPagado(j.id, p.userId, null), "Desmarcado.")}>
                      <Undo2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ) : esDueno && j.confirmadaAt ? (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending} onClick={() => correr(() => marcarPagado(j.id, p.userId, p.total), `Pago a ${primerNombre(nombre.get(p.userId) ?? "")} registrado.`)}>
                  Pagué {fmtARS(p.debe)}
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">{p.pagado > 0 ? `debe ${fmtARS(p.debe)}` : "sin pagar"}</span>
              )}
            </div>
          );
        })}
      </div>

      {j.confirmadaAt && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-sm">
          {j.cobrado != null ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" /> Cobrado {fmtARS(j.cobrado)}
              {j.cobradoAt && <span className="text-xs text-muted-foreground">el {new Date(`${j.cobradoAt}T12:00:00`).toLocaleDateString("es-AR")}</span>}
              {r.faltaCobrar > 0 && <span className="text-xs text-red-600 dark:text-red-400">· faltan {fmtARS(r.faltaCobrar)}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Sin cobrar</span>
          )}
          {esDueno && (
            <span className="ml-auto flex items-center gap-1.5">
              {r.faltaCobrar > 0 && (
                <>
                  <Input className="h-8 w-28 text-right tabular-nums" inputMode="numeric" value={cobro} onChange={(e) => setCobro(e.target.value.replace(/\D/g, ""))} aria-label="Monto cobrado" />
                  <Button size="sm" className="h-8" disabled={pending} onClick={() => correr(() => marcarCobrado(j.id, Number(j.cobrado ?? 0) + Number(cobro)), "Cobro registrado.")}>
                    Cobré
                  </Button>
                </>
              )}
              {j.cobrado != null && (
                <Button size="sm" variant="ghost" className="h-8 px-2" title="Desmarcar el cobro" disabled={pending} onClick={() => correr(() => marcarCobrado(j.id, null), "Cobro desmarcado.")}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              )}
            </span>
          )}
        </div>
      )}

      {j.notas && j.notas !== "Agendada en la Agenda" && <p className="border-t px-4 py-2 text-xs italic text-muted-foreground">{j.notas}</p>}

      {verHistorial && (
        <ol className="space-y-2 border-t bg-muted/30 px-4 py-3">
          {j.historial.map((c, i) => (
            <li key={i} className="text-xs">
              <div>
                <span className="font-medium">{c.quien}</span> · {c.accion}
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(c.cuando).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Cordoba" })}
                </span>
              </div>
              {c.detalle.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 pl-3 text-muted-foreground">
                  {c.detalle.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEditar} disabled={pending}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        {estado === "completar" && (
          <Button size="sm" className="gap-1.5" disabled={pending} onClick={() => correr(() => confirmarJornada(j.id), "Confirmada: le avisamos a dirección.")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar datos reales
          </Button>
        )}
        {j.agendada && <span className="text-[11px] text-muted-foreground">📅 En la Agenda</span>}
        {j.historial.length > 0 && (
          <button
            type="button"
            onClick={() => setVerHistorial((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            aria-expanded={verHistorial}
          >
            <History className="h-3.5 w-3.5" /> Historial · {j.historial.length}
          </button>
        )}
        {esDueno && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto gap-1.5 text-muted-foreground hover:text-red-600"
            disabled={pending}
            onClick={() => confirm("¿Borrar esta jornada? También sale de la Agenda y de los sueldos.") && correr(() => borrarJornada(j.id), "Jornada borrada.")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Monto({ titulo, valor, fuerte }: { titulo: string; valor: number; fuerte?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn("tabular-nums", fuerte ? "text-base font-bold" : "text-sm font-medium")}>{fmtARS(valor)}</div>
    </div>
  );
}

function JornadaDialog({ jornada, equipo, clientes, onClose }: { jornada: JornadaFila | null; equipo: Persona[]; clientes: Cliente[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fecha, setFecha] = useState(jornada?.fecha ?? hoyYmd());
  const [hora, setHora] = useState(jornada?.horaInicio ?? "10:00");
  const [horas, setHoras] = useState(jornada?.horas ?? 1);
  const [clienteId, setClienteId] = useState(jornada?.clienteId ?? "");
  const [lugar, setLugar] = useState(jornada?.lugar ?? "");
  const [notas, setNotas] = useState(jornada?.notas && jornada.notas !== "Agendada en la Agenda" ? jornada.notas : "");
  const [dirige, setDirige] = useState(jornada?.asistentes[0] ?? "");
  const [acompana, setAcompana] = useState(jornada?.asistentes[1] ?? "");
  const [losPaga, setLosPaga] = useState<"cliente" | "agencia">(jornada?.viaticosLosPaga ?? "cliente");
  const inicialViaticos = () => {
    if (!jornada) return {};
    if (Object.keys(jornada.viaticosDetalle).length) return { ...jornada.viaticosDetalle };
    const n = Math.max(1, Math.min(2, jornada.asistentes.length));
    return Object.fromEntries(jornada.asistentes.map((id) => [id, Math.round(jornada.viaticos / n)]));
  };
  const [viaticos, setViaticos] = useState<Record<string, number>>(inicialViaticos);
  const asistentes = [dirige, acompana].filter(Boolean);
  const precio = precioJornada(horas);
  const totalViaticos = asistentes.reduce((n, id) => n + (viaticos[id] ?? 0), 0);
  const extras = Math.max(0, horas - 1);

  function guardar() {
    if (!dirige) return void toast.error("Elegí quién dirige la jornada.");
    const form: JornadaForm = {
      fecha,
      horaInicio: hora || null,
      horas,
      clienteId: clienteId || null,
      lugar: lugar || null,
      notas: notas || null,
      asistentes,
      viaticosDetalle: viaticos,
      viaticosLosPaga: losPaga,
    };
    start(async () => {
      const r = await guardarJornada(jornada?.id ?? null, form);
      if (r && "error" in r && r.error) return void toast.error(r.error);
      toast.success(jornada ? "Jornada actualizada." : "Jornada cargada.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{jornada ? "Editar jornada" : "Nueva jornada de producción"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div>
              <Label>Duración (horas)</Label>
              <Input type="number" step="0.5" min="0.5" value={horas || ""} onChange={(e) => setHoras(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lugar</Label>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Córdoba capital" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quién dirige</Label>
              <Select value={dirige} onValueChange={setDirige}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {equipo.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Acompaña</Label>
              <Select value={acompana || "__no__"} onValueChange={(v) => setAcompana(v === "__no__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__no__">Nadie</SelectItem>
                  {equipo
                    .filter((p) => p.id !== dirige)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {asistentes.length > 0 && (
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">🚗 Viáticos de cada uno</span>
                <Select value={losPaga} onValueChange={(v) => setLosPaga(v as "cliente" | "agencia")}>
                  <SelectTrigger className="h-8 w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Los paga el cliente</SelectItem>
                    <SelectItem value="agencia">Los paga la agencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {asistentes.map((id) => (
                  <div key={id}>
                    <Label className="text-xs">{equipo.find((p) => p.id === id)?.nombre.split(" ")[0]}</Label>
                    <Input
                      inputMode="numeric"
                      value={viaticos[id] ? String(viaticos[id]) : ""}
                      placeholder="$0"
                      onChange={(e) => setViaticos((v) => ({ ...v, [id]: Number(e.target.value.replace(/\D/g, "")) || 0 }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span>1ª hora</span>
              <span className="tabular-nums">{fmtARS(JORNADA_PRECIO_HORA)}</span>
            </div>
            {extras > 0 && (
              <div className="flex justify-between">
                <span>
                  {extras} hora{extras === 1 ? "" : "s"} extra × {fmtARS(JORNADA_PRECIO_HORA_EXTRA)}
                </span>
                <span className="tabular-nums">{fmtARS(extras * JORNADA_PRECIO_HORA_EXTRA)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Viáticos {losPaga === "cliente" ? "(se le cobran)" : "(los pone la agencia)"}</span>
              <span className="tabular-nums">{fmtARS(totalViaticos)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
              <span>Total a cobrar</span>
              <span className="tabular-nums">{fmtARS(precio + (losPaga === "cliente" ? totalViaticos : 0))}</span>
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué se grabó, algo a tener en cuenta" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={guardar} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {jornada ? "Guardar" : "Cargar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
