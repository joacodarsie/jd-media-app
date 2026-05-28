"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ───────────────────────── helpers de audio ─────────────────────────

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToInt16Array(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

// ───────────────────────── tipos mínimos del SDK ─────────────────────────
// Tipamos sólo lo que usamos para no acoplarnos a toda la superficie del SDK.
interface LiveSession {
  sendRealtimeInput: (input: {
    audio?: { data: string; mimeType: string };
    video?: { data: string; mimeType: string };
  }) => void;
  close: () => void;
}

interface ServerMessage {
  serverContent?: {
    interrupted?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
    turnComplete?: boolean;
  };
}

type Status = "idle" | "connecting" | "live" | "error";

export function JdmediaLive({ userName }: { userName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [caption, setCaption] = useState("");

  // refs (no provocan re-render)
  const sessionRef = useRef<LiveSession | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const inCtxRef = useRef<AudioContext | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micOnRef = useRef(true);

  // playback scheduling
  const nextStartRef = useRef(0);
  const scheduledRef = useRef<AudioBufferSourceNode[]>([]);
  const outCaptionRef = useRef("");

  const stopAll = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    try {
      muteGainRef.current?.disconnect();
    } catch {}
    muteGainRef.current = null;

    for (const s of scheduledRef.current) {
      try {
        s.stop();
      } catch {}
    }
    scheduledRef.current = [];
    nextStartRef.current = 0;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    inCtxRef.current?.close().catch(() => {});
    inCtxRef.current = null;
    outCtxRef.current?.close().catch(() => {});
    outCtxRef.current = null;

    try {
      sessionRef.current?.close();
    } catch {}
    sessionRef.current = null;
  }, []);

  const hangUp = useCallback(() => {
    stopAll();
    setStatus("idle");
    setAiSpeaking(false);
    setCaption("");
  }, [stopAll]);

  // limpieza al desmontar
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  // El <video> de preview recién existe en el DOM cuando status === "live";
  // por eso le adjuntamos el stream acá y no en start().
  useEffect(() => {
    if (status === "live" && previewRef.current && screenStreamRef.current) {
      previewRef.current.srcObject = screenStreamRef.current;
      previewRef.current.play().catch(() => {});
    }
  }, [status]);

  function clearScheduledAudio() {
    for (const s of scheduledRef.current) {
      try {
        s.stop();
      } catch {}
    }
    scheduledRef.current = [];
    nextStartRef.current = 0;
    setAiSpeaking(false);
  }

  function playAudioChunk(b64: string) {
    const ctx = outCtxRef.current;
    if (!ctx) return;
    const int16 = base64ToInt16Array(b64);
    if (int16.length === 0) return;
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const start = Math.max(now, nextStartRef.current);
    src.start(start);
    nextStartRef.current = start + buffer.duration;
    setAiSpeaking(true);

    scheduledRef.current.push(src);
    src.onended = () => {
      scheduledRef.current = scheduledRef.current.filter((s) => s !== src);
      if (scheduledRef.current.length === 0) setAiSpeaking(false);
    };
  }

  function handleMessage(msg: ServerMessage) {
    const content = msg.serverContent;
    if (!content) return;

    if (content.interrupted) {
      // El usuario habló por encima de la IA: cortamos lo que estaba sonando.
      clearScheduledAudio();
    }

    if (content.inputTranscription?.text) {
      setCaption("Vos: " + content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      outCaptionRef.current += content.outputTranscription.text;
      setCaption("JDmedIA: " + outCaptionRef.current);
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      const mime = part.inlineData?.mimeType ?? "";
      if (data && mime.startsWith("audio/")) {
        playAudioChunk(data);
      }
    }

    if (content.turnComplete) {
      outCaptionRef.current = "";
    }
  }

  async function start() {
    setError(null);
    setStatus("connecting");
    outCaptionRef.current = "";
    try {
      // 1) Token efímero del servidor (gated a la cuenta dueña)
      const res = await fetch("/api/jdmedia/live-token", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status} pidiendo token`);
      }
      const { token, model, voice, languageCode, systemInstruction } =
        (await res.json()) as {
          token: string;
          model: string;
          voice: string;
          languageCode: string;
          systemInstruction: string;
        };

      // 2) Capturar pantalla y micrófono
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      // si el usuario corta el compartir desde el chrome del navegador → colgamos
      screenStream.getVideoTracks()[0]?.addEventListener("ended", () => hangUp());

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;
      // (el preview se adjunta vía useEffect cuando status pasa a "live")

      // 3) Conectar a Gemini Live con el token efímero (directo desde el browser)
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = (await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: {
            languageCode,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => setStatus("live"),
          onmessage: (m: unknown) => handleMessage(m as ServerMessage),
          onerror: (e: unknown) => {
            const m = e instanceof Error ? e.message : "Error de conexión";
            setError(m);
            setStatus("error");
          },
          onclose: () => {
            if (sessionRef.current) hangUp();
          },
        },
      })) as unknown as LiveSession;
      sessionRef.current = session;

      // 4) Pipeline de audio de entrada: mic → PCM16 16kHz → Gemini
      const inCtx = new AudioContext({ sampleRate: 16000 });
      inCtxRef.current = inCtx;
      const sourceNode = inCtx.createMediaStreamSource(micStream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      // GainNode a 0 para que el processor corra sin generar eco en los parlantes
      const muteGain = inCtx.createGain();
      muteGain.gain.value = 0;
      muteGainRef.current = muteGain;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || !micOnRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(input);
        const b64 = arrayBufferToBase64(pcm16.buffer);
        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
          });
        } catch {}
      };
      sourceNode.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(inCtx.destination);

      // 5) Contexto de salida (reproducción de la voz de la IA, 24kHz)
      outCtxRef.current = new AudioContext({ sampleRate: 24000 });

      // 6) Pipeline de video: pantalla → JPEG 1 fps → Gemini
      const videoEl = document.createElement("video");
      videoEl.srcObject = screenStream;
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
      videoElRef.current = videoEl;
      const canvas = document.createElement("canvas");
      canvasRef.current = canvas;

      frameTimerRef.current = setInterval(() => {
        const v = videoElRef.current;
        const c = canvasRef.current;
        const sess = sessionRef.current;
        if (!v || !c || !sess || v.videoWidth === 0) return;
        // limitar el lado más largo a 1024px para no inflar tokens
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        const ctx2d = c.getContext("2d");
        if (!ctx2d) return;
        ctx2d.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(
          async (blob) => {
            if (!blob || !sessionRef.current) return;
            const buf = await blob.arrayBuffer();
            const b64 = arrayBufferToBase64(buf);
            try {
              sessionRef.current.sendRealtimeInput({
                video: { data: b64, mimeType: "image/jpeg" },
              });
            } catch {}
          },
          "image/jpeg",
          0.6
        );
      }, 1000);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m);
      setStatus("error");
      stopAll();
    }
  }

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    micOnRef.current = next;
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

  const isLive = status === "live";
  const isConnecting = status === "connecting";

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Radio
          className={cn(
            "h-5 w-5",
            isLive ? "text-red-500" : "text-muted-foreground"
          )}
        />
        <h1 className="text-lg font-semibold">JDmedIA en vivo</h1>
        {isLive && (
          <span className="ml-1 flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            EN VIVO
          </span>
        )}
      </div>

      {status === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <MonitorUp className="h-12 w-12 text-muted-foreground" />
          <div className="max-w-md space-y-1">
            <p className="text-base font-medium">
              Compartí tu pantalla y hablá con la IA
            </p>
            <p className="text-sm text-muted-foreground">
              Te va a ver la pantalla y guiar por voz, paso a paso. Ideal para
              configurar Meta Ads y resolver dudas en el momento. Vas a tener que
              permitir el acceso al micrófono y elegir qué pantalla compartir.
            </p>
          </div>
          <Button size="lg" onClick={start}>
            <MonitorUp className="mr-2 h-4 w-4" /> Iniciar sesión en vivo
          </Button>
        </div>
      )}

      {isConnecting && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Conectando… permití micrófono y pantalla.</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-md text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={() => setStatus("idle")}>
            Volver a intentar
          </Button>
        </div>
      )}

      {isLive && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="relative flex-1 overflow-hidden rounded-xl border bg-black">
            <video
              ref={previewRef}
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            <div
              className={cn(
                "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur transition",
                aiSpeaking
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-black/50 text-white"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  aiSpeaking ? "animate-pulse bg-white" : "bg-white/50"
                )}
              />
              {aiSpeaking ? "JDmedIA hablando…" : "Escuchando"}
            </div>
          </div>

          {caption && (
            <p className="line-clamp-2 text-center text-sm text-muted-foreground">
              {caption}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 pb-2">
            <Button
              variant={micOn ? "outline" : "secondary"}
              size="lg"
              onClick={toggleMic}
            >
              {micOn ? (
                <>
                  <Mic className="mr-2 h-4 w-4" /> Mic activo
                </>
              ) : (
                <>
                  <MicOff className="mr-2 h-4 w-4" /> Mic silenciado
                </>
              )}
            </Button>
            <Button variant="destructive" size="lg" onClick={hangUp}>
              <PhoneOff className="mr-2 h-4 w-4" /> Terminar
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Sesión privada de {userName}. La pantalla se envía a ~1 cuadro por segundo
        mientras la sesión está activa.
      </p>
    </div>
  );
}
