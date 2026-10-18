import { describe, expect, it } from "vitest";
import { estadoDeMeta, permalinkClave, tocaMedir, valorDelObjetivo } from "./objetivos";

const m = { alcance: 900, likes: 40, comentarios: 6, guardados: 4 };

describe("valorDelObjetivo", () => {
  it("cada objetivo mira su métrica", () => {
    expect(valorDelObjetivo("conocer", m, null)).toBe(900);
    expect(valorDelObjetivo("interactuar", m, null)).toBe(50);
    expect(valorDelObjetivo("guardar", m, null)).toBe(4);
    expect(valorDelObjetivo("consultar", m, 3)).toBe(3);
  });
  it("sin datos de Instagram no inventa", () => {
    expect(valorDelObjetivo("conocer", { ...m, alcance: null }, null)).toBeNull();
    expect(valorDelObjetivo("interactuar", null, null)).toBeNull();
    expect(valorDelObjetivo("consultar", m, null)).toBeNull();
  });
});

describe("estadoDeMeta", () => {
  it("compara contra la meta", () => {
    expect(estadoDeMeta(140, 100)).toBe("superada");
    expect(estadoDeMeta(100, 100)).toBe("cumplida");
    expect(estadoDeMeta(75, 100)).toBe("cerca");
    expect(estadoDeMeta(20, 100)).toBe("lejos");
    expect(estadoDeMeta(null, 100)).toBe("sin_dato");
    expect(estadoDeMeta(50, null)).toBe("sin_meta");
  });
});

describe("permalinkClave", () => {
  it("reconoce posts y reels, con o sin usuario y parámetros", () => {
    expect(permalinkClave("https://www.instagram.com/p/DAbc12_-x/?igsh=1")).toBe("DAbc12_-x");
    expect(permalinkClave("https://www.instagram.com/reel/C9xyz/")).toBe("C9xyz");
    expect(permalinkClave("https://instagram.com/marca/reel/C9xyz")).toBe("C9xyz");
    expect(permalinkClave("https://drive.google.com/x")).toBeNull();
  });
});

describe("tocaMedir", () => {
  const AHORA = Date.parse("2026-10-17T12:00:00Z");
  it("entre 2 y 30 días después", () => {
    expect(tocaMedir("2026-10-16T12:00:00Z", AHORA)).toBe(false);
    expect(tocaMedir("2026-10-10T12:00:00Z", AHORA)).toBe(true);
    expect(tocaMedir("2026-08-01T12:00:00Z", AHORA)).toBe(false);
  });
});
