import { describe, expect, it } from "vitest";
import { armarLineaDeTiempo, type DatosLinea } from "./linea-tiempo";

const base: DatosLinea = {
  fechaInicio: "2026-09-14",
  arranque: { terminadoEl: "2026-09-30T15:00:00Z", hechos: 14, total: 14 },
  primeraPieza: "2026-10-06T19:00:00Z",
  piezas: 12,
  reuniones: ["2026-10-12"],
  primerCobro: "2026-09-15",
  seguidores: { inicio: 1000, hoy: 1180, fecha: "2026-10-17" },
};

describe("armarLineaDeTiempo", () => {
  it("ordena los hitos y cierra con hoy", () => {
    const h = armarLineaDeTiempo(base, "2026-10-18");
    expect(h.map((x) => x.tipo)).toEqual(["alta", "cobro", "arranque", "pieza", "reunion", "crecimiento", "hoy"]);
    expect(h.find((x) => x.tipo === "arranque")?.detalle).toBe("en 16 días");
    expect(h.find((x) => x.tipo === "pieza")?.detalle).toBe("día 23");
    expect(h.find((x) => x.tipo === "crecimiento")?.titulo).toBe("+180 seguidores");
    expect(h.at(-1)).toEqual({ fecha: "2026-10-18", tipo: "hoy", titulo: "Hoy · día 35", detalle: "12 piezas publicadas" });
  });

  it("una cuenta que recién arranca muestra lo que falta del arranque", () => {
    const h = armarLineaDeTiempo(
      { ...base, fechaInicio: "2026-10-16", arranque: { terminadoEl: null, hechos: 2, total: 17 }, primeraPieza: null, piezas: 0, reuniones: [], primerCobro: null, seguidores: null },
      "2026-10-18"
    );
    expect(h.map((x) => x.tipo)).toEqual(["alta", "hoy"]);
    expect(h[1].detalle).toBe("arranque: 2 de 17 pasos");
  });

  it("sin fecha de inicio no hay línea, y las reuniones de antes del alta no cuentan", () => {
    expect(armarLineaDeTiempo({ ...base, fechaInicio: null }, "2026-10-18")).toEqual([]);
    const h = armarLineaDeTiempo({ ...base, reuniones: ["2026-08-01", "2026-10-12", "2026-11-12"] }, "2026-10-18");
    expect(h.filter((x) => x.tipo === "reunion")).toHaveLength(1);
  });
});
