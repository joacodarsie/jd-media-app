import { describe, it, expect } from "vitest";
import { mensajesDeBienvenida, type EntradaBienvenida } from "./bienvenida";

const base: EntradaBienvenida = {
  contacto: "Tania",
  marca: "Mónaco",
  servicios: ["gestion_redes"],
  conGestionDeCampanas: true,
  director: "Joaquín Darsie",
  equipo: {
    projectManager: "Luz Torres",
    directoraCreativa: "Brisa Tejada",
    communityManager: "Belén Gastardelli",
    disenador: "Darío",
    editor: "Carlos David Perlo",
    mediaBuyer: "Guillermo García",
  },
};

describe("mensajesDeBienvenida — gestión de redes con campañas", () => {
  const m = mensajesDeBienvenida(base);

  it("son cuatro mensajes: equipo, arranque, mes a mes y lo que necesitamos", () => {
    expect(m).toHaveLength(4);
  });

  it("presenta la estructura nueva con nombres de pila", () => {
    expect(m[0]).toContain("*Luz*, project manager");
    expect(m[0]).toContain("*Brisa*, dirección creativa");
    expect(m[0]).toContain("*Belén*, community manager");
    expect(m[0]).toContain("*Guillermo*, campañas publicitarias");
    expect(m[0]).toContain("Y yo, Joaquín");
    expect(m[0]).toContain("24 horas hábiles");
  });

  it("explica los 15 días de preparación y que el mes 1 publica la mitad", () => {
    expect(m[1]).toContain("*Día 15* · Empezamos a publicar");
    expect(m[1]).toContain("la mitad del pack");
    expect(m[1]).toContain("preparamos las campañas");
    // Ya no promete publicar desde el día 8, como el texto viejo.
    expect(m[1]).not.toContain("A partir del día 8");
  });

  it("cuenta las quincenas y que las jornadas se cobran aparte, con precio", () => {
    expect(m[2]).toContain("por quincena, con dos semanas de ventaja");
    expect(m[2]).toContain("se cobran aparte: $50.000 la primera hora y $25.000 cada hora adicional");
  });

  it("pide los accesos de Meta y recomienda Dólar App", () => {
    expect(m[3]).toContain("Business Manager");
    expect(m[3]).toContain("Dólar App");
  });
});

describe("mensajesDeBienvenida — variantes", () => {
  it("sin gestión de campañas no presenta al media buyer ni pide el Business Manager", () => {
    const m = mensajesDeBienvenida({ ...base, conGestionDeCampanas: false });
    expect(m[0]).not.toContain("Guillermo");
    expect(m[1]).not.toContain("preparamos las campañas");
    expect(m.join("\n")).not.toContain("Business Manager");
  });

  it("solo pauta: arranque de campañas, sin calendario ni jornadas ni directora creativa", () => {
    const m = mensajesDeBienvenida({ ...base, servicios: ["paid_media"] });
    expect(m[0]).not.toContain("Brisa");
    expect(m[0]).not.toContain("community manager");
    expect(m[1]).toContain("Las campañas salen al aire");
    expect(m.join("\n")).not.toContain("quincena");
    expect(m.join("\n")).not.toContain("Jornadas");
  });

  it("si falta alguien del equipo, no deja una línea vacía", () => {
    const m = mensajesDeBienvenida({ ...base, equipo: { ...base.equipo, editor: null } });
    expect(m[0]).not.toContain("edición audiovisual");
    expect(m[0]).not.toContain("*undefined*");
    expect(m[0]).not.toContain("*null*");
  });
});
