import { describe, it, expect } from "vitest";
import { lineaDeServicio } from "./linea-de-servicio";

describe("lineaDeServicio", () => {
  it("gestión de redes manda aunque tenga extras", () => {
    expect(lineaDeServicio(["gestion_redes", "gestion_whatsapp", "chatter"])).toBe("redes");
    expect(lineaDeServicio(["gestion_redes", "google_ads"])).toBe("redes"); // Warrior
  });
  it("solo publicidad (Origen Studio: pauta + edición)", () => {
    expect(lineaDeServicio(["paid_media", "edicion_audiovisual"])).toBe("publicidad");
    expect(lineaDeServicio(["google_ads"])).toBe("publicidad");
  });
  it("el Pack Marca Real es branding", () => {
    expect(lineaDeServicio(["branding"])).toBe("marca"); // Simple Snack
    expect(lineaDeServicio(["diseno_grafico"])).toBe("marca");
  });
  it("web, audiovisual, otros y sin servicio", () => {
    expect(lineaDeServicio(["desarrollo_web"])).toBe("web");
    expect(lineaDeServicio(["edicion_audiovisual"])).toBe("audiovisual");
    expect(lineaDeServicio(["consultoria"])).toBe("otros");
    expect(lineaDeServicio([])).toBe("sin_servicio");
  });
});
