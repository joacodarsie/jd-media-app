import { describe, it, expect } from "vitest";
import {
  chequearLinkParaPublicar,
  esLinkValido,
  linkDePieza,
  LINK_OBLIGATORIO_DESDE,
} from "./link-publicado";

const HOY = "2026-09-20"; // posterior al candado

describe("linkDePieza", () => {
  it("devuelve el link del posteo", () => {
    expect(linkDePieza({ link_instagram: "https://instagram.com/p/A/" })).toBe(
      "https://instagram.com/p/A/"
    );
  });

  it("recorta los espacios", () => {
    expect(linkDePieza({ link_instagram: "  https://ig.com/1  " })).toBe("https://ig.com/1");
  });

  it("ignora los vacíos y los de solo espacios", () => {
    expect(linkDePieza({ link_instagram: "   " })).toBeNull();
    expect(linkDePieza({ link_instagram: null })).toBeNull();
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

describe("historias", () => {
  const base = {
    estadoNuevo: "publicado",
    estadoAnterior: "aprobado",
    pieza: {},
    creadaEn: "2026-09-14",
  };

  it("una historia se marca publicada sin link: dura 24 h y no tiene link fijo", () => {
    expect(chequearLinkParaPublicar({ ...base, tipo: "historia" }).motivo).toBeNull();
  });

  it("si igual traen un link roto, se frena", () => {
    expect(chequearLinkParaPublicar({ ...base, tipo: "historia", linkNuevo: "ig.com/x" }).motivo).toContain(
      "no parece"
    );
  });

  it("un reel sigue pidiendo el link", () => {
    expect(chequearLinkParaPublicar({ ...base, tipo: "reel" }).motivo).toContain("Falta el link");
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
    expect(chequearLinkParaPublicar(base).motivo).toContain("Falta el link");
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
    expect(chequearLinkParaPublicar({ ...base, linkNuevo: "ig.com/p/A" }).motivo).toContain(
      "https://"
    );
  });

  it("no pide nada en los otros cambios de estado", () => {
    for (const estado of ["idea", "en_diseno", "aprobado", "revision_cliente"]) {
      expect(chequearLinkParaPublicar({ ...base, estadoNuevo: estado }).motivo).toBeNull();
    }
  });

  it("no molesta al editar una pieza que ya estaba publicada", () => {
    expect(chequearLinkParaPublicar({ ...base, estadoAnterior: "publicado" }).motivo).toBeNull();
  });

  it("las piezas viejas se publican como siempre", () => {
    // Las 438 ya publicadas sin link no se tocan: pedir el dato hacia atrás
    // traba el trabajo de hoy por algo que nadie va a completar.
    expect(chequearLinkParaPublicar({ ...base, creadaEn: "2026-08-01" }).motivo).toBeNull();
  });

  it("sin fecha de creación se asume vieja y no se exige", () => {
    expect(chequearLinkParaPublicar({ ...base, creadaEn: null }).motivo).toBeNull();
  });

  it("el candado arranca el día indicado", () => {
    expect(
      chequearLinkParaPublicar({ ...base, creadaEn: LINK_OBLIGATORIO_DESDE }).motivo
    ).toContain("Falta el link");
  });

  it("un link inválido se rechaza aunque la pieza esté exenta", () => {
    // La exención es para no exigir el dato, no para aceptar uno roto.
    const r = chequearLinkParaPublicar({
      ...base,
      creadaEn: "2026-08-01",
      linkNuevo: "esto no es un link",
    });
    expect(r.motivo).toContain("https://");
  });

  it("un link vacío en una pieza vieja no molesta", () => {
    const r = chequearLinkParaPublicar({ ...base, creadaEn: "2026-08-01", linkNuevo: "   " });
    expect(r.motivo).toBeNull();
  });
});
