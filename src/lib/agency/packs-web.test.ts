import { describe, it, expect } from "vitest";
import { htmlATexto, parsePrecio, parsearPacks, packsParaPrompt } from "./packs-web";

/** Recorte real de jdmedia.com.ar/servicios/gestion-redes (2026-08-05). */
const TEXTO_WEB = `
01
PRESENCIA
Presencia ordenada y profesional. Volumen base de contenido. Ideal para empezar.
$400.000 /mes
PUBLICACIONES MENSUALES
4 Reels
4 Posts
8 días de Historias
CONSULTAR
MÁS ELEGIDO
02
CRECIMIENTO
Más volumen, estrategia más fuerte y trabajo activo de crecimiento.
$600.000 /mes
PUBLICACIONES MENSUALES
8 Reels
8 Posts
12 días de Historias
CONSULTAR
03
ESCALA
Full servicio. Múltiples formatos, producción fuerte, estrategia avanzada.
$800.000 /mes
PUBLICACIONES MENSUALES
12 Reels
12 Posts
20 días de Historias
CONSULTAR
04
PERSONALIZADO
Si necesitás algo distinto a los packs estándar, lo armamos a medida según el alcance.
A cotizar según tu caso.
COTIZAR
JORNADAS DE PRODUCCIÓN
JORNADA · 1 HORA
$50.000 + viáticos
HORA ADICIONAL
$25.000 c/u
`;

describe("parsePrecio", () => {
  it("lee un precio mensual", () => {
    expect(parsePrecio("$400.000 /mes")).toBe(400000);
    expect(parsePrecio("$600.000/mes")).toBe(600000);
  });

  it("IGNORA precios que no son mensuales", () => {
    // El caso que rompía: la jornada de produccion ($50.000 + viáticos) se
    // colaba como precio del pack Personalizado.
    expect(parsePrecio("$50.000 + viáticos")).toBeNull();
    expect(parsePrecio("$25.000 c/u")).toBeNull();
    expect(parsePrecio("A cotizar según tu caso.")).toBeNull();
  });
});

describe("parsearPacks", () => {
  const packs = parsearPacks(TEXTO_WEB);

  it("encuentra los cuatro packs", () => {
    expect(packs.map((p) => p.slug)).toEqual([
      "presencia",
      "crecimiento",
      "escala",
      "personalizado",
    ]);
  });

  it("lee los precios reales de la web", () => {
    expect(packs.find((p) => p.slug === "presencia")!.precio_mensual).toBe(400000);
    expect(packs.find((p) => p.slug === "crecimiento")!.precio_mensual).toBe(600000);
    expect(packs.find((p) => p.slug === "escala")!.precio_mensual).toBe(800000);
  });

  it("Personalizado queda sin precio, no con el de la jornada", () => {
    expect(packs.find((p) => p.slug === "personalizado")!.precio_mensual).toBeNull();
  });

  it("lee el volumen de cada pack", () => {
    const p = packs.find((x) => x.slug === "presencia")!;
    expect(p.reels).toBe(4);
    expect(p.posts).toBe(4);
    expect(p.dias_historias).toBe(8);

    const e = packs.find((x) => x.slug === "escala")!;
    expect(e.reels).toBe(12);
    expect(e.dias_historias).toBe(20);
  });

  it("trae la descripción de cada pack", () => {
    expect(packs.find((p) => p.slug === "escala")!.descripcion).toContain("Full servicio");
  });

  it("no confunde el pack con su mención en el FAQ", () => {
    const conFaq =
      TEXTO_WEB +
      "\n¿CUÁNTOS POSTS Y REELS PUBLICAN?\nEn PRESENCIA trabajamos con 4 reels, 4 posts y 8 días de historias.";
    const r = parsearPacks(conFaq);
    expect(r.filter((p) => p.slug === "presencia")).toHaveLength(1);
    expect(r.find((p) => p.slug === "presencia")!.precio_mensual).toBe(400000);
  });

  it("una página sin packs devuelve vacío (y el caller aborta)", () => {
    expect(parsearPacks("<h1>Nada que ver</h1>")).toEqual([]);
  });
});

describe("htmlATexto", () => {
  it("saca etiquetas, scripts y estilos", () => {
    const html = `<div><script>var x=1</script><style>.a{}</style><h2>PRESENCIA</h2><p>$400.000 /mes</p></div>`;
    const t = htmlATexto(html);
    expect(t).toContain("PRESENCIA");
    expect(t).toContain("$400.000");
    expect(t).not.toContain("var x");
    expect(t).not.toContain("<h2>");
  });
});

describe("packsParaPrompt", () => {
  it("arma las líneas con el precio formateado", () => {
    const txt = packsParaPrompt(parsearPacks(TEXTO_WEB));
    expect(txt).toContain("Pack Presencia** — $400.000/mes");
    expect(txt).toContain("4 reels + 4 posts + 8 dias de historias");
  });

  it("el Personalizado se describe como a cotizar, sin cifra", () => {
    const txt = packsParaPrompt(parsearPacks(TEXTO_WEB));
    expect(txt).toContain("Pack Personalizado** — a cotizar segun el caso");
    expect(txt).not.toContain("$50.000");
  });

  it("nunca mete el precio viejo que estaba hardcodeado", () => {
    const txt = packsParaPrompt(parsearPacks(TEXTO_WEB));
    expect(txt).not.toContain("350.000");
    expect(txt).not.toContain("500.000");
    expect(txt).not.toContain("700.000");
  });
});
