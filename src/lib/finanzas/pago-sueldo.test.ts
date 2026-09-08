import { describe, it, expect } from "vitest";
import { estadoDePagoSueldo, faltaPagarDelMes } from "./pago-sueldo";

describe("estadoDePagoSueldo", () => {
  it("sin registrar todavía", () => {
    const e = estadoDePagoSueldo({ total: 665000, registrado: false });
    expect(e.estado).toBe("sin_registrar");
    expect(e.falta).toBe(665000);
  });

  it("registrado pero sin transferir", () => {
    expect(estadoDePagoSueldo({ total: 665000, registrado: true }).estado).toBe("pendiente");
  });

  it("el caso real de Luz en agosto: pagó una parte", () => {
    // De la planilla del dueño: $879.300 total, $679.300 pagado, $200.000 falta.
    const e = estadoDePagoSueldo({ total: 879300, registrado: true, montoPagado: 679300 });
    expect(e.estado).toBe("parcial");
    expect(e.pagado).toBe(679300);
    expect(e.falta).toBe(200000);
    expect(e.label).toBe("Pagó una parte");
  });

  it("cuando se completa el total queda pagado solo", () => {
    const e = estadoDePagoSueldo({ total: 879300, registrado: true, montoPagado: 879300 });
    expect(e.estado).toBe("pagado");
    expect(e.falta).toBe(0);
  });

  it("respeta el botón de siempre, que sella la fecha sin cargar monto", () => {
    const e = estadoDePagoSueldo({ total: 500000, registrado: true, fechaPago: "2026-09-05" });
    expect(e.estado).toBe("pagado");
    expect(e.pagado).toBe(500000);
    expect(e.falta).toBe(0);
  });

  it("pagar de más no deja saldo negativo", () => {
    expect(estadoDePagoSueldo({ total: 100000, registrado: true, montoPagado: 120000 }).falta).toBe(0);
  });
});

describe("faltaPagarDelMes", () => {
  it("suma lo que falta de todo el equipo", () => {
    const falta = faltaPagarDelMes([
      { total: 879300, registrado: true, montoPagado: 679300 }, // faltan 200.000
      { total: 550000, registrado: true, fechaPago: "2026-09-05" }, // 0
      { total: 150000, registrado: false }, // 150.000
    ]);
    expect(falta).toBe(350000);
  });
});
