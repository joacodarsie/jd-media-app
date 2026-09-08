import { describe, it, expect } from "vitest";
import {
  quienLlevaba,
  responsablesDelPeriodo,
  repartir,
  diasDelMes,
  type Asignacion,
} from "./asignaciones";

const MILE = "mile";
const BELEN = "belen";

// El caso real que motivó esto: Magic pasó de Milena a Belén el 1/9/2026.
const magic: Asignacion[] = [
  { clienteId: "magic", rol: "cm", userId: MILE, desde: "2026-05-01", hasta: "2026-08-31" },
  { clienteId: "magic", rol: "cm", userId: BELEN, desde: "2026-09-01", hasta: null },
];

describe("diasDelMes", () => {
  it("sabe los días de cada mes, febrero incluido", () => {
    expect(diasDelMes("2026-08")).toBe(31);
    expect(diasDelMes("2026-09")).toBe(30);
    expect(diasDelMes("2026-02")).toBe(28);
    expect(diasDelMes("2028-02")).toBe(29);
  });
});

describe("quienLlevaba", () => {
  it("agosto sigue siendo de Milena, aunque hoy la cuenta la lleve otra", () => {
    expect(quienLlevaba(magic, "magic", "cm", "2026-08")).toEqual([
      { userId: MILE, dias: 31, fraccion: 1 },
    ]);
  });

  it("septiembre es de Belén", () => {
    expect(quienLlevaba(magic, "magic", "cm", "2026-09")[0].userId).toBe(BELEN);
  });

  it("un pase a mitad de mes reparte por días", () => {
    const aMitad: Asignacion[] = [
      { clienteId: "x", rol: "cm", userId: MILE, desde: "2026-01-01", hasta: "2026-08-10" },
      { clienteId: "x", rol: "cm", userId: BELEN, desde: "2026-08-11", hasta: null },
    ];
    const r = quienLlevaba(aMitad, "x", "cm", "2026-08");
    expect(r[0]).toMatchObject({ userId: BELEN, dias: 21 });
    expect(r[1]).toMatchObject({ userId: MILE, dias: 10 });
    expect(r[0].dias + r[1].dias).toBe(31);
  });

  it("si nadie la llevaba ese mes, no cobra nadie", () => {
    expect(quienLlevaba(magic, "magic", "cm", "2026-03")).toEqual([]);
  });

  it("no mezcla cuentas ni roles", () => {
    expect(quienLlevaba(magic, "otra", "cm", "2026-08")).toEqual([]);
    expect(quienLlevaba(magic, "magic", "disenador", "2026-08")).toEqual([]);
  });

  it("suma los tramos si la misma persona la tuvo, la soltó y la retomó", () => {
    const ida: Asignacion[] = [
      { clienteId: "y", rol: "cm", userId: MILE, desde: "2026-08-01", hasta: "2026-08-05" },
      { clienteId: "y", rol: "cm", userId: BELEN, desde: "2026-08-06", hasta: "2026-08-20" },
      { clienteId: "y", rol: "cm", userId: MILE, desde: "2026-08-21", hasta: null },
    ];
    const r = quienLlevaba(ida, "y", "cm", "2026-08");
    expect(r.find((x) => x.userId === MILE)!.dias).toBe(16);
    expect(r.find((x) => x.userId === BELEN)!.dias).toBe(15);
  });
});

describe("responsablesDelPeriodo", () => {
  it("sin historial usa el responsable actual: las cuentas que nunca se pasaron no cambian", () => {
    expect(responsablesDelPeriodo([], "otra", "cm", "2026-08", "alguien")).toEqual([
      { userId: "alguien", dias: 31, fraccion: 1 },
    ]);
  });

  it("con historial manda el historial, aunque hoy la lleve otro", () => {
    expect(responsablesDelPeriodo(magic, "magic", "cm", "2026-08", BELEN)[0].userId).toBe(MILE);
  });

  it("con historial pero sin tenencia ese mes, no cobra nadie", () => {
    expect(responsablesDelPeriodo(magic, "magic", "cm", "2026-03", BELEN)).toEqual([]);
  });

  it("sin historial y sin responsable cargado, tampoco", () => {
    expect(responsablesDelPeriodo([], "x", "cm", "2026-08", null)).toEqual([]);
  });
});

describe("repartir", () => {
  it("uno solo se lleva todo", () => {
    const t = { userId: MILE, dias: 31, fraccion: 1 };
    expect(repartir(50000, [t])).toEqual([{ userId: MILE, monto: 50000, tenencia: t }]);
  });

  it("dos se reparten sin perder un peso por el redondeo", () => {
    const t = [
      { userId: BELEN, dias: 21, fraccion: 21 / 31 },
      { userId: MILE, dias: 10, fraccion: 10 / 31 },
    ];
    const r = repartir(50000, t);
    expect(r.reduce((a, x) => a + x.monto, 0)).toBe(50000);
    expect(r[0].monto).toBeGreaterThan(r[1].monto);
  });

  it("sin nadie, no reparte nada", () => {
    expect(repartir(50000, [])).toEqual([]);
  });
});
