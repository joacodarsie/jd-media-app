import { describe, expect, it } from "vitest";
import { iconoDePunto, volumenTotal } from "./iconos";

describe("iconos de la propuesta", () => {
  it("elige el ícono por lo que dice el punto, primero por el título", () => {
    expect(iconoDePunto("Retomamos la pauta en Meta Ads con dos campañas")).toBe("📈");
    expect(iconoDePunto("Planificamos una sesión de producción para que alimente las campañas pagas")).toBe("🎥");
    expect(iconoDePunto("con anuncios que lleven al perfil", "TikTok desde cero")).toBe("🎵");
    expect(iconoDePunto("Algo que no encaja con nada")).toBe("✨");
  });

  it("suma el volumen de todas las cuentas", () => {
    expect(
      volumenTotal([
        { reels: 8, posts: 8, dias_historias: 12 },
        { reels: 4, posts: 4, dias_historias: null },
      ])
    ).toEqual({ reels: 12, posts: 12, historias: 12 });
  });
});
