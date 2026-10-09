import { describe, expect, it } from "vitest";
import { canalDelMensaje, canalesDe, channelLabel, normalizarCanales } from "./shared";

describe("canales de una campaña", () => {
  it("las campañas viejas con un solo canal siguen igual", () => {
    expect(canalesDe("whatsapp")).toEqual(["whatsapp"]);
    expect(channelLabel("instagram")).toBe("Instagram (DM)");
  });
  it("varios canales separados por coma, sin repetidos ni inventados", () => {
    expect(canalesDe("whatsapp, instagram,whatsapp,fax")).toEqual(["whatsapp", "instagram"]);
    expect(channelLabel("whatsapp,email")).toBe("WhatsApp · Email");
  });
  it("vacío cae a WhatsApp", () => {
    expect(canalesDe(null)).toEqual(["whatsapp"]);
    expect(normalizarCanales("")).toBe("whatsapp");
  });
  it("se guarda en el orden de la lista", () => {
    expect(normalizarCanales(["email", "whatsapp"])).toBe("whatsapp,email");
  });
  it("el mensaje base se escribe como chat si hay chat; email solo si es el único", () => {
    expect(canalDelMensaje("email,instagram")).toBe("instagram");
    expect(canalDelMensaje("whatsapp,instagram")).toBe("whatsapp");
    expect(canalDelMensaje("email")).toBe("email");
  });
});
