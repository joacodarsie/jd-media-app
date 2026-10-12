import { describe, expect, it } from "vitest";
import { cuentasQueAplican, efemeridesDelAnio, efemeridesEntre, pascua } from "./argentina";

const fecha = (anio: number, nombre: string) =>
  efemeridesDelAnio(anio).find((e) => e.nombre === nombre)?.fecha;

describe("fechas móviles", () => {
  it("Pascua", () => {
    expect(pascua(2026)).toEqual({ mes: 4, dia: 5 });
    expect(pascua(2027)).toEqual({ mes: 3, dia: 28 });
  });
  it("2026: Madre, Padre, Infancias, Carnaval y Black Friday", () => {
    expect(fecha(2026, "Día de la Madre")).toBe("2026-10-18");
    expect(fecha(2026, "Día del Padre")).toBe("2026-06-21");
    expect(fecha(2026, "Día de las Infancias")).toBe("2026-08-16");
    expect(fecha(2026, "Carnaval")).toBe("2026-02-16");
    expect(fecha(2026, "Black Friday")).toBe("2026-11-27");
  });
});

describe("rangos", () => {
  it("cruza el año: de mediados de diciembre a mediados de enero", () => {
    const n = efemeridesEntre("2026-12-20", "2027-01-10").map((e) => e.nombre);
    expect(n).toEqual(["Nochebuena", "Navidad", "Fin de año", "Año Nuevo"]);
  });
  it("las de todas las cuentas van antes que las de rubro el mismo día", () => {
    const abril2 = efemeridesDelAnio(2026).filter((e) => e.fecha === "2026-04-02");
    expect(abril2.map((e) => e.alcance)).toEqual(["todas", "rubro"]);
  });
});

describe("cuentas que aplican", () => {
  const cuentas = [
    { nombre: "FUNDANIC", rubro: "Fundación de Autismo" },
    { nombre: "Dr Dionisi", rubro: "Salud" },
    { nombre: "Lubricentro", rubro: "Automotriz / lubricentro" },
    { nombre: "Sin rubro", rubro: null },
  ];
  const de = (nombre: string) => efemeridesDelAnio(2026).find((e) => e.nombre === nombre)!;
  it("por rubro, sin importar tildes ni mayúsculas", () => {
    expect(cuentasQueAplican(de("Día Mundial de Concientización sobre el Autismo"), cuentas).map((c) => c.nombre)).toEqual([
      "FUNDANIC",
      "Dr Dionisi",
    ]);
    expect(cuentasQueAplican(de("Día del Mecánico"), cuentas).map((c) => c.nombre)).toEqual(["Lubricentro"]);
  });
  it("sin claves no sugiere nada", () => {
    expect(cuentasQueAplican(de("Navidad"), cuentas)).toEqual([]);
  });
});
