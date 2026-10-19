"use client";

/**
 * Las fuentes de inspiración de una cuenta (19/10/2026): cuentas de referencia
 * y hashtags del rubro. Se suman pegando el @ o el link de Instagram.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { agregarFuente, actualizarInspo, quitarFuente } from "@/app/(app)/contenidos/inspo/actions";

export function InspoFuentes({
  clienteId,
  fuentes,
}: {
  clienteId: string;
  fuentes: { id: string; tipo: "cuenta" | "hashtag"; valor: string; error: string | null }[];
}) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [cargando, setCargando] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [, startTransition] = useTransition();

  async function sumar(e: React.FormEvent) {
    e.preventDefault();
    const v = valor.trim();
    if (!v) return;
    setCargando(true);
    const tipo = v.startsWith("#") ? "hashtag" : "cuenta";
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
          placeholder="@cuentadereferencia, link de Instagram o #hashtag"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={cargando || !valor.trim()}>
          {cargando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sumar
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
