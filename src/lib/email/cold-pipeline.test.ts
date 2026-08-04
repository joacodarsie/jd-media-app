import { describe, it, expect } from "vitest";
import { campanasParaEncolar } from "./cold-pipeline";

const conMensaje = {
  primer_mensaje: "Hola [EMPRESA], te escribo de JD Media.",
  alternativa: "",
  seguimiento_1: "",
  seguimiento_2: "",
  elegido: "primer_mensaje" as const,
};

/** Una campaña recién creada: el jsonb existe pero está vacío. */
const sinTexto = {
  primer_mensaje: "",
  alternativa: "",
  seguimiento_1: "",
  seguimiento_2: "",
};

describe("campanasParaEncolar", () => {
  it("encola las activas que tienen mensaje elegido", () => {
    const r = campanasParaEncolar([
      { id: "1", nombre: "Gimnasios", estado: "activa", mensajes_plantilla: conMensaje },
    ]);
    expect(r.map((c) => c.id)).toEqual(["1"]);
  });

  it("no toca las pausadas: pausar es una decisión del dueño", () => {
    const r = campanasParaEncolar([
      { id: "1", nombre: "Gimnasios", estado: "pausada", mensajes_plantilla: conMensaje },
    ]);
    expect(r).toEqual([]);
  });

  it("saltea las que no tienen mensaje todavía", () => {
    const r = campanasParaEncolar([
      { id: "1", nombre: "Nueva", estado: "activa", mensajes_plantilla: null },
      { id: "2", nombre: "Vacía", estado: "activa" },
      { id: "3", nombre: "Sin texto", estado: "activa", mensajes_plantilla: sinTexto },
    ]);
    expect(r).toEqual([]);
  });

  it("con varias campañas devuelve solo las que van", () => {
    const r = campanasParaEncolar([
      { id: "1", nombre: "Va", estado: "activa", mensajes_plantilla: conMensaje },
      { id: "2", nombre: "Pausada", estado: "pausada", mensajes_plantilla: conMensaje },
      { id: "3", nombre: "Sin mensaje", estado: "activa", mensajes_plantilla: null },
    ]);
    expect(r.map((c) => c.id)).toEqual(["1"]);
  });
});
