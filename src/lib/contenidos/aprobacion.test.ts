import { describe, it, expect } from "vitest";
import {
  bandejaDeAprobacion,
  destinoAlAprobar,
  etapaDeAprobacion,
  motivoParaNoAprobar,
  motivoParaNoProgramar,
  tieneArchivo,
} from "./aprobacion";

describe("etapaDeAprobacion", () => {
  it("una idea espera la primera aprobación", () => {
    expect(etapaDeAprobacion({ estado: "idea" })).toBe("idea");
  });

  it("la revisión creativa es la segunda", () => {
    expect(etapaDeAprobacion({ estado: "revision_creativa" })).toBe("pieza");
  });

  it("lo que está en producción o ya salió no espera nada", () => {
    for (const estado of ["en_diseno", "edicion", "revision_cliente", "aprobado", "publicado"]) {
      expect(etapaDeAprobacion({ estado })).toBeNull();
    }
  });
});

describe("destinoAlAprobar", () => {
  it("aprobar la idea de un posteo lo manda a diseño", () => {
    expect(destinoAlAprobar({ estado: "idea", tipo: "post" })).toBe("en_diseno");
    expect(destinoAlAprobar({ estado: "idea", tipo: "carrusel" })).toBe("en_diseno");
  });

  it("aprobar la idea de un reel o un video la manda a edición", () => {
    expect(destinoAlAprobar({ estado: "idea", tipo: "reel" })).toBe("edicion");
    expect(destinoAlAprobar({ estado: "idea", tipo: "video" })).toBe("edicion");
  });

  it("aprobar la pieza terminada la programa", () => {
    expect(destinoAlAprobar({ estado: "revision_creativa", tipo: "post" })).toBe("aprobado");
  });

  it("lo que no espera decisión no tiene destino", () => {
    expect(destinoAlAprobar({ estado: "publicado" })).toBeNull();
  });
});

describe("motivoParaNoAprobar", () => {
  it("la idea se aprueba sin archivo: todavía no existe", () => {
    expect(motivoParaNoAprobar({ estado: "idea", tipo: "post" })).toBeNull();
  });

  it("la pieza terminada sin link no se puede aprobar", () => {
    const motivo = motivoParaNoAprobar({ estado: "revision_creativa", tipo: "post" });
    expect(motivo).toMatch(/Drive|Canva/);
  });

  it("con el link cargado sí", () => {
    expect(
      motivoParaNoAprobar({
        estado: "revision_creativa",
        tipo: "post",
        asset_url: "https://drive.google.com/x",
      })
    ).toBeNull();
  });

  it("un espacio en blanco no es un link", () => {
    expect(tieneArchivo({ estado: "revision_creativa", asset_url: "   " })).toBe(false);
  });
});

describe("motivoParaNoProgramar", () => {
  const sinArchivo = { estado: "revision_creativa" };

  it("frena programar una pieza sin archivo, venga de donde venga", () => {
    for (const estadoAnterior of ["idea", "en_diseno", "edicion", "revision_creativa", "rechazado"]) {
      expect(
        motivoParaNoProgramar({ estadoNuevo: "aprobado", estadoAnterior, pieza: sinArchivo })
      ).not.toBeNull();
    }
  });

  it("no se mete en los otros estados", () => {
    expect(
      motivoParaNoProgramar({ estadoNuevo: "en_diseno", estadoAnterior: "idea", pieza: sinArchivo })
    ).toBeNull();
  });

  it("volver de publicado a programado no pide nada", () => {
    expect(
      motivoParaNoProgramar({ estadoNuevo: "aprobado", estadoAnterior: "publicado", pieza: sinArchivo })
    ).toBeNull();
  });

  it("si el cliente ya la aprobó desde el portal, tampoco", () => {
    expect(
      motivoParaNoProgramar({
        estadoNuevo: "aprobado",
        estadoAnterior: "revision_cliente",
        pieza: sinArchivo,
      })
    ).toBeNull();
  });

  it("el link que se carga en el mismo movimiento cuenta", () => {
    expect(
      motivoParaNoProgramar({
        estadoNuevo: "aprobado",
        estadoAnterior: "revision_creativa",
        pieza: sinArchivo,
        linkNuevo: "https://canva.com/x",
      })
    ).toBeNull();
  });
});

describe("bandejaDeAprobacion", () => {
  it("separa los dos bloques y deja afuera lo que no espera decisión", () => {
    const out = bandejaDeAprobacion([
      { estado: "idea", tipo: "post" },
      { estado: "revision_creativa", tipo: "reel" },
      { estado: "publicado", tipo: "post" },
      { estado: "en_diseno", tipo: "post" },
    ]);
    expect(out.ideas).toHaveLength(1);
    expect(out.terminadas).toHaveLength(1);
  });
});
