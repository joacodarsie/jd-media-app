import { describe, it, expect } from "vitest";
import {
  campoParaLink,
  chequearLinkParaPublicar,
  esLinkValido,
  linkDePieza,
  LINK_OBLIGATORIO_DESDE,
} from "./link-publicado";

const HOY = "2026-09-20"; // posterior al candado

describe("linkDePieza", () => {
  it("devuelve el primero que haya, priorizando Instagram", () => {
    expect(
      linkDePieza({ link_facebook: "https://fb.com/1", link_instagram: "https://ig.com/2" })
    ).toBe("https://ig.com/2");
  });

  it("cae a los campos viejos si no hay links por red", () => {
    expect(linkDePieza({ publicacion_url: "https://x.com/1" })).toBe("https://x.com/1");
    expect(linkDePieza({ link_publicacion: "https://y.com/1" })).toBe("https://y.com/1");
  });

  it("ignora los vacíos y los de solo espacios", () => {
    expect(linkDePieza({ link_instagram: "   ", link_tiktok: null })).toBeNull();
    expect(linkDePieza({})).toBeNull();
  });
});

describe("esLinkValido", () => {
  it("acepta una dirección de verdad", () => {
    expect(esLinkValido("https://www.instagram.com/p/ABC123/")).toBe(true);
    expect(esLinkValido("http://tiktok.com/@x/video/1")).toBe(true);
  });

  it("rechaza lo que no lleva a ningún lado", () => {
    expect(esLinkValido("instagram.com/p/ABC")).toBe(false); // sin protocolo
    expect(esLinkValido("http://foo")).toBe(false); // host sin punto
    expect(esLinkValido("no es un link")).toBe(false);
    expect(esLinkValido("")).toBe(false);
    expect(esLinkValido(null)).toBe(false);
  });
});

describe("chequearLinkParaPublicar", () => {
  const base = {
    estadoNuevo: "publicado",
    estadoAnterior: "aprobado",
    pieza: {},
    creadaEn: HOY,
  };

  it("frena publicar sin link", () => {
    const r = chequearLinkParaPublicar(base);
    expect(r.motivo).toContain("Falta el link");
  });

  it("deja publicar si la pieza ya tiene link cargado", () => {
    const r = chequearLinkParaPublicar({
      ...base,
      pieza: { link_instagram: "https://instagram.com/p/A/" },
    });
    expect(r.motivo).toBeNull();
  });

  it("deja publicar con un link nuevo válido", () => {
    const r = chequearLinkParaPublicar({ ...base, linkNuevo: "https://instagram.com/p/A/" });
    expect(r.motivo).toBeNull();
  });

  it("rechaza un link nuevo que no es una dirección", () => {
    const r = chequearLinkParaPublicar({ ...base, linkNuevo: "ig.com/p/A" });
    expect(r.motivo).toContain("https://");
  });

  it("no pide nada en los otros cambios de estado", () => {
    for (const estado of ["idea", "en_diseno", "aprobado", "revision_cliente"]) {
      expect(chequearLinkParaPublicar({ ...base, estadoNuevo: estado }).motivo).toBeNull();
    }
  });

  it("no molesta al editar una pieza que ya estaba publicada", () => {
    const r = chequearLinkParaPublicar({ ...base, estadoAnterior: "publicado" });
    expect(r.motivo).toBeNull();
  });

  it("las piezas viejas se publican como siempre", () => {
    // Las 438 ya publicadas sin link no se tocan: pedir el dato hacia atrás
    // traba el trabajo de hoy por algo que nadie va a completar.
    const r = chequearLinkParaPublicar({ ...base, creadaEn: "2026-08-01" });
    expect(r.motivo).toBeNull();
  });

  it("sin fecha de creación se asume vieja y no se exige", () => {
    expect(chequearLinkParaPublicar({ ...base, creadaEn: null }).motivo).toBeNull();
  });

  it("el candado arranca el día indicado", () => {
    expect(
      chequearLinkParaPublicar({ ...base, creadaEn: LINK_OBLIGATORIO_DESDE }).motivo
    ).toContain("Falta el link");
  });
});

describe("campoParaLink", () => {
  it("manda el link a la columna de su red", () => {
    expect(campoParaLink("instagram")).toBe("link_instagram");
    expect(campoParaLink("TikTok")).toBe("link_tiktok");
    expect(campoParaLink("facebook")).toBe("link_facebook");
  });

  it("lo que no reconoce cae en Instagram, que es la red principal", () => {
    expect(campoParaLink(null)).toBe("link_instagram");
    expect(campoParaLink("linkedin")).toBe("link_instagram");
  });
});

describe("un link inválido se rechaza aunque la pieza esté exenta", () => {
  it("la exención es para no exigir el dato, no para aceptar uno roto", () => {
    const r = chequearLinkParaPublicar({
      estadoNuevo: "publicado",
      estadoAnterior: "aprobado",
      pieza: {},
      creadaEn: "2026-08-01", // vieja: exenta de tener link
      linkNuevo: "esto no es un link",
    });
    expect(r.motivo).toContain("https://");
  });

  it("un link vacío en una pieza vieja no molesta", () => {
    const r = chequearLinkParaPublicar({
      estadoNuevo: "publicado",
      estadoAnterior: "aprobado",
      pieza: {},
      creadaEn: "2026-08-01",
      linkNuevo: "   ",
    });
    expect(r.motivo).toBeNull();
  });
});
