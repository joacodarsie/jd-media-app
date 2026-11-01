import { describe, expect, it } from "vitest";
import { alertaReunion } from "./reunion-salud";

describe("alertaReunion", () => {
  it("no le reclama a una cuenta nueva", () => {
    expect(alertaReunion(20, null)).toBeNull();
  });
  it("marca la cuenta que nunca tuvo reunión", () => {
    expect(alertaReunion(60, null)?.texto).toBe("Nunca tuvo una reunión registrada");
  });
  it("marca recién a los 45 días de la última", () => {
    expect(alertaReunion(200, 44)).toBeNull();
    expect(alertaReunion(200, 45)?.puntos).toBe(2);
  });
});
