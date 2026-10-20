import { afterEach, describe, expect, it } from "vitest";
import { cifrar, cifrarCredenciales, descifrar, descifrarCredenciales, estaCifrado } from "./cifrado";

const CLAVE = Buffer.alloc(32, 7).toString("base64");
const OTRA = Buffer.alloc(32, 9).toString("base64");

afterEach(() => {
  delete process.env.CREDENCIALES_KEY;
});

describe("cifrado de credenciales", () => {
  it("sin clave guarda y lee en texto plano, como antes", () => {
    expect(cifrar("hola123")).toBe("hola123");
    expect(descifrar("hola123")).toBe("hola123");
  });

  it("con clave cifra, cada vez distinto, y vuelve al original", () => {
    process.env.CREDENCIALES_KEY = CLAVE;
    const a = cifrar("Contraseña ñ 123!");
    const b = cifrar("Contraseña ñ 123!");
    expect(estaCifrado(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Contraseña");
    expect(descifrar(a)).toBe("Contraseña ñ 123!");
  });

  it("no cifra dos veces ni toca los vacíos", () => {
    process.env.CREDENCIALES_KEY = CLAVE;
    const a = cifrar("x");
    expect(cifrar(a)).toBe(a);
    expect(cifrar("")).toBe("");
  });

  it("lo viejo sin cifrar se sigue leyendo", () => {
    process.env.CREDENCIALES_KEY = CLAVE;
    expect(descifrar("vieja-en-texto-plano")).toBe("vieja-en-texto-plano");
  });

  it("con la clave equivocada o sin clave no explota ni pierde el dato: devuelve lo cifrado", () => {
    process.env.CREDENCIALES_KEY = CLAVE;
    const a = cifrar("secreto");
    process.env.CREDENCIALES_KEY = OTRA;
    expect(descifrar(a)).toBe(a);
    delete process.env.CREDENCIALES_KEY;
    expect(descifrar(a)).toBe(a);
    expect(cifrar(descifrar(a))).toBe(a);
  });

  it("una clave de largo incorrecto se ignora", () => {
    process.env.CREDENCIALES_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(cifrar("abc")).toBe("abc");
  });

  it("en listas cifra solo el password y deja el resto legible", () => {
    process.env.CREDENCIALES_KEY = CLAVE;
    const lista = [{ servicio: "Instagram", usuario: "@marca", password: "pw1", url: "", notas: "" }, { servicio: "Web", usuario: "a" }];
    const cif = cifrarCredenciales(lista);
    expect(cif[0].usuario).toBe("@marca");
    expect(estaCifrado(cif[0].password)).toBe(true);
    expect(cif[1]).toEqual({ servicio: "Web", usuario: "a" });
    expect(descifrarCredenciales(cif)).toEqual(lista);
    expect(cifrarCredenciales(null)).toEqual([]);
  });
});
