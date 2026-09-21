import { describe, it, expect } from "vitest";
import {
  contarPorEtapa,
  estadoAlElegirEtapa,
  estadoParaEtapa,
  etapaDe,
  ETAPAS,
  tieneCorrecciones,
} from "./etapas";

describe("etapaDe", () => {
  it("los nueve estados entran en cinco etapas", () => {
    expect(etapaDe("idea")).toBe("idea");
    expect(etapaDe("en_diseno")).toBe("produciendo");
    expect(etapaDe("guion")).toBe("produciendo");
    expect(etapaDe("edicion")).toBe("produciendo");
    expect(etapaDe("revision_creativa")).toBe("para_aprobar");
    expect(etapaDe("revision_cliente")).toBe("para_aprobar");
    expect(etapaDe("aprobado")).toBe("programada");
    expect(etapaDe("publicado")).toBe("publicado");
  });

  it("una pieza con cambios pedidos está produciendo otra vez", () => {
    expect(etapaDe("rechazado")).toBe("produciendo");
    expect(tieneCorrecciones("rechazado")).toBe(true);
    expect(tieneCorrecciones("en_diseno")).toBe(false);
  });

  it("un estado que no conoce no rompe la pantalla", () => {
    expect(etapaDe(null)).toBe("idea");
    expect(etapaDe("lo_que_sea")).toBe("idea");
  });
});

describe("estadoParaEtapa", () => {
  it("producir un posteo es diseñarlo; producir un reel es editarlo", () => {
    expect(estadoParaEtapa("produciendo", "post")).toBe("en_diseno");
    expect(estadoParaEtapa("produciendo", "carrusel")).toBe("en_diseno");
    expect(estadoParaEtapa("produciendo", "historia")).toBe("en_diseno");
    expect(estadoParaEtapa("produciendo", "reel")).toBe("edicion");
    expect(estadoParaEtapa("produciendo", "video")).toBe("edicion");
  });

  it("las otras etapas tienen un solo estado", () => {
    expect(estadoParaEtapa("idea", "post")).toBe("idea");
    expect(estadoParaEtapa("para_aprobar", "post")).toBe("revision_creativa");
    expect(estadoParaEtapa("programada", "post")).toBe("aprobado");
    expect(estadoParaEtapa("publicado", "post")).toBe("publicado");
  });

  it("todas las etapas tienen traducción", () => {
    for (const e of ETAPAS) {
      expect(estadoParaEtapa(e, "post")).toBeTruthy();
    }
  });
});

describe("estadoAlElegirEtapa", () => {
  it("elegir la etapa en la que ya está no toca nada", () => {
    expect(estadoAlElegirEtapa("produciendo", "edicion", "reel")).toBeNull();
    expect(estadoAlElegirEtapa("idea", "idea", "post")).toBeNull();
  });

  it("una pieza con correcciones no vuelve a cero por tocar su propia etapa", () => {
    expect(estadoAlElegirEtapa("produciendo", "rechazado", "post")).toBeNull();
  });

  it("mover de verdad sí devuelve el estado nuevo", () => {
    expect(estadoAlElegirEtapa("para_aprobar", "en_diseno", "post")).toBe("revision_creativa");
    expect(estadoAlElegirEtapa("produciendo", "idea", "reel")).toBe("edicion");
  });
});

describe("contarPorEtapa", () => {
  it("reparte las piezas y deja las etapas vacías como listas vacías", () => {
    const out = contarPorEtapa([
      { estado: "idea" },
      { estado: "idea" },
      { estado: "edicion" },
      { estado: "rechazado" },
      { estado: "publicado" },
    ]);
    expect(out.idea).toHaveLength(2);
    expect(out.produciendo).toHaveLength(2);
    expect(out.para_aprobar).toHaveLength(0);
    expect(out.publicado).toHaveLength(1);
  });
});
