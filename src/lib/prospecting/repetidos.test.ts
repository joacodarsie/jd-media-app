import { describe, it, expect } from "vitest";
import {
  claveEmpresa,
  claveInstagram,
  claveTelefono,
  IndiceContactos,
} from "./repetidos";

describe("claveEmpresa", () => {
  it("ignora mayúsculas, acentos y puntuación", () => {
    expect(claveEmpresa("Hotel del Lago")).toBe(claveEmpresa("HOTEL DEL LAGO"));
    expect(claveEmpresa("Café Martínez")).toBe(claveEmpresa("Cafe Martinez"));
    expect(claveEmpresa("La Botineta!")).toBe(claveEmpresa("La Botineta"));
  });

  it("ignora la forma jurídica", () => {
    expect(claveEmpresa("Impermax S.R.L.")).toBe(claveEmpresa("Impermax"));
    expect(claveEmpresa("Boxescar SA")).toBe(claveEmpresa("Boxescar"));
    expect(claveEmpresa("Lubricentro Sabattini S.A.S.")).toBe(claveEmpresa("Lubricentro Sabattini"));
  });

  it("ignora el artículo del principio", () => {
    expect(claveEmpresa("La Botineta")).toBe(claveEmpresa("Botineta"));
    expect(claveEmpresa("El Fogón")).toBe(claveEmpresa("Fogon"));
  });

  it("no junta empresas que sí son distintas", () => {
    expect(claveEmpresa("Hotel del Lago")).not.toBe(claveEmpresa("Hotel del Sol"));
    expect(claveEmpresa("Panadería Norte")).not.toBe(claveEmpresa("Panadería Sur"));
  });

  it("tolera vacío", () => {
    expect(claveEmpresa(null)).toBe("");
    expect(claveEmpresa("   ")).toBe("");
  });
});

describe("claveInstagram", () => {
  it("reconoce el mismo perfil escrito de varias formas", () => {
    const esperado = "posadaderosas";
    expect(claveInstagram("@posadaderosas")).toBe(esperado);
    expect(claveInstagram("PosadaDeRosas")).toBe(esperado);
    expect(claveInstagram("https://www.instagram.com/posadaderosas/")).toBe(esperado);
    // Sin protocolo y con el parámetro que agrega el "copiar link" de la app.
    expect(claveInstagram("instagram.com/posadaderosas?igshid=abc")).toBe(esperado);
  });
});

describe("claveTelefono", () => {
  it("iguala el mismo número escrito distinto", () => {
    // Los tres son el mismo celular de Córdoba, tal como lo publica cada web.
    const a = claveTelefono("+54 9 351 386 5433");
    expect(a).toBe("3513865433");
    expect(claveTelefono("0351 15 386 5433")).toBe(a);
    expect(claveTelefono("(351) 3865433")).toBe(a);
  });

  it("no iguala teléfonos distintos ni se cuelga con basura", () => {
    expect(claveTelefono("+54 9 351 386 5433")).not.toBe(claveTelefono("+54 9 351 386 5434"));
    expect(claveTelefono("sin teléfono")).toBe("");
    expect(claveTelefono("123")).toBe("");
  });
});

describe("IndiceContactos", () => {
  const existentes = [
    { empresa: "Hotel del Lago", telefono: "+54 9 351 386 5433", instagram: "@hoteldellago" },
    { empresa: "Impermax S.R.L.", telefono: null, instagram: null },
    { empresa: "La Botineta", telefono: null, instagram: "labotineta" },
  ];

  it("detecta el mismo negocio aunque cambie el nombre, por teléfono", () => {
    const idx = new IndiceContactos(existentes);
    expect(idx.motivoRepetido({ empresa: "Hostería El Lago", telefono: "0351 15 386 5433" })).toBe(
      "telefono",
    );
  });

  it("detecta por Instagram aunque el nombre y el teléfono cambien", () => {
    const idx = new IndiceContactos(existentes);
    expect(
      idx.motivoRepetido({
        empresa: "Botineta Deportes",
        telefono: "351 000 0000",
        instagram: "https://instagram.com/labotineta",
      }),
    ).toBe("instagram");
  });

  it("detecta por nombre cuando no hay otro dato", () => {
    const idx = new IndiceContactos(existentes);
    expect(idx.motivoRepetido({ empresa: "IMPERMAX SA" })).toBe("empresa");
  });

  it("deja pasar lo que es realmente nuevo", () => {
    const idx = new IndiceContactos(existentes);
    expect(idx.esRepetido({ empresa: "Posada de Rosas", telefono: "+54 9 261 533 0110" })).toBe(false);
  });

  it("una vez agregado, el siguiente igual ya es repetido", () => {
    const idx = new IndiceContactos(existentes);
    const nuevo = { empresa: "Posada de Rosas", telefono: "+54 9 261 533 0110" };
    expect(idx.esRepetido(nuevo)).toBe(false);
    idx.agregar(nuevo);
    expect(idx.esRepetido({ empresa: "posada de rosas" })).toBe(true);
    // Y también por teléfono, con otro nombre.
    expect(idx.esRepetido({ empresa: "Otro Hospedaje", telefono: "0261 15 533 0110" })).toBe(true);
  });

  it("los nombres para el prompt priorizan los de la campaña y no repiten", () => {
    const idx = new IndiceContactos(existentes);
    const nombres = idx.nombresParaPrompt(["Hotel del Lago", "Hotel del Lago"], 10);
    expect(nombres[0]).toBe("Hotel del Lago");
    expect(nombres.filter((n) => n === "Hotel del Lago")).toHaveLength(1);
  });

  it("recorta la lista del prompt para no inflar el costo", () => {
    const muchos = Array.from({ length: 400 }, (_, i) => ({ empresa: `Empresa ${i}` }));
    const idx = new IndiceContactos(muchos);
    expect(idx.nombresParaPrompt([], 150)).toHaveLength(150);
  });
});
