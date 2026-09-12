import { describe, it, expect } from "vitest";
import {
  computeJornadaSplit,
  splitJornada,
  precioJornada,
  JORNADA_MONTO_DEFAULT,
} from "@/lib/jornada";

describe("precioJornada", () => {
  it("una hora son $50.000", () => {
    expect(precioJornada(1)).toBe(50000);
  });

  it("cada hora extra suma $25.000", () => {
    expect(precioJornada(2)).toBe(75000);
    expect(precioJornada(3)).toBe(100000);
    expect(precioJornada(4)).toBe(125000);
  });

  it("media hora extra se cobra proporcional", () => {
    expect(precioJornada(1.5)).toBe(62500);
  });

  it("una duración inválida se trata como una hora, no como cero", () => {
    expect(precioJornada(0)).toBe(50000);
    expect(precioJornada(-2)).toBe(50000);
    expect(precioJornada(NaN)).toBe(50000);
  });
});

describe("splitJornada", () => {
  it("reparte el precio 50/30/20 y los viáticos van aparte", () => {
    const s = splitJornada({ precio: 50000, viaticos: 20000, hasAcompanante: true, viaticosLosPaga: "cliente" });
    expect(s.viaticosPorPersona).toBe(10000);
    expect(s.director).toBe(35000); // 10.000 de viáticos + 50% de 50.000
    expect(s.acompanante).toBe(25000); // 10.000 + 30%
    expect(s.agencia).toBe(10000); // 20% de 50.000, los viáticos no la tocan
    expect(s.totalCliente).toBe(70000);
  });

  it("sin viáticos, el reparto es 50/30/20 puro", () => {
    const s = splitJornada({ precio: 100000, viaticos: 0, hasAcompanante: true });
    expect(s.director).toBe(50000);
    expect(s.acompanante).toBe(30000);
    expect(s.agencia).toBe(20000);
  });

  it("si los viáticos los pone la agencia, salen de su parte", () => {
    const conCliente = splitJornada({ precio: 50000, viaticos: 20000, hasAcompanante: true, viaticosLosPaga: "cliente" });
    const conAgencia = splitJornada({ precio: 50000, viaticos: 20000, hasAcompanante: true, viaticosLosPaga: "agencia" });
    // El equipo cobra lo mismo en los dos casos: los viáticos son un reintegro.
    expect(conAgencia.director).toBe(conCliente.director);
    expect(conAgencia.acompanante).toBe(conCliente.acompanante);
    // La que cambia es la agencia: los pone de su bolsillo.
    expect(conAgencia.agencia).toBe(conCliente.agencia - 20000);
    expect(conAgencia.agencia).toBe(-10000);
  });

  it("yendo solo, los viáticos van completos a quien fue", () => {
    const s = splitJornada({ precio: 50000, viaticos: 18000, hasAcompanante: false, viaticosLosPaga: "cliente" });
    expect(s.viaticosPorPersona).toBe(18000);
    expect(s.director).toBe(43000); // 18.000 + 50% de 50.000
    expect(s.acompanante).toBeNull();
    expect(s.agencia).toBe(25000); // el 30% que no se paga queda en la agencia
  });

  it("lo repartido cierra con lo que entra", () => {
    for (const precio of [50000, 75000, 100000, 125000]) {
      for (const viaticos of [0, 12000, 30000]) {
        for (const acomp of [true, false]) {
          const s = splitJornada({ precio, viaticos, hasAcompanante: acomp, viaticosLosPaga: "cliente" });
          expect(s.director + (s.acompanante ?? 0) + s.agencia).toBe(s.totalCliente);
        }
      }
    }
  });

  it("montos raros no rompen el reparto", () => {
    const s = splitJornada({ precio: -100, viaticos: NaN, hasAcompanante: false });
    expect(s.precio).toBe(0);
    expect(s.viaticos).toBe(0);
    expect(s.director).toBe(0);
  });
});

describe("computeJornadaSplit (jornadas viejas, viáticos adentro del monto)", () => {
  it("mantiene el reparto de las cargadas antes de la migración 0163", () => {
    const s = computeJornadaSplit(75000, true);
    expect(s.viaticosPorPersona).toBe(12500);
    expect(s.director).toBe(37500);
    expect(s.acompanante).toBe(27500);
    expect(s.agencia).toBe(10000);
    expect(s.director + (s.acompanante ?? 0) + s.agencia).toBe(75000);
  });

  it("con solo director, los viáticos van completos a él", () => {
    const s = computeJornadaSplit(75000, false);
    expect(s.viaticosPorPersona).toBe(25000);
    expect(s.director).toBe(50000);
    expect(s.agencia).toBe(25000);
  });

  it("la suma sigue cerrando con el monto viejo", () => {
    for (const monto of [40000, 60000, 90000, 120000]) {
      for (const hasAcc of [true, false]) {
        const s = computeJornadaSplit(monto, hasAcc);
        expect(s.director + (s.acompanante ?? 0) + s.agencia).toBe(monto);
      }
    }
  });

  it("el default del formulario es una hora de trabajo", () => {
    expect(JORNADA_MONTO_DEFAULT).toBe(50000);
  });
});
