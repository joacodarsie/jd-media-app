import { describe, it, expect } from "vitest";
import { detectarRubro, rubroPorSlug, RUBRO_GENERICO, opcionesDeRubro } from "./rubros";
import {
  armarPropuesta,
  precioAr,
  volumenPack,
  nuevoToken,
  urlPropuesta,
  type ServicioCatalogo,
  type PackCatalogo,
} from "./build";

const CATALOGO: ServicioCatalogo[] = [
  { slug: "gestion_redes", name: "Gestión de Redes Sociales", description: "…" },
  { slug: "paid_media", name: "Publicidad Online", description: "…" },
  { slug: "produccion_contenido", name: "Producción de Contenido", description: "…" },
  { slug: "desarrollo_web", name: "Desarrollo Web", description: "…" },
  { slug: "diseno_grafico", name: "Diseño Gráfico y Branding", description: "…" },
  { slug: "botly", name: "Botly", description: "…" },
];

const PACKS: PackCatalogo[] = [
  { slug: "presencia", nombre: "Presencia", precio_mensual: 400000, descripcion: "…", reels: 4, posts: 4, dias_historias: 8, orden: 10 },
  { slug: "crecimiento", nombre: "Crecimiento", precio_mensual: 600000, descripcion: "…", reels: 8, posts: 8, dias_historias: 12, orden: 20 },
  { slug: "escala", nombre: "Escala", precio_mensual: 800000, descripcion: "…", reels: 12, posts: 12, dias_historias: 20, orden: 30 },
  { slug: "personalizado", nombre: "Personalizado", precio_mensual: null, descripcion: "…", reels: null, posts: null, dias_historias: null, orden: 40 },
];

describe("detectarRubro", () => {
  it("reconoce los rubros de las campañas reales", () => {
    expect(detectarRubro("Hoteles boutique y hospedajes independientes").slug).toBe("hoteleria");
    expect(
      detectarRubro("Clínicas odontológicas, consultorios dentales privados y centros de estética dental").slug,
    ).toBe("salud");
    expect(detectarRubro("Restaurantes, bares y cafeterías con propuesta diferenciada").slug).toBe("gastronomia");
    expect(detectarRubro("Estudios de arquitectura, diseño de interiores y estudios de diseño de mobiliario").slug).toBe("arquitectura");
    expect(detectarRubro("Constructoras y promotoras inmobiliarias (pequeñas-medianas)").slug).toBe("construccion");
    expect(detectarRubro("Academias de idiomas y centros educativos particulares").slug).toBe("educacion");
    expect(detectarRubro("Gimnasios").slug).toBe("fitness");
    expect(detectarRubro("Estudios de abogados y despachos jurídicos (pequeños-medianos)").slug).toBe("legal");
  });

  it("no se marea con acentos ni mayúsculas", () => {
    expect(detectarRubro("PELUQUERÍAS Y BARBERÍAS").slug).toBe("belleza");
  });

  it("cae en el genérico cuando no reconoce nada, sin romper", () => {
    expect(detectarRubro("criadero de caracoles").slug).toBe("generico");
    expect(detectarRubro("").slug).toBe("generico");
    expect(detectarRubro(null).slug).toBe("generico");
  });

  it("gana la coincidencia más específica y no la palabra suelta", () => {
    // "auto" aparece dentro de "automotor", pero el texto es de indumentaria.
    expect(detectarRubro("Tiendas de indumentaria deportiva").slug).toBe("indumentaria");
  });

  it("todas las fichas tienen contenido cargado", () => {
    for (const { slug } of opcionesDeRubro()) {
      const r = rubroPorSlug(slug);
      expect(r.titular.length).toBeGreaterThan(10);
      expect(r.diagnostico.length).toBeGreaterThan(60);
      expect(r.ideas.length).toBeGreaterThanOrEqual(3);
      expect(r.servicios.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("los servicios sugeridos existen en el catálogo real", () => {
    const validos = new Set(CATALOGO.map((s) => s.slug));
    for (const { slug } of opcionesDeRubro())
      for (const s of rubroPorSlug(slug).servicios) expect(validos.has(s)).toBe(true);
  });
});

describe("armarPropuesta", () => {
  const base = { empresa: "Posada de Rosas", catalogo: CATALOGO, packs: PACKS };

  it("pone adelante los servicios que le sirven al rubro y no pierde ninguno", () => {
    const p = armarPropuesta({ ...base, rubroSlug: "hoteleria" });
    expect(p.sugeridos[0].slug).toBe("gestion_redes");
    expect(p.servicios).toHaveLength(CATALOGO.length);
    expect(new Set(p.servicios.map((s) => s.slug)).size).toBe(CATALOGO.length);
  });

  it("recomienda el pack de la ficha del rubro", () => {
    expect(armarPropuesta({ ...base, rubroSlug: "hoteleria" }).packRecomendado?.slug).toBe("crecimiento");
    expect(armarPropuesta({ ...base, rubroSlug: "legal" }).packRecomendado?.slug).toBe("presencia");
  });

  it("respeta el pack elegido a mano", () => {
    const p = armarPropuesta({ ...base, rubroSlug: "hoteleria", packSugerido: "escala" });
    expect(p.packRecomendado?.slug).toBe("escala");
  });

  it("sin rubro conocido usa la ficha genérica y no se rompe", () => {
    const p = armarPropuesta({ ...base, rubroSlug: null });
    expect(p.rubro.slug).toBe(RUBRO_GENERICO.slug);
    expect(p.diagnostico.length).toBeGreaterThan(0);
    expect(p.personalizada).toBe(false);
  });

  it("el bloque de la IA pisa el texto del rubro y queda marcada como personalizada", () => {
    const p = armarPropuesta({
      ...base,
      rubroSlug: "hoteleria",
      ia: {
        titular: "El 85% de tus huéspedes son extranjeros",
        diagnostico: "Tu problema no es contenido, es a quién le llega.",
        puntos: ["Campañas geolocalizadas a los países que más te reservan", ""],
      },
    });
    expect(p.titular).toBe("El 85% de tus huéspedes son extranjeros");
    expect(p.puntosIa).toHaveLength(1); // los vacíos se filtran
    expect(p.personalizada).toBe(true);
  });

  it("ignora servicios elegidos que no existen en el catálogo", () => {
    const p = armarPropuesta({ ...base, servicios: ["gestion_redes", "seo_local", "linkedin"] });
    expect(p.sugeridos.map((s) => s.slug)).toEqual(["gestion_redes"]);
  });
});

describe("formato", () => {
  it("muestra los precios como en el resto de la app", () => {
    expect(precioAr(400000)).toBe("$400.000");
    expect(precioAr(null)).toBe("A medida");
  });

  it("resume el volumen del pack, y el personalizado no tiene", () => {
    expect(volumenPack(PACKS[0])).toBe("4 reels · 4 posts o carruseles · historias 8 días del mes");
    expect(volumenPack(PACKS[3])).toBeNull();
  });

  it("el token no usa caracteres que se confunden al dictarlo", () => {
    const t = nuevoToken();
    expect(t).toHaveLength(14);
    expect(t).toMatch(/^[a-z2-9]+$/);
    expect(t).not.toMatch(/[lo01]/);
  });

  it("arma el link sin barra doble", () => {
    expect(urlPropuesta("https://plataforma.jdmedia.com.ar/", "abc")).toBe(
      "https://plataforma.jdmedia.com.ar/propuesta/abc",
    );
  });
});
