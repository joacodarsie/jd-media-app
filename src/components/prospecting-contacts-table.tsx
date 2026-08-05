"use client";

import { hoyYmd } from "@/lib/dates";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Download,
  Trash2,
  MessageCircle,
  Search,
  AtSign,
  Globe,
  Copy,
  Check,
  Zap,
  SkipForward,
  PhoneOff,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTACTO_ESTADOS,
  PROSPECTING_FUENTES,
  contactoEstadoMeta,
  intlWhatsappLink,
  waDigits,
  instagramUrl,
  ensureHttp,
  diasDesde,
  personalizarMensaje,
  esProbableFijoAr,
} from "@/lib/prospecting/shared";
import {
  updateContact,
  deleteContact,
  bulkSetContactoEstado,
  bulkSetContactable,
  bulkDeleteContacts,
  type ContactPatch,
} from "@/app/(app)/prospeccion/actions";

export interface ContactRow {
  id: string;
  empresa: string;
  contacto_nombre: string | null;
  contacto_rol: string | null;
  telefono: string | null;
  instagram: string | null;
  sitio_web: string | null;
  estado: string;
  asignado_a: string | null;
  notas: string | null;
  contactado_at: string | null;
  /** null = sin intentar · true = el dato sirve · false = no se pudo contactar. */
  contactable: boolean | null;
  created_at: string;
}

const NADIE = "__nadie__";

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "sin", label: "Sin contactar" },
  { value: "contactado", label: "Contactados" },
  { value: "interesado", label: "Interesados" },
  { value: "reunion", label: "Con reunión" },
  { value: "descartado", label: "Descartados" },
] as const;

export function ProspectingContactsTable({
  campaignId,
  campaignNombre,
  initialContacts,
  equipo,
  canUseAi,
  canUsePlaces = false,
  currentUserId,
  primerMensaje,
  mensajeLabel,
}: {
  campaignId: string;
  campaignNombre: string;
  initialContacts: ContactRow[];
  /** `comercial: true` = va arriba en el selector "quién contacta". */
  equipo: { id: string; nombre: string; comercial: boolean }[];
  /** Solo el director puede usar "Sacar contactos" (IA, consume tokens). */
  canUseAi: boolean;
  /** Google Places no gasta tokens: lo usa todo el equipo comercial. */
  canUsePlaces?: boolean;
  /** Para el filtro "solo míos". */
  currentUserId: string;
  /** Mensaje ELEGIDO de la campaña: se precarga en el WhatsApp de cada fila. */
  primerMensaje?: string | null;
  /** Nombre del bloque elegido ("Alternativa (otro ángulo)"), para mostrarlo. */
  mensajeLabel?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ContactRow[]>(initialContacts);
  const [loading, setLoading] = useState(false);
  // 50 por defecto: es la tanda con la que se trabaja un día entero.
  const [cantidad, setCantidad] = useState("50");
  // Sin permiso de IA, la única fuente disponible es Places (0 tokens).
  const [fuente, setFuente] = useState(canUseAi ? "mix" : "places");
  const [filtro, setFiltro] = useState<string>("todos");
  const [soloMios, setSoloMios] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const lastClicked = useRef<string | null>(null);
  // Modo despacho: recorrer los pendientes uno por uno sin volver a la tabla.
  const [despacho, setDespacho] = useState(false);
  const [saltados, setSaltados] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  // Última versión persistida de cada fila, para saber si un campo cambió al blur.
  const persisted = useRef(new Map(initialContacts.map((c) => [c.id, { ...c }])));

  // Cuando el server manda datos nuevos (tras "Sacar contactos" o refresh),
  // re-sembramos la tabla.
  useEffect(() => {
    setRows(initialContacts);
    persisted.current = new Map(initialContacts.map((c) => [c.id, { ...c }]));
    setSel(new Set());
    lastClicked.current = null;
  }, [initialContacts]);

  const nombreDe = (id: string | null) =>
    id ? equipo.find((u) => u.id === id)?.nombre ?? "—" : "";

  // En "quién contacta" arriba van los comerciales (los que prospectan de
  // verdad); el resto del equipo queda agrupado abajo para no ensuciar la lista.
  const comerciales = equipo.filter((u) => u.comercial);
  const otros = equipo.filter((u) => !u.comercial);

  /**
   * Arma el mensaje de la campaña ya personalizado para ESTA fila: reemplaza
   * [EMPRESA] y [NOMBRE] con los datos del contacto. Si no hay persona, saca el
   * saludo con nombre para que no quede "Hola [NOMBRE]". Es lo que evita tener
   * que copiar, pegar y editar uno por uno.
   */
  function mensajeDe(r: ContactRow): string {
    if (!primerMensaje) return "";
    return personalizarMensaje(primerMensaje, {
      empresa: r.empresa,
      contacto: r.contacto_nombre,
    });
  }

  function setField(id: string, field: keyof ContactRow, value: string | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  /** Igual que setField pero para el flag booleano `contactable`. */
  function setField2(id: string, field: "contactable", value: boolean | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function persistContactable(id: string, value: boolean | null) {
    startTransition(async () => {
      const res = await updateContact(id, { contactable: value });
      if ("error" in res) {
        toast.error(res.error);
        router.refresh();
      }
    });
  }

  /** Persiste un campo si cambió respecto de lo último guardado. */
  function persist(id: string, field: keyof ContactPatch, value: string | null) {
    const prev = persisted.current.get(id);
    if (prev && (prev as Record<string, unknown>)[field] === value) return;
    startTransition(async () => {
      const res = await updateContact(id, { [field]: value } as ContactPatch);
      if ("error" in res) {
        toast.error(res.error);
        // Revertir en pantalla al valor previo.
        if (prev) setField(id, field as keyof ContactRow, (prev as Record<string, string | null>)[field] ?? null);
        return;
      }
      const snap = persisted.current.get(id);
      if (snap) (snap as Record<string, unknown>)[field] = value;
    });
  }

  async function sacarContactos() {
    setLoading(true);
    const t = toast.loading("Sacando contactos… según la cantidad puede tardar de 20 seg a 2 min.");
    try {
      const res = await fetch(`/api/prospeccion/${campaignId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: Number(cantidad), fuente }),
      });
      const data = (await res.json()) as {
        created?: number;
        skipped?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo completar.", { id: t });
        return;
      }
      if ((data.created ?? 0) === 0) {
        toast.info(data.message ?? "No se sumaron contactos nuevos.", { id: t });
      } else {
        const dup = data.skipped ? ` (${data.skipped} ya estaban)` : "";
        toast.success(`Se sumaron ${data.created} contactos${dup}.`, { id: t });
      }
      router.refresh();
    } catch {
      toast.error("Error de red. Probá de nuevo.", { id: t });
    } finally {
      setLoading(false);
    }
  }

  function borrar(id: string) {
    if (!confirm("¿Borrar este contacto de la lista?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    persisted.current.delete(id);
    startTransition(async () => {
      const res = await deleteContact(id);
      if ("error" in res) {
        toast.error(res.error);
        router.refresh();
      }
    });
  }

  function exportarCSV() {
    if (rows.length === 0) return void toast.info("No hay contactos para exportar.");
    const headers = ["Empresa", "Contacto", "Rol", "Teléfono", "Instagram", "Sitio / fuente", "Estado", "Quién contacta", "Notas"];
    const estadoLabel = (v: string) =>
      CONTACTO_ESTADOS.find((e) => e.value === v)?.label ?? v;
    const esc = (v: string | null) => {
      const s = (v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [headers.map((h) => `"${h}"`).join(",")];
    for (const r of rows) {
      lines.push(
        [
          esc(r.empresa),
          esc(r.contacto_nombre),
          esc(r.contacto_rol),
          esc(r.telefono),
          esc(instagramUrl(r.instagram)),
          esc(ensureHttp(r.sitio_web)),
          esc(estadoLabel(r.estado)),
          esc(nombreDe(r.asignado_a) || ""),
          esc(r.notas),
        ].join(",")
      );
    }
    // BOM para que Excel abra los acentos bien.
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = campaignNombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `contactos-${slug || "campana"}-${hoyYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const contactados = rows.filter((r) => r.estado !== "nuevo").length;

  // Resumen de seguimiento del pie de tabla.
  const resumen = {
    total: rows.length,
    sinContactar: rows.filter((r) => r.estado === "nuevo").length,
    contactados,
    interesados: rows.filter((r) => r.estado === "interesado").length,
    reuniones: rows.filter((r) => r.estado === "reunion").length,
    // Fijos sin otra vía: son los que parecen contactables y no lo son.
    fijos: rows.filter((r) => esProbableFijoAr(r.telefono)).length,
    descartados: rows.filter((r) => r.estado === "descartado").length,
    noSePudo: rows.filter((r) => r.contactable === false).length,
    mios: rows.filter((r) => r.asignado_a === currentUserId).length,
    // Contactados hace 3+ días sin pasar a interesado: hay que insistir.
    paraSeguir: rows.filter(
      (r) => r.estado === "contactado" && (diasDesde(r.contactado_at) ?? 0) >= 3
    ).length,
  };
  // Efectividad sobre los que SÍ se pudieron contactar (los datos malos no
  // cuentan como fracaso comercial).
  const alcanzados = resumen.contactados - resumen.noSePudo;
  // Una reunión agendada es interés confirmado: cuenta en la tasa.
  const tasaInteres =
    alcanzados > 0
      ? Math.round(((resumen.interesados + resumen.reuniones) / alcanzados) * 100)
      : null;

  const visibleRows = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((r) => {
      if (soloMios && r.asignado_a !== currentUserId) return false;
      if (filtro === "sin" && r.estado !== "nuevo") return false;
      if (
        (filtro === "contactado" ||
          filtro === "interesado" ||
          filtro === "reunion" ||
          filtro === "descartado") &&
        r.estado !== filtro
      )
        return false;
      if (q) {
        const hay = `${r.empresa} ${r.contacto_nombre ?? ""} ${r.telefono ?? ""} ${r.notas ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, busqueda, soloMios, filtro, currentUserId]);

  const visibleIds = visibleRows.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));

  function clearSel() {
    setSel(new Set());
    lastClicked.current = null;
  }

  function toggleOne(id: string, shift: boolean) {
    setSel((prev) => {
      const next = new Set(prev);
      // Shift+click: marca todo el rango entre el último clickeado y este.
      if (shift && lastClicked.current) {
        const a = visibleIds.indexOf(lastClicked.current);
        const b = visibleIds.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(visibleIds[i]);
          lastClicked.current = id;
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastClicked.current = id;
      return next;
    });
  }

  function toggleAll() {
    setSel((prev) => {
      if (visibleIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  function bulkEstado(estado: string) {
    const ids = [...sel];
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) =>
        sel.has(r.id)
          ? {
              ...r,
              estado,
              contactado_at:
                estado === "nuevo" ? null : r.contactado_at ?? now,
            }
          : r
      )
    );
    // Sincronizamos el snapshot persistido para que el blur no “revierta”.
    for (const id of ids) {
      const snap = persisted.current.get(id);
      if (snap) snap.estado = estado;
    }
    startTransition(async () => {
      const res = await bulkSetContactoEstado(ids, estado);
      if ("error" in res) {
        toast.error(res.error);
        router.refresh();
      }
    });
    clearSel();
  }

  // ── Modo despacho ──────────────────────────────────────────────────────────
  // Cola: pendientes con teléfono cuyo dato no está marcado como malo. Los que
  // parecen FIJO van al final: casi nunca tienen WhatsApp, así que primero se
  // despacha lo que sí va a llegar.
  const cola = rows
    .filter(
      (r) =>
        r.estado === "nuevo" && r.contactable !== false && r.telefono && !saltados.has(r.id)
    )
    .sort((a, b) => Number(esProbableFijoAr(a.telefono)) - Number(esProbableFijoAr(b.telefono)));
  const actual = cola[0] ?? null;

  /** Marca en pantalla + servidor y la cola avanza sola (la fila sale de `cola`). */
  function despachar(r: ContactRow, como: "contactado" | "no_se_pudo") {
    if (como === "contactado") {
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? {
                ...x,
                estado: "contactado",
                contactable: true,
                contactado_at: new Date().toISOString(),
                asignado_a: x.asignado_a ?? currentUserId,
              }
            : x
        )
      );
      const snap = persisted.current.get(r.id);
      if (snap) snap.estado = "contactado";
      startTransition(async () => {
        const res = await updateContact(r.id, { estado: "contactado", contactable: true });
        if ("error" in res && res.error) {
          toast.error(res.error);
          router.refresh();
        }
      });
    } else {
      setRows((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, contactable: false } : x))
      );
      startTransition(async () => {
        const res = await updateContact(r.id, { contactable: false });
        if ("error" in res && res.error) {
          toast.error(res.error);
          router.refresh();
        }
      });
    }
  }

  function bulkContactable(valor: boolean) {
    const ids = [...sel];
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) => (sel.has(r.id) ? { ...r, contactable: valor } : r))
    );
    startTransition(async () => {
      const res = await bulkSetContactable(ids, valor);
      if ("error" in res && res.error) {
        toast.error(res.error);
        router.refresh();
      }
    });
    clearSel();
  }

  function bulkBorrar() {
    const ids = [...sel];
    if (ids.length === 0) return;
    if (!confirm(`¿Borrar ${ids.length} contacto${ids.length === 1 ? "" : "s"}?`)) return;
    setRows((prev) => prev.filter((r) => !sel.has(r.id)));
    for (const id of ids) persisted.current.delete(id);
    startTransition(async () => {
      const res = await bulkDeleteContacts(ids);
      if ("error" in res) {
        toast.error(res.error);
        router.refresh();
      }
    });
    clearSel();
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(canUseAi || canUsePlaces) && (
            <>
              <Select value={cantidad} onValueChange={setCantidad} disabled={loading}>
                <SelectTrigger className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["15", "25", "40", "50"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fuente} onValueChange={setFuente} disabled={loading}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Sin el permiso de IA solo se ofrece Places: no gasta tokens. */}
                  {(canUseAi
                    ? PROSPECTING_FUENTES
                    : PROSPECTING_FUENTES.filter((f) => f.value === "places")
                  ).map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={sacarContactos} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Sacar contactos
              </Button>
            </>
          )}
          {cola.length > 0 && (
            <Button
              onClick={() => setDespacho(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Zap className="mr-2 h-4 w-4" /> Despachar ({cola.length})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {rows.length} contactos · {contactados} trabajados
          </span>
          <Button variant="outline" onClick={exportarCSV}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel/CSV
          </Button>
        </div>
      </div>

      {canUseAi && (
        <p className="-mt-1 text-xs text-muted-foreground">
          {PROSPECTING_FUENTES.find((f) => f.value === fuente)?.hint}
        </p>
      )}
      {primerMensaje ? (
        <p className="text-xs text-muted-foreground">
          💬 Se está usando{" "}
          <b>{mensajeLabel ? `“${mensajeLabel}”` : "el mensaje de la campaña"}</b>, ya
          personalizado con el nombre de la empresa: es el que se copia y el que abre
          el WhatsApp de cada fila.{" "}
          <Link href={`/prospeccion/${campaignId}`} className="underline hover:text-foreground">
            Cambiar o editar
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Generá los <b>Mensajes de la campaña</b> (en la pantalla de la campaña) y el
          botón de WhatsApp va a abrir el chat con el texto ya escrito.
        </p>
      )}

      {/* Filtros */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  filtro === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSoloMios((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              soloMios ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            Solo míos
          </button>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar empresa, persona, teléfono…"
              className="h-8 w-56 pl-7 text-xs"
            />
          </div>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-sm">
          <span className="px-1 text-sm font-medium">{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Marcar como:</span>
          {CONTACTO_ESTADOS.map((e) => (
            <button
              key={e.value}
              onClick={() => bulkEstado(e.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.badge}`}
            >
              {e.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">· ¿Se pudo?</span>
          <button
            onClick={() => bulkContactable(true)}
            className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Sí
          </button>
          <button
            onClick={() => bulkContactable(false)}
            className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-800 dark:bg-rose-950 dark:text-rose-300"
          >
            No (dato malo)
          </button>
          <button
            onClick={bulkBorrar}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" /> Borrar
          </button>
          <button
            onClick={clearSel}
            className="ml-auto rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="font-medium">Sin contactos todavía</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Tocá <b>Sacar contactos</b> y la IA arma una lista de empresas del
            cluster con su teléfono y (si está público) la persona a contactar. O
            agregá una fila a mano.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          {/* table-fixed es lo que hace que el <colgroup> mande: sin esto el
              navegador reparte parejo e igual trunca teléfonos y nombres. */}
          <table className="w-full min-w-[1150px] table-fixed text-sm">
            {/* Anchos fijos (table-fixed): la suma entra en una pantalla de
                ~1250px de contenido SIN scroll horizontal — el user tenía que
                arrastrar la barrita para ver Notas. Contacto y Rol van fusionados
                en una columna (casi siempre vienen vacíos). */}
            <colgroup>
              <col className="w-9" />
              <col className="w-[190px]" />
              <col className="w-[135px]" />
              <col className="w-[165px]" />
              <col className="w-[110px]" />
              <col className="w-[70px]" />
              <col className="w-[80px]" />
              <col className="w-[140px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-9" />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-9 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title="Seleccionar todos"
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
                <Th>Empresa</Th>
                <Th>Contacto / rol</Th>
                <Th>Teléfono</Th>
                <Th>Instagram / link</Th>
                <Th>¿Escribí?</Th>
                <Th>¿Se pudo?</Th>
                <Th>Estado</Th>
                <Th>Quién contacta</Th>
                <Th>Notas</Th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Ningún contacto coincide con el filtro.
                  </td>
                </tr>
              )}
              {visibleRows.map((r) => {
                const wa = intlWhatsappLink(r.telefono, mensajeDe(r));
                const ig = instagramUrl(r.instagram);
                const web = ensureHttp(r.sitio_web);
                // Un fijo pasado a wa.me abre un chat muerto: hay que avisarlo.
                const esFijo = esProbableFijoAr(r.telefono);
                const dias = r.estado !== "nuevo" ? diasDesde(r.contactado_at) : null;
                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 hover:bg-muted/20 ${
                      sel.has(r.id) ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-2">
                      <input
                        type="checkbox"
                        checked={sel.has(r.id)}
                        onClick={(e) => toggleOne(r.id, (e as React.MouseEvent).shiftKey)}
                        onChange={() => {}}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
                    <Td>
                      <CellInput
                        value={r.empresa}
                        onChange={(v) => setField(r.id, "empresa", v)}
                        onBlur={(v) => persist(r.id, "empresa", v)}
                        className="font-medium"
                      />
                    </Td>
                    <Td>
                      {/* Persona y rol apilados en una sola columna: casi
                          siempre vienen vacíos y ocupaban dos columnas enteras. */}
                      <CellInput
                        value={r.contacto_nombre ?? ""}
                        placeholder="—"
                        onChange={(v) => setField(r.id, "contacto_nombre", v)}
                        onBlur={(v) => persist(r.id, "contacto_nombre", v || null)}
                      />
                      {(r.contacto_nombre || r.contacto_rol) && (
                        <CellInput
                          value={r.contacto_rol ?? ""}
                          placeholder="rol"
                          className="text-[11px] text-muted-foreground"
                          onChange={(v) => setField(r.id, "contacto_rol", v)}
                          onBlur={(v) => persist(r.id, "contacto_rol", v || null)}
                        />
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <CellInput
                          value={r.telefono ?? ""}
                          placeholder="sin teléfono"
                          className="text-xs tabular-nums"
                          onChange={(v) => setField(r.id, "telefono", v)}
                          onBlur={(v) => persist(r.id, "telefono", v || null)}
                        />
                        {r.telefono && <CopyBtn text={r.telefono} title="Copiar número" />}
                        {primerMensaje && (
                          <CopyBtn
                            text={mensajeDe(r)}
                            title="Copiar el mensaje personalizado para esta empresa"
                            icon="mensaje"
                          />
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                              esFijo
                                ? "Parece un teléfono FIJO: lo más probable es que no tenga WhatsApp. Probá por Instagram o entrá a la web a buscar el celular."
                                : primerMensaje
                                  ? "Abrir WhatsApp con el mensaje de la campaña ya escrito"
                                  : "Abrir WhatsApp"
                            }
                            className={cn(
                              "shrink-0 rounded p-0.5 hover:bg-accent",
                              esFijo
                                ? "text-muted-foreground/50 hover:text-muted-foreground"
                                : "text-emerald-600 hover:text-emerald-500"
                            )}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {esFijo && (
                        <span
                          className="ml-1 inline-block rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          title="Los fijos casi nunca tienen WhatsApp. Buscá el celular en la web o escribile por Instagram."
                        >
                          fijo
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-0.5">
                        <CellInput
                          value={r.instagram ?? ""}
                          placeholder={r.telefono ? "—" : "buscar IG"}
                          onChange={(v) => setField(r.id, "instagram", v)}
                          onBlur={(v) => persist(r.id, "instagram", v || null)}
                        />
                        {ig && (
                          <a
                            href={ig}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir Instagram y escribirle por DM"
                            className="shrink-0 rounded p-0.5 text-pink-600 hover:bg-accent hover:text-pink-500"
                          >
                            <AtSign className="h-4 w-4" />
                          </a>
                        )}
                        {web && (
                          <a
                            href={web}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir el sitio / la fuente del dato"
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {/* Marcar "ya le escribí" en un clic: el selector de estado
                          tiene 6 opciones y para lo que se hace 50 veces por día
                          hace falta una casilla, no un desplegable. */}
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={r.estado !== "nuevo"}
                          onChange={(e) => {
                            const nuevo = e.target.checked ? "contactado" : "nuevo";
                            setField(r.id, "estado", nuevo);
                            persist(r.id, "estado", nuevo);
                          }}
                          title="Marcar que ya le escribiste (queda a tu nombre)"
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {r.estado !== "nuevo" ? "sí" : "no"}
                        </span>
                      </label>
                    </Td>
                    <Td>
                      <ContactableToggle
                        value={r.contactable}
                        onChange={(v) => {
                          setField2(r.id, "contactable", v);
                          persistContactable(r.id, v);
                        }}
                      />
                    </Td>
                    <Td>
                      <select
                        value={r.estado}
                        onChange={(e) => {
                          setField(r.id, "estado", e.target.value);
                          persist(r.id, "estado", e.target.value);
                        }}
                        className={`w-full cursor-pointer rounded-full border-0 py-1 pl-2.5 pr-6 text-xs font-medium outline-none ring-offset-1 focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark] ${
                          contactoEstadoMeta(r.estado).badge
                        }`}
                      >
                        {CONTACTO_ESTADOS.map((e) => (
                          <option key={e.value} value={e.value} className="bg-background font-normal text-foreground">
                            {e.label}
                          </option>
                        ))}
                      </select>
                      {dias != null && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {dias === 0 ? "hoy" : `hace ${dias}d`}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <select
                        value={r.asignado_a ?? NADIE}
                        onChange={(e) => {
                          const v = e.target.value === NADIE ? null : e.target.value;
                          setField(r.id, "asignado_a", v);
                          persist(r.id, "asignado_a", v);
                        }}
                        className="w-full min-w-[156px] rounded-md border bg-background py-1 pl-2 pr-6 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value={NADIE} className="bg-background text-foreground">— Sin asignar —</option>
                        {comerciales.map((u) => (
                          <option key={u.id} value={u.id} className="bg-background text-foreground">
                            {u.nombre}
                          </option>
                        ))}
                        {otros.length > 0 && (
                          <optgroup label="Resto del equipo">
                            {otros.map((u) => (
                              <option key={u.id} value={u.id} className="bg-background text-foreground">
                                {u.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </Td>
                    <Td>
                      <CellInput
                        value={r.notas ?? ""}
                        placeholder="…"
                        onChange={(v) => setField(r.id, "notas", v)}
                        onBlur={(v) => persist(r.id, "notas", v || null)}
                      />
                    </Td>
                    <td className="px-1">
                      <button
                        onClick={() => borrar(r.id)}
                        title="Borrar"
                        className="text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen de seguimiento */}
      {rows.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-9">
            <Stat label="Contactos" valor={resumen.total} />
            <Stat label="Sin contactar" valor={resumen.sinContactar} />
            <Stat label="Contactados" valor={resumen.contactados} destacado />
            <Stat label="Interesados" valor={resumen.interesados} tono="text-emerald-600 dark:text-emerald-400" />
            <Stat label="Reuniones" valor={resumen.reuniones} tono="text-violet-600 dark:text-violet-400" />
            <Stat
              label="Fijos (sin WA)"
              valor={resumen.fijos}
              tono={resumen.fijos > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
            <Stat label="No se pudo" valor={resumen.noSePudo} tono="text-rose-600 dark:text-rose-400" />
            <Stat
              label="Seguir (3+ días)"
              valor={resumen.paraSeguir}
              tono={resumen.paraSeguir > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
            <Stat label="Míos" valor={resumen.mios} />
          </div>
          {tasaInteres != null && (
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              <b className="text-foreground">{tasaInteres}%</b> de interés sobre{" "}
              {alcanzados} contactados de verdad (los datos malos no cuentan).
            </p>
          )}
        </div>
      )}

      {/* ── Modo despacho: uno por uno, sin volver a la tabla ── */}
      <Dialog open={despacho} onOpenChange={setDespacho}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" /> Despachar contactos
            </DialogTitle>
          </DialogHeader>
          {actual ? (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{actual.empresa}</p>
                  <p className="text-sm text-muted-foreground">
                    {actual.contacto_nombre
                      ? `${actual.contacto_nombre}${actual.contacto_rol ? ` · ${actual.contacto_rol}` : ""}`
                      : "Sin persona de contacto"}
                    {" · "}
                    <span className="tabular-nums">{actual.telefono}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  quedan {cola.length}
                </span>
              </div>

              {esProbableFijoAr(actual.telefono) && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  ☎️ Este número <b>parece un fijo</b>: lo más probable es que no
                  tenga WhatsApp. Antes de gastar el mensaje, mirá si tiene
                  Instagram o entrá a la web a buscar el celular. Si no se puede,
                  marcalo con <b>No se pudo</b>.
                </p>
              )}

              {primerMensaje ? (
                <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  {mensajeDe(actual)}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Esta campaña no tiene los mensajes generados: el WhatsApp se abre
                  vacío. Generalos en la pantalla de la campaña para despachar con
                  el texto listo.
                </p>
              )}

              <div className="grid gap-2">
                {/* Flujo recomendado: WhatsApp Web abierto en otra pestaña →
                    copiás número y mensaje acá, pegás allá, y marcás. Evita el
                    diálogo del navegador y la carga de wa.me por contacto. */}
                <div className="grid grid-cols-2 gap-2">
                  <CopyBig
                    label="1 · Copiar número"
                    text={waDigits(actual.telefono ?? "") ?? actual.telefono ?? ""}
                  />
                  <CopyBig
                    label="2 · Copiar mensaje"
                    text={mensajeDe(actual)}
                    disabled={!primerMensaje}
                  />
                </div>
                <Button
                  onClick={() => despachar(actual, "contactado")}
                  className="h-11 bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Check className="mr-2 h-4 w-4" />
                  3 · Marcar contactado y pasar al siguiente
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const wa = intlWhatsappLink(actual.telefono, mensajeDe(actual));
                      if (wa) window.open(wa, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Abrir WA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => despachar(actual, "no_se_pudo")}
                    className="text-rose-600 dark:text-rose-400"
                  >
                    <PhoneOff className="mr-1.5 h-3.5 w-3.5" /> No se pudo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaltados((p) => new Set(p).add(actual.id))}
                  >
                    <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Saltar
                  </Button>
                </div>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                Con WhatsApp Web abierto en otra pestaña: pegás el número en el
                buscador, pegás el mensaje y enviás. Acá solo marcás y seguís.
              </p>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Check className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-medium">¡No quedan pendientes!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos los contactos con teléfono ya fueron trabajados
                {saltados.size > 0 ? ` (${saltados.size} salteados)` : ""}.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setDespacho(false)}>
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  valor,
  tono,
  destacado,
}: {
  label: string;
  valor: number;
  tono?: string;
  destacado?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <b className={`text-base tabular-nums ${tono ?? (destacado ? "text-primary" : "")}`}>
        {valor}
      </b>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1 align-middle">{children}</td>;
}

/**
 * Marca si el DATO de contacto sirve. Cicla: sin probar → sí se pudo → no se
 * pudo. Es distinto del estado: "no se pudo contactar" (dato mal cargado) no es
 * lo mismo que "no le interesó".
 */
function ContactableToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const next = value === null ? true : value === true ? false : null;
  const meta =
    value === true
      ? { label: "Sí", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", title: "Se pudo contactar" }
      : value === false
        ? { label: "No", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", title: "No se pudo (dato mal cargado)" }
        : { label: "—", cls: "bg-muted text-muted-foreground", title: "Sin probar. Clic para marcar." };
  return (
    <button
      type="button"
      title={meta.title}
      onClick={() => onChange(next)}
      className={`w-full rounded-full px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 ${meta.cls}`}
    >
      {meta.label}
    </button>
  );
}

/**
 * Botón grande de copiar para el modo despacho: muestra la confirmación en el
 * propio botón para que el ritmo copiar→pegar→copiar→pegar no se corte.
 */
function CopyBig({
  label,
  text,
  disabled,
}: {
  label: string;
  text: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={disabled || !text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("No se pudo copiar.");
        }
      }}
      className="h-11"
    >
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4 text-emerald-600" /> Copiado
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" /> {label}
        </>
      )}
    </Button>
  );
}

/**
 * Botón chico para copiar un valor de la fila. `icon="mensaje"` usa el ícono de
 * mensaje (para distinguir "copiar el mensaje personalizado" de "copiar el
 * número" cuando conviven en la misma celda).
 */
function CopyBtn({
  text,
  title,
  icon = "copy",
}: {
  text: string;
  title: string;
  icon?: "copy" | "mensaje";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          toast.error("No se pudo copiar.");
        }
      }}
      className={`shrink-0 rounded p-0.5 hover:bg-accent ${
        icon === "mensaje"
          ? "text-sky-600 hover:text-sky-500 dark:text-sky-400"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : icon === "mensaje" ? (
        <MessageSquareText className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/** Celda editable tipo Excel: input transparente que guarda al perder el foco. */
function CellInput({
  value,
  placeholder,
  className,
  onChange,
  onBlur,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onBlur(e.target.value.trim())}
      className={`w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 outline-none placeholder:text-muted-foreground/50 hover:border-border focus:border-ring focus:ring-1 focus:ring-ring ${className ?? ""}`}
    />
  );
}
