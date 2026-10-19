"use client";

/**
 * Las fuentes de inspiración de una cuenta (19/10/2026): cuentas de referencia
 * y hashtags del rubro. Se suman pegando el @ o el link de Instagram.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { agregarFuente, actualizarInspo, buscarReferenciasIA, quitarFuente } from "@/app/(app)/contenidos/inspo/actions";

export function InspoFuentes({
  clienteId,
  fuentes,
}: {
  clienteId: string;
  fuentes: { id: string; tipo: "cuenta" | "hashtag"; valor: string; error: string | null; origen?: string | null }[];
}) {
  const [buscando, setBuscando] = useState(false);
  async function buscarIA() {
    setBuscando(true);
    const r = await buscarReferenciasIA(clienteId);
    setBuscando(false);
    if (r.agregadas.length) toast.success(`Sumamos ${r.agregadas.length}: ${r.agregadas.join(", ")}`);
    else toast.message(r.motivo ?? "No encontramos cuentas nuevas.");
    startTransition(() => router.refresh());
  }
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [cargando, setCargando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [, startTransition] = useTransition();

  async function sumar(e: React.FormEvent) {
    e.preventDefault();
    const v = valor.trim();
    if (!v) return;
    // Los hashtags necesitan el permiso «Instagram Public Content Access» de Meta
    // (revisión de la app): todavía no lo tenemos (19/10/2026).
    if (v.startsWith("#")) return void toast.error("Por ahora solo cuentas: los hashtags necesitan un permiso de Meta que todavía no tenemos.");
    const tipo = "cuenta";
    setCargando(true);
    const r = await agregarFuente(clienteId, tipo, v);
    setCargando(false);
    if ("error" in r && r.error) return void toast.error(r.error);
    if ("aviso" in r && r.aviso) toast.message(r.aviso);
    else toast.success(tipo === "cuenta" ? "Listo: ya trajimos sus publicaciones." : "Listo: ya trajimos lo mejor del hashtag.");
    setValor("");
    startTransition(() => router.refresh());
  }

  async function actualizar() {
    setActualizando(true);
    const r = await actualizarInspo(clienteId);
    setActualizando(false);
    if (r.errores.length) toast.message(r.errores[0]);
    else toast.success("Inspo actualizada.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <form onSubmit={sumar} className="flex flex-wrap gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="@cuentadereferencia o link de Instagram"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={cargando || !valor.trim()}>
          {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sumar
        </Button>
        <Button type="button" variant="outline" onClick={buscarIA} disabled={buscando} title="La IA propone cuentas del rubro y las verificamos en Instagram">
          {buscando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-primary" />}
          {buscando ? "Buscando…" : "Buscar con IA"}
        </Button>
        {fuentes.length > 0 && (
          <Button type="button" variant="outline" onClick={actualizar} disabled={actualizando} title="Volver a traer todo">
            <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} />
          </Button>
        )}
      </form>
      {fuentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fuentes.map((f) => (
            <span
              key={f.id}
              title={f.error ?? undefined}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${f.error ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300" : "bg-muted/50"}`}
            >
              {f.origen === "ia" && <span title="Sugerida por la IA, verificada en Instagram">✨</span>}
              {f.origen === "cliente" && <span title="La nombró el cliente">🗣️</span>}
              {f.tipo === "cuenta" ? "@" : "#"}
              {f.valor}
              {f.error && " ⚠️"}
              <button
                type="button"
                aria-label="Quitar"
                className="ml-0.5 rounded-full p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100"
                onClick={async () => {
                  await quitarFuente(clienteId, f.id);
                  startTransition(() => router.refresh());
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
