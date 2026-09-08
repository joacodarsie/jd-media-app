import { describe, it, expect } from "vitest";
import { armarDesglose, tituloConcepto, SIN_CUENTA } from "./desglose-sueldo";

describe("tituloConcepto", () => {
  it("acorta los conceptos largos de la app a un encabezado usable", () => {
    expect(tituloConcepto("Coordinación gestión de redes (10%)")).toBe("Coordinación");
    expect(tituloConcepto("Media buyer Presencia")).toBe("Pauta");
    expect(tituloConcepto("Gestión completa (acuerdo fijo)")).toBe("Gestión completa");
    expect(tituloConcepto("Jornada de producción")).toBe("Jornada");
  });

  it("lo que no reconoce lo deja, recortado si es muy largo", () => {
    expect(tituloConcepto("Algo raro")).toBe("Algo raro");
    expect(tituloConcepto("x".repeat(40))).toHaveLength(22);
  });
});

describe("armarDesglose", () => {
  const lineas = [
    { cliente: "Amelia Ambientaciones", concepto: "Coordinación gestión de redes (10%)", monto: 35000 },
    { cliente: "Amelia Ambientaciones", concepto: "Community manager", monto: 50000 },
    { cliente: "Magic", concepto: "Coordinación gestión de redes (10%)", monto: 35000 },
    { cliente: "La Azotea", concepto: "Coordinación gestión de redes (10%)", monto: 15000 },
    { cliente: null, concepto: "Edición extra", monto: 30000 },
  ];

  it("arma una fila por cuenta y una columna por concepto, como la planilla", () => {
    const d = armarDesglose(lineas);
    expect(d.conceptos).toEqual(["Coordinación", "CM", "Edición"]);
    expect(d.filas.map((f) => f.cliente)).toEqual([
      "Amelia Ambientaciones",
      "La Azotea",
      "Magic",
      SIN_CUENTA,
    ]);
  });

  it("suma bien por fila, por columna y el total", () => {
    const d = armarDesglose(lineas);
    const amelia = d.filas.find((f) => f.cliente === "Amelia Ambientaciones")!;
    expect(amelia.valores["Coordinación"]).toBe(35000);
    expect(amelia.valores["CM"]).toBe(50000);
    expect(amelia.total).toBe(85000);
    expect(d.totalPorConcepto["Coordinación"]).toBe(85000);
    expect(d.total).toBe(165000);
  });

  it("junta dos líneas del mismo concepto en la misma cuenta", () => {
    const d = armarDesglose([
      { cliente: "Magic", concepto: "Diseño de posts", monto: 24000 },
      { cliente: "Magic", concepto: "Diseñar carrusel", monto: 8000 },
    ]);
    expect(d.filas[0].valores["Diseño"]).toBe(32000);
  });

  it("los extras sin cuenta van al final", () => {
    const d = armarDesglose(lineas);
    expect(d.filas[d.filas.length - 1].cliente).toBe(SIN_CUENTA);
  });

  it("ignora los montos en cero y tolera la lista vacía", () => {
    expect(armarDesglose([{ cliente: "X", concepto: "Y", monto: 0 }]).filas).toHaveLength(0);
    expect(armarDesglose([]).total).toBe(0);
  });
});
