import { describe, it, expect } from "vitest";
import { diaArgentina, horasDeJornada, moverADia, tipoDeReunion } from "./eventos";

describe("tipoDeReunion", () => {
  it("jornada, con cliente o del equipo", () => {
    expect(tipoDeReunion({ tipo: "jornada", client_id: "x" })).toBe("jornada");
    expect(tipoDeReunion({ tipo: "reunion", client_id: "x" })).toBe("reunion_cliente");
    expect(tipoDeReunion({ client_id: null })).toBe("reunion");
  });
});

describe("diaArgentina", () => {
  it("una reunión a las 22 de Argentina sigue siendo ese día aunque en UTC ya sea el siguiente", () => {
    expect(diaArgentina("2026-10-06T01:00:00Z")).toBe("2026-10-05");
    expect(diaArgentina("2026-10-06T13:00:00Z")).toBe("2026-10-06");
  });
});

describe("moverADia", () => {
  it("mantiene hora y duración", () => {
    expect(moverADia({ starts_at: "2026-10-06T13:00:00.000Z", ends_at: "2026-10-06T14:30:00.000Z" }, "2026-10-09")).toEqual({
      starts_at: "2026-10-09T13:00:00.000Z",
      ends_at: "2026-10-09T14:30:00.000Z",
    });
  });

  it("toma el día en Argentina, no en UTC", () => {
    // 22 hs del 5 en Argentina → se suelta en el 7 → 22 hs del 7.
    expect(moverADia({ starts_at: "2026-10-06T01:00:00.000Z", ends_at: "2026-10-06T02:00:00.000Z" }, "2026-10-07")).toEqual({
      starts_at: "2026-10-08T01:00:00.000Z",
      ends_at: "2026-10-08T02:00:00.000Z",
    });
  });

  it("mismo día, nada que hacer", () => {
    expect(moverADia({ starts_at: "2026-10-06T13:00:00Z", ends_at: "2026-10-06T14:00:00Z" }, "2026-10-06")).toBeNull();
  });
});

describe("horasDeJornada", () => {
  it("cobra por hora empezada, mínimo una", () => {
    expect(horasDeJornada("2026-10-06T13:00:00Z", "2026-10-06T14:00:00Z")).toBe(1);
    expect(horasDeJornada("2026-10-06T13:00:00Z", "2026-10-06T15:30:00Z")).toBe(3);
    expect(horasDeJornada("2026-10-06T13:00:00Z", "2026-10-06T13:30:00Z")).toBe(1);
  });
});
