"use client";

import { useRef, useState } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Resumen {
  tipo: "pack" | "medida";
  nombre: string;
  precio: number;
  reels: number;
  posts: number;
  dias_historias: number;
  conPauta: boolean;
  extras: { nombre: string; precio: number }[];
  ajustes: string[];
  porQue: string | null;
  titular: string | null;
  comision: { mes1: number; mensual: number };
}

interface Resultado {
  id: string;
  url: string;
  mensaje: string;
  resumen: Resumen;
}

interface Imagen {
  id: string;
  name: string;
  dataUrl: string;
  media_type: string;
  data: string;
}

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

/**
 * Achica la captura antes de mandarla: Vercel corta los pedidos de más de
 * 4,5 MB y una captura de celular en base64 puede pasar eso sola.
 */
async function leerImagen(file: File): Promise<Imagen> {
  const original = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img"));
    i.src = original;
  });
  const escala = Math.min(1, 1400 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    dataUrl,
    media_type: "image/jpeg",
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
  };
}

export function PresupuestoIa() {
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [instagram, setInstagram] = useState("");
  const [web, setWeb] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [contexto, setContexto] = useState("");
  const [transcripcion, setTranscripcion] = useState("");
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [paso, setPaso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);

  async function sumarImagenes(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (imgRef.current) imgRef.current.value = "";
    for (const f of files) {
      if (imagenes.length >= 4) {
        toast.error("Hasta 4 capturas.");
        break;
      }
      try {
        const im = await leerImagen(f);
        setImagenes((prev) => (prev.length >= 4 ? prev : [...prev, im]));
      } catch {
        toast.error(`No pude leer ${f.name}.`);
      }
    }
  }

  async function cargarTxt(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (txtRef.current) txtRef.current.value = "";
    if (!f) return;
    setTranscripcion((await f.text()).slice(0, 60000));
  }

  async function generar() {
    if (!empresa.trim()) {
      toast.error("Poné el nombre del negocio.");
      return;
    }
    if (!transcripcion.trim() && !contexto.trim() && !instagram.trim() && !web.trim() && !imagenes.length) {
      toast.error("Pegá la transcripción, contá algo del cliente o cargá su Instagram o su web.");
      return;
    }
    setResultado(null);
    setPaso("Arrancando…");
    try {
      const res = await fetch("/api/comercial/presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa,
          contacto,
          ciudad,
          instagram,
          web,
          presupuesto,
          contexto,
          transcripcion,
          images: imagenes.map((im) => ({ media_type: im.media_type, data: im.data })),
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? (res.status === 413 ? "Las capturas pesan demasiado." : "No se pudo armar."));
      }
      if (!res.body) throw new Error("Sin respuesta del servidor.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: Resultado | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6)) as { type: string; texto?: string; error?: string } & Partial<Resultado>;
          if (evt.type === "paso") setPaso(evt.texto ?? null);
          else if (evt.type === "error") throw new Error(evt.error ?? "No se pudo armar.");
          else if (evt.type === "done") final = evt as Resultado;
        }
      }
      if (!final) throw new Error("Se cortó antes de terminar. Probá de nuevo.");
      setResultado(final);
      toast.success("Propuesta lista.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo armar.");
    } finally {
      setPaso(null);
    }
  }

  async function copiar() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const r = resultado?.resumen;
  const volumen = r
    ? [
        r.reels ? `${r.reels} ${r.reels === 1 ? "reel" : "reels"}` : null,
        r.posts ? `${r.posts} ${r.posts === 1 ? "carrusel" : "carruseles"}` : null,
        r.dias_historias ? `${r.dias_historias} días de historias` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const generando = paso !== null;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pi-empresa">Negocio *</Label>
              <Input id="pi-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Fragancias Córdoba" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-contacto">Con quién hablaste</Label>
              <Input id="pi-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Laura" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-ig">Instagram</Label>
              <Input id="pi-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@fraganciascba" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-web">Web</Label>
              <Input id="pi-web" value={web} onChange={(e) => setWeb(e.target.value)} placeholder="fragancias.com.ar" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-ciudad">Ciudad</Label>
              <Input id="pi-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Córdoba" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-presupuesto">¿Dijo cuánto puede gastar?</Label>
              <Input
                id="pi-presupuesto"
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                placeholder="Ej: no más de $300.000 por mes"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="pi-transcripcion">Transcripción de la reunión</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => txtRef.current?.click()}
              >
                Subir .txt
              </button>
              <input ref={txtRef} type="file" accept=".txt,.md,.vtt,.srt,text/plain" className="hidden" onChange={cargarTxt} />
            </div>
            <Textarea
              id="pi-transcripcion"
              value={transcripcion}
              onChange={(e) => setTranscripcion(e.target.value)}
              rows={8}
              placeholder="Pegá la transcripción completa (Tactiq, Meet, lo que sea). Si no hubo reunión, dejalo vacío y la propuesta sale en frío."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pi-contexto">Lo que sepas vos</Label>
            <Textarea
              id="pi-contexto"
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              rows={3}
              placeholder="Qué le preocupa, qué probó antes, qué le interesó, si quiere WhatsApp o Google…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={imagenes.length >= 4}>
                <ImagePlus className="mr-1.5 h-4 w-4" /> Capturas (su perfil, el chat)
              </Button>
              <span className="text-xs text-muted-foreground">Hasta 4. Instagram no se deja leer: una captura del perfil ayuda.</span>
              <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={sumarImagenes} />
            </div>
            {imagenes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {imagenes.map((im) => (
                  <div key={im.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.dataUrl} alt={im.name} className="h-20 w-20 rounded-md border object-cover" />
                    <button
                      type="button"
                      aria-label="Sacar captura"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow ring-1 ring-border"
                      onClick={() => setImagenes((prev) => prev.filter((x) => x.id !== im.id))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={generar} disabled={generando} className="w-full sm:w-auto">
            {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generando ? paso : "Armar la propuesta"}
          </Button>
          {generando && (
            <p className="text-xs text-muted-foreground">Tarda entre 30 segundos y 2 minutos. No cierres la pestaña.</p>
          )}
        </CardContent>
      </Card>

      {resultado && r && (
        <Card className="border-primary/40">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {r.tipo === "pack" ? "Pack de lista" : "Pack a medida"}
                </p>
                <p className="text-xl font-bold">
                  {r.tipo === "pack" ? `Pack ${r.nombre}` : "A medida"} · {pesos(r.precio)}
                  <span className="text-sm font-normal text-muted-foreground">/mes</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {volumen}
                  {r.conPauta ? " · con gestión de pauta" : " · sin gestión de pauta"}
                </p>
                {r.extras.length > 0 && (
                  <p className="mt-1 text-sm">
                    Opcional: {r.extras.map((x) => `${x.nombre} (+${pesos(x.precio)})`).join(", ")}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-right text-sm">
                <p className="text-xs text-muted-foreground">Tu comisión</p>
                <p className="font-semibold">
                  {pesos(r.comision.mes1)} el mes 1 · {pesos(r.comision.mensual)}/mes después
                </p>
              </div>
            </div>

            {r.porQue && <p className="text-sm">{r.porQue}</p>}
            {r.ajustes.map((a) => (
              <p key={a} className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {a}
              </p>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`${resultado.url}?preview=1`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver y editar la propuesta
                </a>
              </Button>
              <Button variant="outline" onClick={copiar}>
                {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Copiar mensaje con el link
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Mensaje para WhatsApp</Label>
              <Textarea
                value={resultado.mensaje}
                onChange={(e) => setResultado({ ...resultado, mensaje: e.target.value })}
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Antes de mandarla, abrila: desde ahí podés corregir el texto, cambiar el pack o sumar extras.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
