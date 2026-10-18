import { describe, expect, it } from "vitest";
import { estadoDeRedes, unirCredenciales, type Credencial } from "./portal";

const vieja: Credencial = { servicio: "Instagram", usuario: "marca", password: "vieja", url: "", notas: "" };

describe("unirCredenciales", () => {
  it("pisa la misma red y suma las nuevas", () => {
    const r = unirCredenciales([vieja], [
      { red: "instagram", tiene: true, usuario: "marca.oficial", password: "nueva" },
      { red: "tiktok", tiene: true, usuario: "marcatk", password: "x" },
    ], "17/10/2026");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ servicio: "Instagram", usuario: "marca.oficial", password: "nueva" });
    expect(r[1]).toMatchObject({ servicio: "TikTok", usuario: "marcatk" });
  });

  it("si no escribe contraseña, conserva la que había", () => {
    const r = unirCredenciales([vieja], [{ red: "instagram", tiene: true, usuario: "marca", password: "" }], "17/10/2026");
    expect(r[0].password).toBe("vieja");
  });

  it("«no la tengo» queda anotado sin usuario ni contraseña", () => {
    const r = unirCredenciales([], [{ red: "facebook", tiene: false }], "17/10/2026");
    expect(r[0]).toMatchObject({ servicio: "Facebook", usuario: "", password: "" });
    expect(estadoDeRedes(r).facebook).toBe("sin_cuenta");
    expect(estadoDeRedes(r).instagram).toBe("falta");
  });

  it("una carga vacía no agrega nada", () => {
    expect(unirCredenciales([], [{ red: "tiktok", tiene: true }], "17/10/2026")).toEqual([]);
  });
});
