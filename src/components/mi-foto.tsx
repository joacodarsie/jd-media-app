"use client";

/**
 * La foto de perfil (18/10/2026): no había cómo subirla y nadie la tenía, así
 * que la plataforma era una fila de iniciales. Se sube acá y aparece en Equipo,
 * tareas, chat y arriba a la derecha.
 *
 * 23/10/2026: al subirla se arma sola la versión para la web, con el fondo gris
 * del equipo y el mismo encuadre que el resto. La plataforma sigue mostrando la
 * original; cada uno elige cuál va en jdmedia.com.ar.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { elegirFotoWeb, guardarMiFoto, guardarMiFotoWeb } from "@/app/(app)/mi-perfil/actions";
import { cn } from "@/lib/utils";

const PUBLICO = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publish-media`;

export function MiFoto({
  userId,
  nombre,
  url,
  urlWeb,
  fotoWeb,
}: {
  userId: string;
  nombre: string;
  url: string | null;
  urlWeb: string | null;
  fotoWeb: "gris" | "original";
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [armando, setArmando] = useState<number | null>(null);
  const [modo, setModo] = useState(fotoWeb);
  const iniciales = nombre.split(" ").map((x) => x.charAt(0)).slice(0, 2).join("");

  async function armarGris(foto: Blob) {
    setArmando(0);
    try {
      const { armarFotoGris } = await import("@/lib/web/foto-gris-navegador");
      const gris = await armarFotoGris(foto, (p) => setArmando(p));
      const path = `avatars/web-${userId}-${Date.now()}.webp`;
      const { error } = await createClient().storage.from("publish-media").upload(path, gris, { upsert: false, contentType: "image/webp" });
      if (error) throw new Error(error.message);
      const r = await guardarMiFotoWeb(`${PUBLICO}/${path}`);
      if ("error" in r && r.error) throw new Error(r.error);
      toast.success("Lista también la versión para la web.");
      router.refresh();
    } catch (e) {
      toast.error(`No pudimos armar la versión para la web: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setArmando(null);
    }
  }

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
      const r = await guardarMiFoto(`${PUBLICO}/${path}`);
      if ("error" in r && r.error) throw new Error(r.error);
      toast.success("¡Lista tu foto!");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
      return;
    } finally {
      setSubiendo(false);
      if (ref.current) ref.current.value = "";
    }
    void armarGris(f);
  }

  async function rehacerDesdeLaActual() {
    if (!url) return;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      await armarGris(await r.blob());
    } catch {
      toast.error("No pudimos leer tu foto actual. Subila de nuevo.");
    }
  }

  async function elegir(m: "gris" | "original") {
    if (m === modo) return;
    const antes = modo;
    setModo(m);
    const r = await elegirFotoWeb(m);
    if ("error" in r && r.error) {
      setModo(antes);
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-3">
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
      </div>

      {url && (
        <div className="rounded-xl border p-3">
          <p className="text-xs font-medium">En la web (jdmedia.com.ar) va:</p>
          <div className="mt-2 flex gap-3">
            <Opcion
              activa={modo === "gris"}
              onClick={() => {
                if (!urlWeb && armando == null) void rehacerDesdeLaActual();
                void elegir("gris");
              }}
              etiqueta="Fondo gris"
              recomendada
            >
              {armando != null ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {armando > 0 && armando < 100 ? `${armando}%` : "Armando…"}
                </span>
              ) : urlWeb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlWeb} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  Armarla
                </span>
              )}
            </Opcion>
            <Opcion activa={modo === "original"} onClick={() => elegir("original")} etiqueta="Original">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </Opcion>
          </div>
          {urlWeb && armando == null && (
            <button type="button" onClick={rehacerDesdeLaActual} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline">
              Rehacer la versión gris
            </button>
          )}
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => subir(e.target.files)} />
    </div>
  );
}

function Opcion({
  activa,
  onClick,
  etiqueta,
  recomendada,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  etiqueta: string;
  recomendada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1" aria-pressed={activa}>
      <span
        className={cn(
          "relative block h-[90px] w-[72px] overflow-hidden rounded-lg bg-muted ring-2 transition",
          activa ? "ring-primary" : "ring-transparent opacity-70 group-hover:opacity-100"
        )}
      >
        {children}
        {activa && (
          <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium">
        {etiqueta}
        {recomendada && <span className="text-muted-foreground"> ★</span>}
      </span>
    </button>
  );
}
