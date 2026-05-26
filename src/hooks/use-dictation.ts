"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: (e: { error?: string }) => void;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [k: number]: { transcript: string };
  }> & { length: number };
}

interface Options {
  /** Texto actual del input — se concatena con lo dictado */
  initialText: () => string;
  /** Callback con el texto actualizado (base + interim/final) */
  onText: (text: string) => void;
  /** Idioma (default es-AR) */
  lang?: string;
}

/**
 * Hook para dictado por voz (Web Speech API). Lo mismo que tenia el chat
 * flotante, encapsulado para usar tambien en JDmedIA.
 *
 * No graba audio "real" — solo transcribe localmente. Funciona bien en Chrome
 * y Edge (desktop + Android). Safari (mac e iOS) requiere chrome/edge.
 */
export function useDictation({ initialText, onText, lang = "es-AR" }: Options) {
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  // Cleanup en unmount
  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch {}
      recogRef.current = null;
    };
  }, []);

  function toggle() {
    if (recording) {
      try {
        recogRef.current?.stop();
      } catch {}
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error(
        "Tu navegador no soporta dictado por voz. Usá Chrome o Edge."
      );
      return;
    }
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    let baseline = initialText();
    r.onresult = (ev) => {
      let interim = "";
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (finalText) {
        baseline = (baseline ? baseline + " " : "") + finalText.trim();
        onText(baseline);
      } else {
        onText((baseline ? baseline + " " : "") + interim);
      }
    };
    r.onend = () => {
      setRecording(false);
      recogRef.current = null;
    };
    r.onerror = (e) => {
      setRecording(false);
      recogRef.current = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Necesito permiso del micrófono para dictar.");
      } else if (e.error === "no-speech") {
        toast.info("No te escuché. Probá de nuevo.");
      } else if (e.error && e.error !== "aborted") {
        toast.error("Error en el dictado: " + e.error);
      }
    };
    recogRef.current = r;
    setRecording(true);
    try {
      r.start();
    } catch (e) {
      setRecording(false);
      recogRef.current = null;
      toast.error(
        "No se pudo iniciar el dictado: " +
          (e instanceof Error ? e.message : "error")
      );
    }
  }

  return { recording, toggle };
}
