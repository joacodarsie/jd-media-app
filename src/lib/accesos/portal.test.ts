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

describe("portal ↔ onboarding de la community", () => {
  it("lo que carga el cliente marca solo el paso de la CM", async () => {
    const { credencialDeRed, estadoAcceso } = await import("./redes-onboarding");
    const r = unirCredenciales([], [{ red: "instagram", tiene: true, usuario: "marca", password: "x" }], "24/10/2026");
    expect(estadoAcceso(credencialDeRed(r, "instagram"))).toBe("listo");
  });

  it("lo que carga la CM (aunque lo escriba «IG») no se le vuelve a pedir al cliente y no se duplica", () => {
    const cm: Credencial = { servicio: "IG", usuario: "marca", password: "p", url: "https://instagram.com/marca", notas: "" };
    expect(estadoDeRedes([cm]).instagram).toBe("cargada");
    const r = unirCredenciales([cm], [{ red: "instagram", tiene: true, usuario: "marca2", password: "" }], "24/10/2026");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ servicio: "IG", usuario: "marca2", password: "p", url: "https://instagram.com/marca" });
  });

  it("si la CM marcó que no tiene la red, el portal no la pide", () => {
    const r: Credencial[] = [{ servicio: "TikTok", usuario: "", password: "", url: "", notas: "El cliente no tiene esta red." }];
    expect(estadoDeRedes(r).tiktok).toBe("sin_cuenta");
  });

  it("cuando se crea la cuenta que no tenía, pasa a cargada", () => {
    const r: Credencial[] = [{ servicio: "TikTok", usuario: "marca", password: "p", url: "", notas: "No tiene cuenta todavía: la crea JD Media." }];
    expect(estadoDeRedes(r).tiktok).toBe("cargada");
  });
});
