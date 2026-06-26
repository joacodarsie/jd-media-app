"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Camera,
  ExternalLink,
  Trash2,
  FileText,
  MessageCircle,
  BadgeCheck,
  ShieldQuestion,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_ESTADOS,
  estadoMeta,
  intlWhatsappLink,
  instagramUrl,
  ensureHttp,
} from "@/lib/prospecting/shared";
import {
  generateLeadMessage,
  generateLeadFollowup,
  setLeadEstado,
  deleteLead,
  convertLeadToProposal,
  verifyLeadInstagram,
} from "@/app/(app)/prospeccion/actions";

export interface LeadRow {
  id: string;
  empresa: string;
  descripcion: string | null;
  ciudad: string | null;
  pais: string | null;
  sitio_web: string | null;
  instagram: string | null;
  instagram_verificado: boolean | null;
  telefono: string | null;
  email: string | null;
  por_que: string | null;
  fit_score: number | null;
  fuente_url: string | null;
  mensaje: string | null;
  seguimiento: string | null;
  estado: string;
  cliente_id: string | null;
  canal: string;
}

function fitColor(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 75) return "bg-emerald-200 text-emerald-900 dark:bg-emerald-500/40 dark:text-emerald-100";
  if (score >= 50) return "bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100";
  return "bg-slate-200 text-slate-700 dark:bg-slate-500/40 dark:text-slate-100";
}

export function ProspectingLeadCard({ lead }: { lead: LeadRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"msg" | "convert" | "followup" | "ig" | null>(null);
  const [copied, setCopied] = useState<"msg" | "followup" | null>(null);
  const [msg, setMsg] = useState(lead.mensaje);
  const [followup, setFollowup] = useState(lead.seguimiento);
  // El IG puede corregirse/anularse al verificar, así que es estado local.
  const [igHandle, setIgHandle] = useState(lead.instagram);
  const [igVerif, setIgVerif] = useState<boolean | null>(lead.instagram_verificado);

  const meta = estadoMeta(lead.estado);
  const web = ensureHttp(lead.sitio_web);
  const ig = instagramUrl(igHandle);
  const wa = msg ? intlWhatsappLink(lead.telefono, msg) : intlWhatsappLink(lead.telefono, "");
  const waFollow = followup ? intlWhatsappLink(lead.telefono, followup) : null;
  // El seguimiento tiene sentido una vez que ya hubo un primer contacto.
  const yaContactado = lead.estado === "contactado" || lead.estado === "respondio";

  function genMessage() {
    setBusy("msg");
    start(async () => {
      const res = await generateLeadMessage(lead.id);
      setBusy(null);
      if ("error" in res) return void toast.error(res.error);
      setMsg(res.mensaje);
      toast.success("Mensaje generado");
    });
  }

  function genFollowup() {
    setBusy("followup");
    start(async () => {
      const res = await generateLeadFollowup(lead.id);
      setBusy(null);
      if ("error" in res) return void toast.error(res.error);
      setFollowup(res.seguimiento);
      toast.success("Seguimiento generado");
    });
  }

  function verifyIg() {
    setBusy("ig");
    start(async () => {
      const res = await verifyLeadInstagram(lead.id);
      setBusy(null);
      if ("error" in res) return void toast.error(res.error);
      setIgHandle(res.instagram);
      setIgVerif(res.verificado);
      if (res.verificado) toast.success("Instagram verificado ✓");
      else if (res.instagram) toast.warning("No se pudo confirmar el perfil");
      else toast.warning("No se encontró un Instagram real de esta empresa");
    });
  }

  function copyText(text: string | null, which: "msg" | "followup") {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      toast.success("Copiado");
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function changeEstado(estado: string) {
    start(async () => {
      const res = await setLeadEstado(lead.id, estado);
      if ("error" in res) toast.error(res.error);
    });
  }

  function convert() {
    setBusy("convert");
    start(async () => {
      const res = await convertLeadToProposal(lead.id);
      setBusy(null);
      if ("error" in res) return void toast.error(res.error);
      toast.success("Propuesta creada en Comercial");
      router.push(`/clientes/${res.clientId}/onboarding`);
    });
  }

  function remove() {
    if (!confirm(`¿Borrar el lead "${lead.empresa}"?`)) return;
    start(async () => {
      const res = await deleteLead(lead.id);
      if ("error" in res) toast.error(res.error);
      else toast.success("Lead borrado");
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{lead.empresa}</h3>
            {lead.fit_score != null && (
              <Badge className={fitColor(lead.fit_score)}>fit {lead.fit_score}</Badge>
            )}
            <Badge className={meta.badge}>{meta.label}</Badge>
          </div>
          {(lead.ciudad || lead.pais) && (
            <p className="text-xs text-muted-foreground">
              {[lead.ciudad, lead.pais].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={remove} disabled={pending} title="Borrar">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {lead.descripcion && <p className="text-sm">{lead.descripcion}</p>}

      {lead.por_que && (
        <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">Por qué: </span>
          {lead.por_que}
        </p>
      )}

      {/* Contacto / enlaces */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {web && (
          <a href={web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 hover:bg-muted">
            <Globe className="h-3 w-3" /> Web
          </a>
        )}
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            title={
              igVerif === true
                ? "Perfil verificado con búsqueda web"
                : igVerif === false
                  ? "No se pudo confirmar este perfil — revisalo antes de escribir"
                  : "Instagram sin verificar"
            }
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 hover:bg-muted ${
              igVerif === true
                ? "border-emerald-400/60 text-emerald-700 dark:text-emerald-300"
                : igVerif === false
                  ? "border-amber-400/60 text-amber-700 dark:text-amber-300"
                  : ""
            }`}
          >
            <Camera className="h-3 w-3" />
            {igHandle?.startsWith("@") ? igHandle : `@${igHandle}`}
            {igVerif === true && <BadgeCheck className="h-3 w-3" />}
            {igVerif === false && <ShieldX className="h-3 w-3" />}
          </a>
        )}
        {/* Verificar/corregir el IG con búsqueda web (o buscarlo si falta). */}
        <button
          type="button"
          onClick={verifyIg}
          disabled={pending}
          title={ig ? "Verificar que el Instagram existe" : "Buscar el Instagram de esta empresa"}
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy === "ig" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShieldQuestion className="h-3 w-3" />
          )}
          {ig ? "Verificar IG" : "Buscar IG"}
        </button>
        {lead.telefono && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
            <MessageCircle className="h-3 w-3" /> {lead.telefono}
          </span>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 hover:bg-muted">
            ✉ {lead.email}
          </a>
        )}
        {lead.fuente_url && (
          <a href={ensureHttp(lead.fuente_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-muted-foreground hover:bg-muted" title="Fuente del dato">
            <ExternalLink className="h-3 w-3" /> Fuente
          </a>
        )}
      </div>

      {/* Mensaje generado */}
      {msg ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap text-sm">{msg}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {wa && (
              <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => changeEstado("contactado")}>
                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => copyText(msg, "msg")}>
              {copied === "msg" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              Copiar
            </Button>
            {ig && (
              <Button asChild size="sm" variant="outline">
                <a href={ig} target="_blank" rel="noopener noreferrer" onClick={() => copyText(msg, "msg")}>
                  <Camera className="mr-1 h-4 w-4" /> Abrir IG
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={genMessage} disabled={pending} title="Regenerar mensaje">
              {busy === "msg" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              Regenerar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={genMessage} disabled={pending}>
          {busy === "msg" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generar mensaje
        </Button>
      )}

      {/* Seguimiento (follow-up): aparece una vez contactado, o si ya se generó */}
      {(yaContactado || followup) && (
        followup ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Seguimiento
            </p>
            <p className="whitespace-pre-wrap text-sm">{followup}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {waFollow && (
                <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                  <a href={waFollow} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => copyText(followup, "followup")}>
                {copied === "followup" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={genFollowup} disabled={pending} title="Regenerar seguimiento">
                {busy === "followup" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                Regenerar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="text-amber-700 dark:text-amber-300" onClick={genFollowup} disabled={pending}>
            {busy === "followup" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generar seguimiento
          </Button>
        )
      )}

      {/* Estado + convertir */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Select value={lead.estado} onValueChange={changeEstado} disabled={pending}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_ESTADOS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lead.cliente_id ? (
          <Button asChild size="sm" variant="outline">
            <a href={`/clientes/${lead.cliente_id}`}>
              <FileText className="mr-1 h-4 w-4" /> Ver propuesta
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={convert} disabled={pending}>
            {busy === "convert" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            Convertir en propuesta
          </Button>
        )}
      </div>
    </div>
  );
}
