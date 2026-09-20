import { describe, it, expect } from "vitest";
import {
  avisosDeLinkFaltante,
  piezasSinLink,
  type CuentaConCm,
  type PiezaPublicada,
} from "./link-faltante";

const pieza = (over: Partial<PiezaPublicada> = {}): PiezaPublicada => ({
  id: "p1",
  titulo: "Posteo",
  tipo: "post",
  estado: "publicado",
  cliente_id: "c1",
  fecha_publicacion: "2026-09-15",
  link_instagram: null,
  ...over,
});

const cuentas: CuentaConCm[] = [
  { id: "c1", nombre: "Magic", cm_id: "u1" },
  { id: "c2", nombre: "Impertek", cm_id: "u1" },
  { id: "c3", nombre: "La Azotea", cm_id: "u2" },
  { id: "c4", nombre: "Sin CM", cm_id: null },
];

const DESDE = "2026-08-21";

describe("piezasSinLink", () => {
  it("agarra la publicada sin link", () => {
    expect(piezasSinLink([pieza()], DESDE)).toHaveLength(1);
  });

  it("no cuenta lo que todavía no salió", () => {
    expect(piezasSinLink([pieza({ estado: "idea" })], DESDE)).toHaveLength(0);
  });

  it("a las historias no se les pide link", () => {
    expect(piezasSinLink([pieza({ tipo: "historia" })], DESDE)).toHaveLength(0);
  });

  it("con link cargado no cuenta", () => {
    expect(
      piezasSinLink([pieza({ link_instagram: "https://instagram.com/p/x" })], DESDE)
    ).toHaveLength(0);
  });

  it("un link roto es como no tener link", () => {
    expect(piezasSinLink([pieza({ link_instagram: "pendiente" })], DESDE)).toHaveLength(1);
  });

  it("lo viejo no se persigue", () => {
    expect(piezasSinLink([pieza({ fecha_publicacion: "2026-06-01" })], DESDE)).toHaveLength(0);
  });

  it("sin fecha no se puede saber si entra en la ventana", () => {
    expect(piezasSinLink([pieza({ fecha_publicacion: null })], DESDE)).toHaveLength(0);
  });
});

describe("avisosDeLinkFaltante", () => {
  const armar = (piezas: PiezaPublicada[], minimo?: number) =>
    avisosDeLinkFaltante({ piezas, cuentas, desde: DESDE, minimo });

  it("con menos del mínimo no molesta a nadie", () => {
    expect(armar([pieza({ id: "a" }), pieza({ id: "b" })])).toHaveLength(0);
  });

  it("a partir del mínimo avisa una sola vez, con el total", () => {
    const out = armar([pieza({ id: "a" }), pieza({ id: "b" }), pieza({ id: "c" })]);
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe("u1");
    expect(out[0].mensaje).toContain("3 piezas");
    expect(out[0].mensaje).toContain("Magic");
    expect(out[0].link).toBe("/contenidos?cliente=c1");
  });

  it("junta las cuentas de la misma persona en un aviso solo", () => {
    const out = armar([
      pieza({ id: "a" }),
      pieza({ id: "b" }),
      pieza({ id: "c", cliente_id: "c2" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].mensaje).toContain("2 de Magic");
    expect(out[0].mensaje).toContain("otras 1 cuenta");
  });

  it("cada CM recibe lo suyo", () => {
    const out = armar([
      pieza({ id: "a" }),
      pieza({ id: "b" }),
      pieza({ id: "c" }),
      pieza({ id: "d", cliente_id: "c3" }),
      pieza({ id: "e", cliente_id: "c3" }),
      pieza({ id: "f", cliente_id: "c3" }),
    ]);
    expect(out.map((a) => a.userId)).toEqual(["u1", "u2"]);
  });

  it("una cuenta sin CM cargada no genera aviso fantasma", () => {
    const out = armar([
      pieza({ id: "a", cliente_id: "c4" }),
      pieza({ id: "b", cliente_id: "c4" }),
      pieza({ id: "c", cliente_id: "c4" }),
    ]);
    expect(out).toHaveLength(0);
  });
});
