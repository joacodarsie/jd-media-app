"use client";

/**
 * La foto de perfil (18/10/2026): no había cómo subirla y nadie la tenía, así
 * que la plataforma era una fila de iniciales. Se sube acá y aparece en Equipo,
 * tareas, chat y arriba a la derecha.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { guardarMiFoto } from "@/app/(app)/mi-perfil/actions";

export function MiFoto({ userId, nombre, url }: { userId: string; nombre: string; url: string | null }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const iniciales = nombre.split(" ").map((x) => x.charAt(0)).slice(0, 2).join("");

  async function subir(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("Tiene que ser una foto (JPG, PNG o WebP).");
    if (f.size > 4 * 1024 * 1024) return void toast.error("La foto pesa más de 4 MB.");
    setSubiendo(true);
    try {
      const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error } = await createClient().storage.from("publish-media").upload(path, f, { upsert: false, contentType: f.type });
      if (error) throw new Error(error.message);
      const r = await guardarMiFoto(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publish-media/${path}`);
      if ("error" in r && r.error) throw new Error(r.error);
      toast.success("¡Lista tu foto!");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={subiendo}
        className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-primary/15 ring-2 ring-border transition hover:ring-primary"
        title={url ? "Cambiar tu foto" : "Subir tu foto"}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={nombre} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl font-bold">{iniciales}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
          {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
      </button>
      <div className="text-sm">
        <div className="font-medium">{url ? "Tu foto" : "Subí tu foto"}</div>
        <div className="text-muted-foreground">
          {url ? "Tocala para cambiarla." : "Aparece en Equipo, en las tareas y en el chat. Mejor una de frente, con buena luz."}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files)} />
    </div>
  );
}
