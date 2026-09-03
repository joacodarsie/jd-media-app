import { describe, it, expect } from "vitest";
import { estadoDeCobro, etapaMeta, totalPendiente, totalCobrado, ETAPAS } from "./cobro-gestion";

describe("etapas", () => {
  it("todas tienen ayuda cargada y un valor desconocido cae en la primera", () => {
    for (const e of ETAPAS) expect(e.ayuda.length).toBeGreaterThan(10);
    expect(etapaMeta("cualquiera").value).toBe("pendiente");
    expect(etapaMeta("prometio").label).toBe("Prometió pagar");
  });
});

describe("estadoDeCobro", () => {
  it("sin pagos, el saldo es todo el monto", () => {
    const e = estadoDeCobro({ monto: 350000, pagos: [] });
    expect(e).toMatchObject({ entregado: 0, saldo: 350000, saldado: false, etapa: "pendiente" });
  });

  it("con una entrega parcial baja el saldo y pasa a 'pagó una parte'", () => {
    const e = estadoDeCobro({ monto: 350000, pagos: [{ monto: 150000, fecha: "2026-09-03" }] });
    expect(e.entregado).toBe(150000);
    expect(e.saldo).toBe(200000);
    expect(e.saldado).toBe(false);
    expect(e.etapa).toBe("parcial");
  });

  it("cuando las entregas cubren el total, queda saldado solo", () => {
    const e = estadoDeCobro({
      monto: 350000,
      pagos: [{ monto: 150000, fecha: "2026-09-03" }, { monto: 200000, fecha: "2026-09-10" }],
    });
    expect(e.saldado).toBe(true);
    expect(e.saldo).toBe(0);
    expect(e.etapa).toBe("cobrado");
  });

  it("pagar de más no deja saldo negativo", () => {
    const e = estadoDeCobro({ monto: 100000, pagos: [{ monto: 120000, fecha: "2026-09-03" }] });
    expect(e.saldo).toBe(0);
    expect(e.saldado).toBe(true);
  });

  it("respeta el botón 'me pagó' de siempre aunque no haya entregas cargadas", () => {
    const e = estadoDeCobro({ monto: 350000, pagos: [], cobradoEl: "2026-09-02" });
    expect(e.saldado).toBe(true);
    expect(e.etapa).toBe("cobrado");
  });

  it("guarda la etapa elegida a mano cuando los números no la contradicen", () => {
    expect(estadoDeCobro({ monto: 350000, pagos: [], etapaGuardada: "contactado" }).etapa).toBe("contactado");
    expect(estadoDeCobro({ monto: 350000, pagos: [], etapaGuardada: "prometio" }).etapa).toBe("prometio");
  });

  it("NO se cree un 'cobrado' marcado a mano si la plata no está", () => {
    // Esto es lo que evita que la pantalla diga cobrado y la caja no lo tenga.
    const e = estadoDeCobro({ monto: 350000, pagos: [], etapaGuardada: "cobrado" });
    expect(e.saldado).toBe(false);
    expect(e.etapa).toBe("pendiente");
  });
});

describe("totales del mes", () => {
  const filas = [
    { monto: 350000, pagos: [] },
    { monto: 400000, pagos: [{ monto: 200000, fecha: "2026-09-05" }] },
    { monto: 350000, pagos: [], cobradoEl: "2026-09-01" },
  ];

  it("lo que falta descuenta lo entregado a cuenta", () => {
    // 350.000 enteros + 200.000 que faltan de la segunda + 0 de la cobrada
    expect(totalPendiente(filas)).toBe(550000);
  });

  it("lo que entró suma las entregas parciales", () => {
    // 200.000 de la parcial + 350.000 de la que se marcó cobrada
    expect(totalCobrado(filas)).toBe(550000);
  });
});
