"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { guardarLogoCliente } from "@/app/(app)/clientes/actions";
import { cn } from "@/lib/utils";

/**
 * El logo de la cuenta en el encabezado de su ficha. Si falta, un cuadrado
 * punteado invita a subirlo: con eso la cuenta aparece en el carrusel de marcas
 * de jdmedia.com.ar (13/10/2026).
 */
export function ClienteLogo({
  clienteId,
  nombre,
  logoUrl,
  puedeEditar,
}: {
  clienteId: string;
  nombre: string;
  logoUrl: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("Tiene que ser una imagen (PNG, JPG, SVG o WebP).");
    if (f.size > 3 * 1024 * 1024) return void toast.error("La imagen pesa más de 3 MB.");
    setSubiendo(true);
    try {
      const ext = (f.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `logos/${clienteId}-${Date.now()}.${ext}`;
      const sb = createClient();
      const { error } = await sb.storage.from("publish-media").upload(path, f, { upsert: false, contentType: f.type });
      if (error) throw new Error(error.message);
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publish-media/${path}`;
      const r = await guardarLogoCliente(clienteId, url);
      if ("error" in r && r.error) throw new Error(r.error);
      toast.success("Logo cargado: ya aparece en la web");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el logo");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sacar() {
    const r = await guardarLogoCliente(clienteId, null);
    if ("error" in r && r.error) return void toast.error(r.error);
    router.refresh();
  }

  if (!logoUrl && !puedeEditar) return null;

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        disabled={!puedeEditar || subiendo}
        onClick={() => fileRef.current?.click()}
        title={logoUrl ? "Cambiar el logo" : "Subir el logo (aparece en la web)"}
        className={cn(
          "flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white",
          logoUrl ? "border" : "border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary"
        )}
      >
        {subiendo ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`Logo de ${nombre}`} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="flex flex-col items-center text-[9px] leading-tight">
            <ImagePlus className="mb-0.5 h-4 w-4" /> Logo
          </span>
        )}
      </button>
      {logoUrl && puedeEditar && (
        <button
          type="button"
          onClick={sacar}
          title="Sacar el logo"
          className="absolute -right-1.5 -top-1.5 hidden rounded-full border bg-background p-0.5 group-hover:block"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files)} />
    </div>
  );
}
