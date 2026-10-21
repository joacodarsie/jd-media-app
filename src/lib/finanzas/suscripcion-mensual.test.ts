import { describe, expect, it } from "vitest";
import { costoMensual } from "./suscripcion-mensual";

describe("costoMensual", () => {
  it("divide según el ciclo", () => {
    expect(costoMensual({ costo: 120, ciclo: "anual" })).toBe(10);
    expect(costoMensual({ costo: 90, ciclo: "trimestral" })).toBe(30);
    expect(costoMensual({ costo: 50, ciclo: "mensual" })).toBe(50);
    expect(costoMensual({ costo: 50, ciclo: "raro" })).toBe(50);
  });
});
