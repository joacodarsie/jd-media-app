import { describe, expect, it } from "vitest";
import { credencialDeRed, esDeLaRed, estadoAcceso, guardarAccesoDeRed, NOTA_NO_TIENE, queFalta } from "./redes-onboarding";

describe("accesos por red del arranque", () => {
  it("reconoce cómo escribe el equipo cada red", () => {
    expect(esDeLaRed({ servicio: "IG" }, "instagram")).toBe(true);
    expect(esDeLaRed({ servicio: "Instagram marca" }, "instagram")).toBe(true);
    expect(esDeLaRed({ servicio: "", url: "https://www.instagram.com/x" }, "instagram")).toBe(true);
    expect(esDeLaRed({ servicio: "Tik Tok" }, "tiktok")).toBe(true);
    expect(esDeLaRed({ servicio: "Página de Facebook" }, "facebook")).toBe(true);
    expect(esDeLaRed({ servicio: "Facebook" }, "facebook")).toBe(true);
    expect(esDeLaRed({ servicio: "Meta Business Suite", url: "https://business.facebook.com" }, "facebook")).toBe(false);
    expect(esDeLaRed({ servicio: "Facebook Ads" }, "facebook")).toBe(false);
    expect(esDeLaRed({ servicio: "Gmail" }, "instagram")).toBe(false);
  });

  it("listo con link y usuario; a medias o falta si no; «no tiene» cuenta como hecho", () => {
    expect(estadoAcceso(null)).toBe("falta");
    expect(estadoAcceso({ url: "https://instagram.com/x", usuario: "@x" })).toBe("listo");
    expect(estadoAcceso({ usuario: "@x", password: "p" })).toBe("a_medias");
    expect(estadoAcceso({ notas: NOTA_NO_TIENE })).toBe("no_tiene");
    expect(queFalta({ usuario: "@x" })).toBe("Falta el link.");
    expect(queFalta(null)).toBe("Falta el link y el usuario.");
    expect(queFalta({ url: "u", usuario: "x" })).toBeNull();
  });

  it("guardar actualiza la fila de la red, no pisa la contraseña si viene vacía y deja el resto", () => {
    const lista = [
      { servicio: "IG", usuario: "@viejo", password: "secreta", url: "", notas: "" },
      { servicio: "Gmail", usuario: "a@b.com", password: "x", url: "", notas: "" },
    ];
    const r = guardarAccesoDeRed(lista, "instagram", { url: "https://instagram.com/marca", usuario: "@marca", password: "", notas: "con 2FA" });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ servicio: "IG", url: "https://instagram.com/marca", usuario: "@marca", password: "secreta", notas: "con 2FA" });
    expect(r[1]).toEqual(lista[1]);
    expect(estadoAcceso(credencialDeRed(r, "instagram"))).toBe("listo");
  });

  it("agrega la red si no estaba, y «no tiene» la marca sin datos", () => {
    const r = guardarAccesoDeRed([], "tiktok", { noTiene: true, notas: "no le interesa" });
    expect(r).toEqual([{ servicio: "TikTok", usuario: "", password: "", url: "", notas: `${NOTA_NO_TIENE} no le interesa` }]);
    expect(estadoAcceso(credencialDeRed(r, "tiktok"))).toBe("no_tiene");
    // Si después aparece la cuenta, se carga y deja de decir que no tiene.
    const r2 = guardarAccesoDeRed(r, "tiktok", { url: "https://tiktok.com/@m", usuario: "@m", notas: r[0].notas });
    expect(estadoAcceso(credencialDeRed(r2, "tiktok"))).toBe("listo");
    expect(r2[0].notas).toBe("no le interesa");
  });
});
