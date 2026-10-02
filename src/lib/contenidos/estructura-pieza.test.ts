import { describe, it, expect } from "vitest";
import {
  armarDescripcion,
  descripcionDesdeSugerencia,
  leerDescripcion,
  type EstructuraPieza,
} from "./estructura-pieza";

const tesis: EstructuraPieza = {
  titulo: "5 razones por las que tu tesis está frenada",
  slides: [
    { texto: "No tenés tiempo.", fondo: "reloj de arena casi sin tiempo." },
    { texto: "Tu tutor te pidió corregir de nuevo", fondo: "" },
    { texto: "", fondo: "persona pensando frente a la pantalla" },
    { texto: "", fondo: "" },
  ],
  cierre: "Te apoyamos en cualquiera de estas 5.",
  cta: "Pedí tu presupuesto hoy",
  notas: "",
};

describe("armarDescripcion", () => {
  it("arma el formato del ejemplo, numerando solo las slides con algo", () => {
    expect(armarDescripcion(tesis)).toBe(
      [
        "TÍTULO: 5 razones por las que tu tesis está frenada",
        "",
        "SLIDES:",
        "1. No tenés tiempo. Fondo: reloj de arena casi sin tiempo.",
        "2. Tu tutor te pidió corregir de nuevo",
        "3. Fondo: persona pensando frente a la pantalla",
        "",
        "CIERRE: Te apoyamos en cualquiera de estas 5.",
        "CTA: Pedí tu presupuesto hoy",
      ].join("\n")
    );
  });

  it("vacío no escribe nada", () => {
    expect(
      armarDescripcion({ titulo: "", slides: [{ texto: "", fondo: "" }], cierre: "", cta: "", notas: "" })
    ).toBe("");
  });
});

describe("leerDescripcion", () => {
  it("lee lo que arma (ida y vuelta)", () => {
    const texto = armarDescripcion({ ...tesis, notas: "Paleta de la marca.\nTipografía grande." });
    const e = leerDescripcion(texto)!;
    expect(e.titulo).toBe(tesis.titulo);
    expect(e.slides).toEqual([
      { texto: "No tenés tiempo", fondo: "reloj de arena casi sin tiempo." },
      { texto: "Tu tutor te pidió corregir de nuevo", fondo: "" },
      { texto: "", fondo: "persona pensando frente a la pantalla" },
    ]);
    expect(e.cierre).toBe(tesis.cierre);
    expect(e.cta).toBe(tesis.cta);
    expect(e.notas).toBe("Paleta de la marca.\nTipografía grande.");
    expect(armarDescripcion(e)).toBe(texto);
  });

  it("un texto libre viejo no se interpreta", () => {
    expect(leerDescripcion("Formato: carrusel, 4 placas. Gancho: un sillón no es solo lo que ves.")).toBeNull();
    expect(leerDescripcion(null)).toBeNull();
  });
});

describe("descripcionDesdeSugerencia", () => {
  const sug = {
    hook: "Un sillón no es solo lo que ves",
    slides: [
      { texto: "Un sillón no es solo lo que ves", diseno: "primer plano de la madera" },
      { texto: "Goma espuma de alta densidad", diseno: "corte de la espuma" },
    ],
    descripcion: "Más crudo que los posteos de producto.",
    cta: "Escribinos por WhatsApp",
  };

  it("un carrusel sale por slides, con el concepto en notas", () => {
    const e = leerDescripcion(descripcionDesdeSugerencia(sug, "carrusel"))!;
    expect(e.titulo).toBe(sug.hook);
    expect(e.slides.map((s) => s.fondo)).toEqual(["primer plano de la madera", "corte de la espuma"]);
    expect(e.cta).toBe(sug.cta);
    expect(e.notas).toBe(sug.descripcion);
  });

  it("un post sin slides igual queda ordenado", () => {
    const e = leerDescripcion(descripcionDesdeSugerencia({ ...sug, slides: [] }, "post"))!;
    expect(e.titulo).toBe(sug.hook);
    expect(e.notas).toBe(sug.descripcion);
  });

  it("un reel queda como antes", () => {
    expect(descripcionDesdeSugerencia(sug, "reel")).toBe(
      "Más crudo que los posteos de producto.\n\nCTA: Escribinos por WhatsApp"
    );
  });
});
