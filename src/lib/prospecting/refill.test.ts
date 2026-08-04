import { describe, it, expect } from "vitest";
import {
  CIUDADES,
  PISO_SIN_ESCRIBIR,
  campanasAReabastecer,
  zonaDelDia,
  type CampanaRefill,
} from "./refill";

const camp = (over: Partial<CampanaRefill> & { id: string }): CampanaRefill => ({
  nombre: over.id,
  rubro: "Gimnasios",
  ubicacion: "Córdoba, Argentina",
  estado: "activa",
  ...over,
});

describe("zonaDelDia", () => {
  it("respeta la zona de la campaña si la tiene", () => {
    expect(zonaDelDia("Rosario, Argentina", "2026-08-04")).toBe("Rosario, Argentina");
  });

  it("sin zona propia rota por ciudad según el día", () => {
    const a = zonaDelDia(null, "2026-08-04");
    const b = zonaDelDia(null, "2026-08-05");
    expect(CIUDADES).toContain(a);
    expect(CIUDADES).toContain(b);
    expect(a).not.toBe(b); // dos días seguidos no piden lo mismo
  });

  it("el mismo día siempre da la misma ciudad (idempotente si el cron corre dos veces)", () => {
    expect(zonaDelDia(null, "2026-08-04")).toBe(zonaDelDia(null, "2026-08-04"));
  });

  it("una zona en blanco cuenta como sin zona", () => {
    expect(CIUDADES).toContain(zonaDelDia("   ", "2026-08-04"));
  });
});

describe("campanasAReabastecer", () => {
  it("reabastece la que se está quedando sin contactos", () => {
    const r = campanasAReabastecer([camp({ id: "a" })], { a: 3 });
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("no toca la que todavía tiene cola", () => {
    const r = campanasAReabastecer([camp({ id: "a" })], { a: PISO_SIN_ESCRIBIR + 10 });
    expect(r).toEqual([]);
  });

  it("ignora las pausadas y las que no tienen rubro", () => {
    const r = campanasAReabastecer(
      [
        camp({ id: "pausada", estado: "pausada" }),
        camp({ id: "sin-rubro", rubro: "" }),
        camp({ id: "nula", rubro: null }),
      ],
      {}
    );
    expect(r).toEqual([]);
  });

  it("empieza por la más vacía", () => {
    const r = campanasAReabastecer(
      [camp({ id: "media" }), camp({ id: "vacia" }), camp({ id: "casi" })],
      { media: 20, vacia: 0, casi: 35 }
    );
    expect(r.map((c) => c.id)).toEqual(["vacia", "media", "casi"]);
  });

  it("no reabastece más de las que entran en el presupuesto del día", () => {
    const muchas = ["a", "b", "c", "d", "e"].map((id) => camp({ id }));
    expect(campanasAReabastecer(muchas, {}, 2)).toHaveLength(2);
  });

  it("una campaña nueva sin contactos entra sola, sin tocar código", () => {
    const r = campanasAReabastecer([camp({ id: "recien-creada" })], {});
    expect(r.map((c) => c.id)).toEqual(["recien-creada"]);
  });
});
