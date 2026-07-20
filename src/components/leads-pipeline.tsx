"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Building2,
  ChevronDown,
  FileSignature,
  Globe,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  changeLeadStage,
  createProposalFromLead,
  deleteLead,
  type LeadStage,
} from "@/app/(app)/comercial/actions";
import { LeadFormDialog, type LeadInit } from "@/components/lead-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STAGES: LeadStage[] = [
  "nuevo",
  "contactado",
  "calificado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
];

const STAGE_LABEL: Record<LeadStage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

const STAGE_DOT: Record<LeadStage, string> = {
  nuevo: "bg-blue-500",
  contactado: "bg-indigo-500",
  calificado: "bg-violet-500",
  propuesta: "bg-amber-500",
  negociacion: "bg-orange-500",
  ganado: "bg-emerald-500",
  perdido: "bg-muted-foreground",
};

const STAGE_CARD: Record<LeadStage, string> = {
  nuevo: "border-blue-500/40 bg-blue-500/5",
  contactado: "border-indigo-500/40 bg-indigo-500/5",
  calificado: "border-violet-500/40 bg-violet-500/5",
  propuesta: "border-amber-500/40 bg-amber-500/5",
  negociacion: "border-orange-500/40 bg-orange-500/5",
  ganado: "border-emerald-500/40 bg-emerald-500/5",
  perdido: "border-muted bg-muted/30",
};

export interface LeadRow extends LeadInit {
  id: string;
  created_at: string;
  servicio?: { slug: string; name: string } | null;
  asignado?: { id: string; nombre: string } | null;
}

function normOrigen(o: string | null) {
  return (o ?? "").trim().toLowerCase();
}

function OrigenIcon({ origen }: { origen: string | null }) {
  const c = "h-3.5 w-3.5";
  const o = normOrigen(origen);
  if (o === "web") return <Globe className={c} />;
  if (o.includes("insta") || o === "ig") return <AtSign className={c} />;
  if (o.includes("whats") || o === "wa") return <MessageCircle className={c} />;
  return <Building2 className={c} />;
}

function money(n: number | null, moneda: string) {
  if (n == null) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda || "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function since(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} d`;
}

export function LeadsPipeline({
  leads,
  services,
  users,
}: {
  leads: LeadRow[];
  services: { slug: string; name: string }[];
  users: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [origenFilter, setOrigenFilter] = useState("todos");
  const [pending, start] = useTransition();

  const origenes = useMemo(() => {
    const s = new Set(
      leads.map((l) => (normOrigen(l.origen) || "sin origen") as string)
    );
    return ["todos", ...Array.from(s).sort()];
  }, [leads]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      const o = normOrigen(l.origen) || "sin origen";
      if (origenFilter !== "todos" && o !== origenFilter) return false;
      if (!term) return true;
      return [l.nombre, l.empresa, l.notas, l.email, l.telefono]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [leads, q, origenFilter]);

  const byStage = useMemo(() => {
    const m = {} as Record<LeadStage, LeadRow[]>;
    for (const s of STAGES) m[s] = [];
    for (const l of filtered) (m[l.stage] ??= []).push(l);
    return m;
  }, [filtered]);

  const abiertos = filtered.filter(
    (l) => l.stage !== "ganado" && l.stage !== "perdido"
  );
  const valorAbierto = abiertos.reduce(
    (a, l) => a + (l.monto_estimado ?? 0),
    0
  );
  const desdeWeb = filtered.filter((l) => normOrigen(l.origen) === "web").length;

  function move(id: string, stage: LeadStage) {
    start(async () => {
      const res = await changeLeadStage(id, stage);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Movido a ${STAGE_LABEL[stage]}`);
        router.refresh();
      }
    });
  }

  function toProposal(id: string) {
    start(async () => {
      const res = await createProposalFromLead(id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Propuesta creada desde el lead");
        router.refresh();
      }
    });
  }

  function remove(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el lead "${nombre}"? No se puede deshacer.`)) return;
    start(async () => {
      const res = await deleteLead(id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Lead eliminado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Leads abiertos</p>
          <p className="text-2xl font-bold">{abiertos.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Ganados</p>
          <p className="text-2xl font-bold text-emerald-600">
            {byStage.ganado?.length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Valor en pipeline</p>
          <p className="text-2xl font-bold">{money(valorAbierto, "ARS")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Desde la web</p>
          <p className="text-2xl font-bold">{desdeWeb}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, empresa, nota…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {origenes.map((o) => (
            <button
              key={o}
              onClick={() => setOrigenFilter(o)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                origenFilter === o
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted"
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const items = byStage[stage] ?? [];
          return (
            <div key={stage} className="w-[268px] shrink-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className={cn("h-2 w-2 rounded-full", STAGE_DOT[stage])}
                  aria-hidden
                />
                <h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                </span>
                <LeadFormDialog
                  mode="create"
                  defaultStage={stage}
                  services={services}
                  users={users}
                  trigger={
                    <button
                      className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={`Nuevo lead en ${STAGE_LABEL[stage]}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>

              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Sin leads
                  </div>
                )}

                {items.map((lead) => (
                  <div
                    key={lead.id}
                    className={cn(
                      "rounded-lg border p-3 transition-shadow hover:shadow-sm",
                      STAGE_CARD[stage]
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {lead.nombre}
                        </p>
                        {lead.empresa && (
                          <p className="truncate text-xs text-muted-foreground">
                            {lead.empresa}
                          </p>
                        )}
                      </div>
                      {lead.origen && (
                        <Badge
                          variant="secondary"
                          className="flex shrink-0 items-center gap-1 text-[10px] capitalize"
                        >
                          <OrigenIcon origen={lead.origen} />
                          {lead.origen}
                        </Badge>
                      )}
                    </div>

                    {lead.servicio?.name && (
                      <p className="mt-2 text-xs font-medium">
                        {lead.servicio.name}
                      </p>
                    )}

                    {lead.notas && (
                      <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
                        {lead.notas}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {lead.telefono && (
                        <a
                          href={`https://wa.me/${lead.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {lead.telefono}
                        </a>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex min-w-0 items-center gap-1 hover:text-foreground"
                        >
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </a>
                      )}
                    </div>

                    {lead.proxima_accion && (
                      <p className="mt-2 rounded bg-background/60 px-2 py-1 text-[11px]">
                        <span className="font-medium">Próximo:</span>{" "}
                        {lead.proxima_accion}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {money(lead.monto_estimado, lead.moneda) ??
                          since(lead.created_at)}
                      </span>

                      <div className="flex items-center gap-1">
                        <LeadFormDialog
                          mode="edit"
                          lead={lead}
                          services={services}
                          users={users}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              Ver
                            </Button>
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={pending}
                            >
                              Mover <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STAGES.filter((s) => s !== stage).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => move(lead.id, s)}
                              >
                                {STAGE_LABEL[s]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toProposal(lead.id)}>
                              <FileSignature className="mr-2 h-3.5 w-3.5" />
                              Generar propuesta
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => remove(lead.id, lead.nombre)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
