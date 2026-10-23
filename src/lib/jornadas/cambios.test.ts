import { describe, expect, it } from "vitest";
import { cambiosJornada } from "./cambios";

const n = {
  persona: (id: string) => ({ c: "Carlos", b: "Belén", l: "Luz" })[id] ?? id,
  cliente: (id: string) => ({ d: "Dalhan", w: "Warrior" })[id] ?? id,
  plata: (x: number) => `$${x.toLocaleString("es-AR")}`,
};

describe("historial de una jornada", () => {
  it("una línea por cada dato que cambió, con el antes y el después", () => {
    const antes = { fecha: "2026-10-22", hora_inicio: "10:00", horas: "1.0", monto: "70000.00", cliente_id: "d", asistentes: ["c", "b"], viaticos_detalle: {}, viaticos_los_paga: "agencia", notas: null };
    const despues = { fecha: "2026-10-22", hora_inicio: "11:30", horas: 2, monto: 105000, cliente_id: "d", asistentes: ["c", "l"], viaticos_detalle: { c: 20000, l: 0 }, viaticos_los_paga: "cliente", notas: "Grabamos 6 reels" };
    expect(cambiosJornada(antes, despues, n)).toEqual([
      "Hora: 10:00 h → 11:30 h",
      "Duración: 1 h → 2 h",
      "Trabajo: $70.000 → $105.000",
      "Acompaña: Belén → Luz",
      "Viáticos de Carlos: $0 → $20.000",
      "Viáticos los paga: la agencia → el cliente",
      "Notas: — → «Grabamos 6 reels»",
    ]);
  });

  it("si no cambió nada, no anota nada (aunque los números vengan como texto)", () => {
    const fila = { fecha: "2026-10-22", horas: "2.0", monto: "105000.00", asistentes: ["c"], viaticos_detalle: { c: 5000 } };
    expect(cambiosJornada(fila, { ...fila, horas: 2, monto: 105000 }, n)).toEqual([]);
  });

  it("fecha y cliente, legibles", () => {
    expect(cambiosJornada({ fecha: "2026-10-22", cliente_id: "d" }, { fecha: "2026-10-24", cliente_id: "w" }, n)).toEqual([
      "Fecha: 22/10/2026 → 24/10/2026",
      "Cliente: Dalhan → Warrior",
    ]);
  });
});
