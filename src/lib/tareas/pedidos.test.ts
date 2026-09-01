import { describe, it, expect } from "vitest";
import { MOTIVOS, motivoMeta, mensajeParaCoordinacion, mensajeParaSolicitante } from "./pedidos";

describe("motivos", () => {
  it("todos tienen ayuda y sugerencia cargadas", () => {
    for (const m of MOTIVOS) {
      expect(m.label.length).toBeGreaterThan(3);
      expect(m.ayuda.length).toBeGreaterThan(10);
      expect(m.sugerencia.length).toBeGreaterThan(10);
    }
  });

  it("un motivo desconocido cae en 'Otro' en vez de romper", () => {
    expect(motivoMeta("cualquier_cosa").value).toBe("otro");
    expect(motivoMeta("no_me_corresponde").label).toBe("No me corresponde");
  });
});

describe("mensajes", () => {
  it("el aviso a coordinación dice quién, qué y de qué cuenta", () => {
    const m = mensajeParaCoordinacion({
      quien: "Darío",
      motivo: "no_me_corresponde",
      tarea: "Diseñar pieza: Planes en La Azotea",
      cuenta: "La Azotea",
    });
    expect(m).toContain("Darío");
    expect(m).toContain("No me corresponde");
    expect(m).toContain("La Azotea");
  });

  it("sin cuenta no deja paréntesis vacíos", () => {
    const m = mensajeParaCoordinacion({ quien: "Ana", motivo: "otro", tarea: "Revisar algo", cuenta: null });
    expect(m).not.toContain("()");
  });

  it("el aviso al que reportó distingue aprobado de rechazado", () => {
    expect(mensajeParaSolicitante({ aprobada: true, tarea: "X" })).toContain("Resolvimos");
    expect(mensajeParaSolicitante({ aprobada: false, tarea: "X" })).toContain("queda como está");
  });

  it("incluye la nota de quien resolvió cuando la hay", () => {
    const m = mensajeParaSolicitante({ aprobada: true, tarea: "X", nota: "Pasó a Ana" });
    expect(m).toContain("Pasó a Ana");
  });
});
