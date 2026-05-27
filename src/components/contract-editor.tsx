"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileText,
  Loader2,
  Pencil,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  deleteContract,
  saveContractContent,
  updateContract,
} from "@/app/(app)/contratos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

type CompType = "comision" | "fee_fijo" | "por_entrega" | "mixto";
type Estado = "borrador" | "activo" | "pausado" | "finalizado";

interface ContractRow {
  id: string;
  user_id: string;
  position_id: string | null;
  rol_descripcion: string | null;
  compensation_type: CompType;
  compensation_detail: string | null;
  monto_referencia: number | null;
  moneda: string;
  confidentiality: boolean;
  cesion_derechos: boolean;
  no_competencia: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: Estado;
  content_md: string | null;
  notas: string | null;
  persona: { id: string; nombre: string } | null;
  puesto: { id: string; nombre: string } | null;
}

export function ContractEditor({
  contract,
  users,
  positions,
}: {
  contract: ContractRow;
  users: { id: string; nombre: string }[];
  positions: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [userId, setUserId] = useState(contract.user_id);
  const [positionId, setPositionId] = useState(contract.position_id ?? NONE);
  const [rol, setRol] = useState(contract.rol_descripcion ?? "");
  const [compType, setCompType] = useState<CompType>(contract.compensation_type);
  const [compDetail, setCompDetail] = useState(
    contract.compensation_detail ?? ""
  );
  const [monto, setMonto] = useState<string>(
    contract.monto_referencia != null ? String(contract.monto_referencia) : ""
  );
  const [moneda, setMoneda] = useState(contract.moneda || "ARS");
  const [conf, setConf] = useState(contract.confidentiality);
  const [cesion, setCesion] = useState(contract.cesion_derechos);
  const [noComp, setNoComp] = useState(contract.no_competencia);
  const [fechaInicio, setFechaInicio] = useState(contract.fecha_inicio);
  const [fechaFin, setFechaFin] = useState(contract.fecha_fin ?? "");
  const [estado, setEstado] = useState<Estado>(contract.estado);
  const [contentMd, setContentMd] = useState(contract.content_md ?? "");
  const [notas, setNotas] = useState(contract.notas ?? "");

  const personName =
    users.find((u) => u.id === userId)?.nombre ??
    contract.persona?.nombre ??
    "";
  const positionLabel =
    positions.find((p) => p.id === positionId)?.nombre ??
    contract.puesto?.nombre ??
    null;

  function saveAll() {
    start(async () => {
      const res = await updateContract(contract.id, {
        user_id: userId,
        position_id: positionId === NONE ? null : positionId,
        rol_descripcion: rol || null,
        compensation_type: compType,
        compensation_detail: compDetail || null,
        monto_referencia: monto ? Number(monto) : null,
        moneda,
        confidentiality: conf,
        cesion_derechos: cesion,
        no_competencia: noComp,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        estado,
        content_md: contentMd || null,
        notas: notas || null,
      });
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Cambios guardados");
      router.refresh();
    });
  }

  async function generateWithAI() {
    if (!personName) {
      toast.error("Falta la persona");
      return;
    }
    if (
      contentMd.trim() &&
      !confirm(
        "Ya tiene contenido. ¿Reemplazar con uno nuevo generado por IA?"
      )
    ) {
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/contratos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_persona: personName,
          rol_descripcion: rol || null,
          position_label: positionLabel,
          compensation_type: compType,
          compensation_detail: compDetail || null,
          monto_referencia: monto ? Number(monto) : null,
          moneda,
          confidentiality: conf,
          cesion_derechos: cesion,
          no_competencia: noComp,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || null,
          notas: notas || null,
        }),
      });
      const data = (await res.json()) as {
        content_md?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error generando contrato");
        return;
      }
      setContentMd(data.content_md ?? "");
      // Persistir el cuerpo recien generado
      await saveContractContent(contract.id, data.content_md ?? "");
      toast.success("Contrato generado y guardado");
    } catch (e) {
      toast.error(
        "No se pudo generar: " + (e instanceof Error ? e.message : "")
      );
    } finally {
      setGenerating(false);
    }
  }

  function onDelete() {
    if (
      !confirm(
        "¿Eliminar este contrato? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    start(async () => {
      const res = await deleteContract(contract.id);
      if (res?.error) {
        toast.error("No se pudo eliminar: " + res.error);
        return;
      }
      toast.success("Contrato eliminado");
      router.push("/contratos");
    });
  }

  function onPrint() {
    window.open(`/contratos/${contract.id}/print`, "_blank");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Contrato — {personName || "Sin persona"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Editá los términos y generá el cuerpo del contrato con IA. Después
            imprimís o exportás a PDF desde el navegador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir / PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> Eliminar
          </Button>
        </div>
      </div>

      {/* Datos del contrato */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Términos
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Persona</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Puesto</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Sin puesto —</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Descripción del rol</Label>
            <Input
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              placeholder="Ej: Community Manager para 3 clientes"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de compensación</Label>
            <Select
              value={compType}
              onValueChange={(v) => setCompType(v as CompType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comision">Comisión (%)</SelectItem>
                <SelectItem value="fee_fijo">Fee fijo mensual</SelectItem>
                <SelectItem value="por_entrega">Por entrega</SelectItem>
                <SelectItem value="mixto">Mixto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as Estado)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Detalle de compensación</Label>
            <Textarea
              rows={2}
              value={compDetail}
              onChange={(e) => setCompDetail(e.target.value)}
              placeholder="Ej: 30% del cobro neto del cliente X. Se factura a fin de mes."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monto de referencia (opcional)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <Input
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              placeholder="ARS"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha inicio</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha fin (vacío = indefinido)</Label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={conf}
                  onChange={(e) => setConf(e.target.checked)}
                  className="h-4 w-4"
                />
                Confidencialidad / NDA
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={cesion}
                  onChange={(e) => setCesion(e.target.checked)}
                  className="h-4 w-4"
                />
                Cesión de derechos creativos
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={noComp}
                  onChange={(e) => setNoComp(e.target.checked)}
                  className="h-4 w-4"
                />
                No competencia
              </label>
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notas internas (no van en el contrato)</Label>
            <Textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Cualquier nota del coordinador para esta persona."
            />
          </div>
        </div>
      </div>

      {/* Cuerpo del contrato */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cuerpo del contrato (markdown)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((s) => !s)}
              disabled={!contentMd}
            >
              {showPreview ? (
                <>
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-4 w-4" /> Vista previa
                </>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={generateWithAI}
              disabled={generating || pending}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Generando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  {contentMd ? "Regenerar con IA" : "Generar con IA"}
                </>
              )}
            </Button>
          </div>
        </div>
        {showPreview ? (
          <article className="prose prose-sm max-w-none rounded-md border bg-background p-4 dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {contentMd || "_Sin contenido todavía. Generá con IA._"}
            </ReactMarkdown>
          </article>
        ) : (
          <Textarea
            rows={20}
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            className="font-mono text-xs"
            placeholder="Generá con IA o pegá un contrato existente acá…"
          />
        )}
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={saveAll} disabled={pending} size="lg" className="shadow-lg">
          {pending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              <Save className="mr-1 h-4 w-4" /> Guardar cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
