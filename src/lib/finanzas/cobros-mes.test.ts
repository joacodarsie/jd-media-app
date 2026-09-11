import { describe, it, expect } from "vitest";
import { clasificarColgada, cuantasFaltanCobrar, type FilaCobro } from "./cobros-mes";

function fila(over: Partial<FilaCobro> = {}): FilaCobro {
  return {
    clienteId: "c1",
    nombre: "Cliente",
    monto: 350000,
    cobradoEl: null,
    nota: null,
    contacto: null,
    telefono: null,
    esperandoPago: false,
    etapa: null,
    pagos: [],
    ...over,
  };
}

describe("clasificarColgada", () => {
  it("una cuenta dada de baja con el mes sin cobrar queda colgada", () => {
    expect(clasificarColgada("perdido", "2026-09", "2026-09")).toBe("cuenta_de_baja");
  });

  it("una propuesta que nunca pagó también: no es un cobro del mes", () => {
    expect(clasificarColgada("propuesta", "2026-08", "2026-09")).toBe("cuenta_de_baja");
  });

  it("una cuenta viva con deuda de un mes anterior queda como mes anterior", () => {
    expect(clasificarColgada("activo", "2026-08", "2026-09")).toBe("mes_anterior");
  });

  it("el mes corriente de una cuenta viva NO está colgado: se cobra arriba", () => {
    expect(clasificarColgada("activo", "2026-09", "2026-09")).toBeNull();
  });

  it("quien firmó y todavía no pagó se cobra como cualquier otro", () => {
    expect(clasificarColgada("esperando_pago", "2026-09", "2026-09")).toBeNull();
  });
});

describe("cuantasFaltanCobrar", () => {
  it("cuenta solo lo que no está saldado", () => {
    expect(
      cuantasFaltanCobrar([
        fila({ clienteId: "a", cobradoEl: "2026-09-05" }),
        fila({ clienteId: "b" }),
        fila({ clienteId: "c" }),
      ])
    ).toBe(2);
  });

  it("una entrega que cubre el total ya no falta, aunque nadie haya marcado nada", () => {
    expect(
      cuantasFaltanCobrar([
        fila({
          clienteId: "a",
          monto: 100000,
          pagos: [{ id: "p1", monto: 100000, fecha: "2026-09-03", nota: null }],
        }),
      ])
    ).toBe(0);
  });

  it("una entrega parcial sigue faltando", () => {
    expect(
      cuantasFaltanCobrar([
        fila({
          clienteId: "a",
          monto: 100000,
          pagos: [{ id: "p1", monto: 40000, fecha: "2026-09-03", nota: null }],
        }),
      ])
    ).toBe(1);
  });
});
