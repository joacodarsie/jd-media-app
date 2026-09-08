import { describe, it, expect } from "vitest";
import { resolverLineas, conceptoCompensado, totalDeLineas } from "./lineas-sueldo";

const auto = [
  { cliente: "La Botineta", clienteId: "c1", concepto: "CM Personalizado", monto: 50000 },
  { cliente: "La Botineta", clienteId: "c1", concepto: "Portadas · 1 reel", monto: 2000 },
];

describe("conceptoCompensado", () => {
  it("reconoce los dos prefijos que usa el sistema", () => {
    expect(conceptoCompensado("Se quita: Portadas · 1 reel")).toBe("Portadas · 1 reel");
    expect(conceptoCompensado("Corrección: CM Personalizado")).toBe("CM Personalizado");
    expect(conceptoCompensado("Adelanto de sueldo")).toBeNull();
  });
});

describe("resolverLineas", () => {
  it("el caso de la captura: la línea quitada se ve UNA vez, no dos", () => {
    const manual = [
      { id: "a1", tipo: "ajuste", concepto: "Se quita: Portadas · 1 reel", monto: -2000, cliente: "La Botineta", clienteId: "c1" },
    ];
    const { lineas, extras } = resolverLineas(auto, manual);
    expect(lineas).toHaveLength(2);
    expect(extras).toHaveLength(0); // el ajuste ya no aparece suelto
    const portadas = lineas.find((l) => l.concepto.startsWith("Portadas"))!;
    expect(portadas.monto).toBe(0);
    expect(portadas.quitada).toBe(true);
    expect(portadas.montoOriginal).toBe(2000);
    expect(portadas.ajusteId).toBe("a1");
  });

  it("una corrección deja el monto nuevo y recuerda el original", () => {
    const manual = [
      { id: "a2", tipo: "ajuste", concepto: "Corrección: CM Personalizado", monto: -20000, cliente: "La Botineta", clienteId: "c1" },
    ];
    const { lineas } = resolverLineas(auto, manual);
    const cm = lineas.find((l) => l.concepto === "CM Personalizado")!;
    expect(cm.monto).toBe(30000);
    expect(cm.montoOriginal).toBe(50000);
    expect(cm.quitada).toBe(false);
  });

  it("un ajuste suelto (un adelanto) sigue siendo su propia fila", () => {
    const manual = [
      { id: "a3", tipo: "ajuste", concepto: "Adelanto de sueldo", monto: -100000, cliente: null, clienteId: null },
    ];
    const { lineas, extras } = resolverLineas(auto, manual);
    expect(lineas.every((l) => l.ajusteId === null)).toBe(true);
    expect(extras).toHaveLength(1);
  });

  it("no confunde el mismo concepto en dos cuentas distintas", () => {
    const dosCuentas = [
      { cliente: "Magic", clienteId: "c1", concepto: "Portadas", monto: 4000 },
      { cliente: "Résonar", clienteId: "c2", concepto: "Portadas", monto: 6000 },
    ];
    const manual = [
      { id: "a4", tipo: "ajuste", concepto: "Se quita: Portadas", monto: -6000, cliente: "Résonar", clienteId: "c2" },
    ];
    const { lineas } = resolverLineas(dosCuentas, manual);
    expect(lineas.find((l) => l.cliente === "Magic")!.monto).toBe(4000);
    expect(lineas.find((l) => l.cliente === "Résonar")!.quitada).toBe(true);
  });

  it("el total no cambia por juntarlas", () => {
    const manual = [
      { id: "a1", tipo: "ajuste", concepto: "Se quita: Portadas · 1 reel", monto: -2000, cliente: "La Botineta", clienteId: "c1" },
      { id: "a3", tipo: "extra", concepto: "Manual de marca", monto: 50000, cliente: null, clienteId: null },
    ];
    const { lineas, extras } = resolverLineas(auto, manual);
    const sueltoTotal = 50000 + 2000 + (-2000) + 50000;
    expect(totalDeLineas(lineas, extras)).toBe(sueltoTotal);
  });
});
