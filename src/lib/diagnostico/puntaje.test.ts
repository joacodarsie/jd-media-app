import { describe, expect, it } from "vitest";
import { diagnosticar, usuarioDe, type PerfilPublico } from "./puntaje";

const AHORA = Date.parse("2026-10-17T12:00:00Z");
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

function perfil(extra: Partial<PerfilPublico> = {}): PerfilPublico {
  return {
    usuario: "tiendaejemplo",
    nombre: "Tienda Ejemplo · Deco",
    biografia: "Objetos de diseño hechos a mano. Envíos a todo el país 🇦🇷",
    web: "https://tiendaejemplo.com",
    seguidores: 2000,
    publicaciones: 120,
    posts: Array.from({ length: 12 }, (_, i) => ({
      timestamp: hace(i * 2),
      likes: 80,
      comentarios: 5,
      tipo: i % 2 ? "VIDEO" : "CAROUSEL_ALBUM",
      producto: i % 2 ? "REELS" : "FEED",
    })),
    ...extra,
  };
}

describe("diagnosticar", () => {
  it("una cuenta activa y completa saca puntaje alto", () => {
    const d = diagnosticar(perfil(), AHORA);
    expect(d.puntaje).toBeGreaterThanOrEqual(80);
    expect(d.veredicto).toBe("Muy bien");
    expect(d.mejoras).toHaveLength(1);
  });

  it("una cuenta quieta hace semanas pierde la constancia", () => {
    const p = perfil({ posts: perfil().posts.map((x, i) => ({ ...x, timestamp: hace(90 + i * 5) })) });
    const d = diagnosticar(p, AHORA);
    const c = d.pilares.find((x) => x.clave === "constancia")!;
    expect(c.nota).toBe(0);
    expect(c.dato).toBe("Hace 90 días que no publicás");
    expect(d.mejoras[0]).toMatch(/Volver a publicar/);
  });

  it("perfil incompleto dice qué falta", () => {
    const d = diagnosticar(perfil({ biografia: "", web: null, nombre: "tiendaejemplo" }), AHORA);
    const p = d.pilares.find((x) => x.clave === "perfil")!;
    expect(p.estado).toBe("mal");
    expect(p.mejora).toMatch(/biografía/);
    expect(p.mejora).toMatch(/link/);
  });

  it("si la cuenta oculta los me gusta, no inventa la interacción", () => {
    const p = perfil({ posts: perfil().posts.map((x) => ({ ...x, likes: null })) });
    const d = diagnosticar(p, AHORA);
    expect(d.resumen.interaccion).toBeNull();
    expect(d.pilares.find((x) => x.clave === "interaccion")!.dato).toMatch(/oculta/);
  });

  it("sin publicaciones no rompe", () => {
    const d = diagnosticar(perfil({ posts: [], publicaciones: 0 }), AHORA);
    expect(d.puntaje).toBeLessThan(40);
    expect(d.mejoras.length).toBe(3);
  });
});

describe("usuarioDe", () => {
  it("acepta @, link o nombre", () => {
    expect(usuarioDe("@TiendaMoffa")).toBe("tiendamoffa");
    expect(usuarioDe("https://www.instagram.com/tiendamoffa/?hl=es")).toBe("tiendamoffa");
    expect(usuarioDe("jdmedia.digital")).toBe("jdmedia.digital");
  });
  it("rechaza basura", () => {
    expect(usuarioDe("hola que tal")).toBeNull();
    expect(usuarioDe("")).toBeNull();
  });
});
