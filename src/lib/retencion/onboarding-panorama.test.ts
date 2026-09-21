import { describe, it, expect } from "vitest";
import {
  panoramaDeArranques,
  resumenDeArranques,
  type ArranqueCrudo,
  type PasoCrudo,
} from "./onboarding-panorama";

const HOY = "2026-09-20";

const paso = (over: Partial<PasoCrudo> = {}): PasoCrudo => ({
  id: "s1",
  numero: 1,
  titulo: "Reunión de diagnóstico",
  estado: "pendiente",
  area: "Coordinación",
  fecha_limite: "2026-09-15",
  asignado_nombre: "Luz Torres",
  ...over,
});

const arranque = (over: Partial<ArranqueCrudo> = {}): ArranqueCrudo => ({
  ticketId: "t1",
  numero: 900,
  clienteId: "c1",
  clienteNombre: "Blasco",
  fechaInicio: "2026-09-14",
  pasos: [paso()],
  ...over,
});

describe("panoramaDeArranques", () => {
  it("calcula en qué día del arranque está la cuenta", () => {
    // El plan fecha el paso del día N como inicio + N, así que arrancó el 14
    // y el 20 va por el día 6.
    const [f] = panoramaDeArranques([arranque()], HOY);
    expect(f.diaActual).toBe(6);
    expect(f.fechaFin).toBe("2026-09-29");
  });

  it("ubica cada paso en su día", () => {
    const [f] = panoramaDeArranques(
      [
        arranque({
          pasos: [
            paso({ id: "a", fecha_limite: "2026-09-14" }),
            paso({ id: "b", fecha_limite: "2026-09-20", titulo: "Destacadas" }),
          ],
        }),
      ],
      HOY
    );
    expect(f.pasos.map((p) => p.dia)).toEqual([1, 6]);
  });

  it("un paso vencido y sin hacer está atrasado; el de hoy todavía no", () => {
    const [f] = panoramaDeArranques(
      [
        arranque({
          pasos: [
            paso({ id: "a", fecha_limite: "2026-09-15" }),
            paso({ id: "b", fecha_limite: HOY, titulo: "Hoy" }),
          ],
        }),
      ],
      HOY
    );
    expect(f.pasos.find((p) => p.id === "a")!.atrasado).toBe(true);
    expect(f.pasos.find((p) => p.id === "b")!.atrasado).toBe(false);
    expect(f.atrasados).toBe(1);
  });

  it("un paso hecho no está atrasado aunque haya vencido", () => {
    const [f] = panoramaDeArranques(
      [arranque({ pasos: [paso({ estado: "completada" })] })],
      HOY
    );
    expect(f.atrasados).toBe(0);
    expect(f.terminado).toBe(true);
    expect(f.pct).toBe(1);
  });

  it("archivada cuenta como hecha: alguien decidió que ya no va", () => {
    const [f] = panoramaDeArranques(
      [arranque({ pasos: [paso({ estado: "archivada" })] })],
      HOY
    );
    expect(f.terminado).toBe(true);
  });

  it("pasados los 15 días con cosas sin hacer, queda marcado como vencido", () => {
    const [f] = panoramaDeArranques(
      [arranque({ fechaInicio: "2026-08-20" })],
      HOY
    );
    expect(f.vencido).toBe(true);
  });

  it("terminado no se marca como vencido aunque hayan pasado los 15 días", () => {
    const [f] = panoramaDeArranques(
      [arranque({ fechaInicio: "2026-08-20", pasos: [paso({ estado: "completada" })] })],
      HOY
    );
    expect(f.vencido).toBe(false);
  });

  it("ordena primero lo que tiene más atraso y manda lo terminado al final", () => {
    const filas = panoramaDeArranques(
      [
        arranque({
          ticketId: "ok",
          clienteNombre: "Terminado",
          pasos: [paso({ estado: "completada" })],
        }),
        arranque({
          ticketId: "uno",
          clienteNombre: "Un atraso",
          pasos: [paso({ id: "x", fecha_limite: "2026-09-15" })],
        }),
        arranque({
          ticketId: "dos",
          clienteNombre: "Dos atrasos",
          pasos: [
            paso({ id: "y", fecha_limite: "2026-09-15" }),
            paso({ id: "z", fecha_limite: "2026-09-16", titulo: "Otro" }),
          ],
        }),
      ],
      HOY
    );
    expect(filas.map((f) => f.clienteNombre)).toEqual([
      "Dos atrasos",
      "Un atraso",
      "Terminado",
    ]);
  });

  it("un arranque sin pasos no rompe los porcentajes", () => {
    const [f] = panoramaDeArranques([arranque({ pasos: [] })], HOY);
    expect(f.pct).toBe(0);
    expect(f.terminado).toBe(false);
  });
});

describe("resumenDeArranques", () => {
  it("cuenta solo lo que sigue en curso", () => {
    const filas = panoramaDeArranques(
      [
        arranque({ ticketId: "a", pasos: [paso({ estado: "completada" })] }),
        arranque({ ticketId: "b", clienteNombre: "CATCH" }),
      ],
      HOY
    );
    expect(resumenDeArranques(filas)).toEqual({
      enCurso: 1,
      conAtraso: 1,
      pasosAtrasados: 1,
    });
  });
});
