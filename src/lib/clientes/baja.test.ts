import { describe, expect, it } from "vitest";
import { cuentaSinTrabajo } from "./baja";

describe("cuentaSinTrabajo", () => {
  it("perdido y en pausa no tienen trabajo; activo y propuesta sí", () => {
    expect(cuentaSinTrabajo("perdido")).toBe(true);
    expect(cuentaSinTrabajo("en_pausa")).toBe(true);
    expect(cuentaSinTrabajo("activo")).toBe(false);
    expect(cuentaSinTrabajo("propuesta")).toBe(false);
    expect(cuentaSinTrabajo(undefined)).toBe(false);
  });
});
