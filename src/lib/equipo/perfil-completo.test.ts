import { describe, expect, it } from "vitest";
import { datosDelPerfil, perfilCompleto } from "./perfil-completo";

const vacio = {
  nombre: "Sofía",
  avatar_url: null,
  telefono: null,
  whatsapp_phone: null,
  alias_cbu: null,
  cbu: null,
  titular_cuenta: null,
  dni_cuit: null,
  condicion_fiscal: null,
  domicilio: null,
  acceso_confirmado_at: null,
};

describe("perfil completo", () => {
  it("cada dato se marca solo cuando está cargado", () => {
    expect(datosDelPerfil(vacio).filter((d) => d.hecho)).toEqual([]);
    const algo = datosDelPerfil({ ...vacio, nombre: "Sofía Pissane", whatsapp_phone: "351", alias_cbu: "sofi.mp", titular_cuenta: "Sofía Pissane" });
    expect(algo.filter((d) => d.hecho).map((d) => d.clave)).toEqual(["nombre", "telefono", "cobro"]);
  });
  it("completo con todo", () => {
    expect(
      perfilCompleto({
        ...vacio,
        nombre: "Sofía Pissane",
        avatar_url: "x",
        telefono: "351",
        cbu: "1",
        titular_cuenta: "S",
        dni_cuit: "27-1",
        condicion_fiscal: "monotributo",
        domicilio: "Córdoba",
        acceso_confirmado_at: "2026-10-19",
      })
    ).toBe(true);
    expect(perfilCompleto(vacio)).toBe(false);
  });
});
