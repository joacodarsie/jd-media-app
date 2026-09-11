import { describe, expect, it } from "vitest";
import { normalizarHandle } from "./ig-handle";

describe("normalizarHandle", () => {
  it("acepta el usuario pelado", () => {
    expect(normalizarHandle("boxescar")).toEqual({
      ok: true,
      handle: "boxescar",
      url: "https://www.instagram.com/boxescar/",
    });
  });

  it("saca el arroba", () => {
    expect(normalizarHandle("@la.azotea_villaberna").handle).toBe("la.azotea_villaberna");
  });

  it("entiende la URL pegada del navegador", () => {
    expect(normalizarHandle("https://www.instagram.com/desafiosansenuza/").handle).toBe(
      "desafiosansenuza"
    );
    expect(normalizarHandle("instagram.com/resonarculture").handle).toBe("resonarculture");
  });

  it("descarta el ?igsh que agrega la app al compartir", () => {
    expect(
      normalizarHandle("https://www.instagram.com/fundanic.arg?igsh=MWZkYTk3&utm_source=qr").handle
    ).toBe("fundanic.arg");
  });

  it("limpia espacios y mayúsculas", () => {
    expect(normalizarHandle("  @JDmedia.Digital  ").handle).toBe("jdmedia.digital");
  });

  it("devuelve también la URL para guardarla en la ficha", () => {
    expect(normalizarHandle("@magic").url).toBe("https://www.instagram.com/magic/");
  });

  it("rechaza el vacío", () => {
    for (const v of ["", "   ", "@", null, undefined]) {
      expect(normalizarHandle(v).ok, `con ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("rechaza lo que no es un usuario", () => {
    expect(normalizarHandle("no tengo idea").ok).toBe(false);
    expect(normalizarHandle("cuenta/con/barras").ok).toBe(false);
    expect(normalizarHandle("a".repeat(31)).ok).toBe(false);
  });

  it("acepta el largo máximo de Instagram", () => {
    expect(normalizarHandle("a".repeat(30)).ok).toBe(true);
  });
});
