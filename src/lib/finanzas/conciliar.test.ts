import { describe, it, expect } from "vitest";
import {
  clientesDelDetalle,
  esJornada,
  mensajeCobro,
  normalizar,
  periodoDeSueldo,
  personaDelDetalle,
  planificarCobro,
  tipoDe,
} from "./conciliar";

describe("lo básico", () => {
  it("normaliza tildes y signos", () => {
    expect(normalizar("  Résonar:  jornada ")).toBe("resonar jornada");
  });
  it("reconoce las dos categorías de la planilla", () => {
    expect(tipoDe("JD · Cobro de cliente")).toBe("cobro");
    expect(tipoDe("JD · Pagos al equipo")).toBe("sueldo");
    expect(tipoDe("JD · Plataformas")).toBeNull();
  });
  it("las jornadas no tocan el abono", () => {
    expect(esJornada({ detalle: "Résonar: jornada de producción" })).toBe(true);
    expect(esJornada({ detalle: "CATCH" })).toBe(false);
  });
  it("el sueldo que se paga el 7 es del mes anterior", () => {
    expect(periodoDeSueldo("2026-11-07")).toBe("2026-10");
    expect(periodoDeSueldo("2027-01-06")).toBe("2026-12");
    expect(periodoDeSueldo("2026-11-25")).toBe("2026-11");
  });
});

describe("a quién", () => {
  const clientes = [
    { id: "1", nombre: "Boxescar" },
    { id: "2", nombre: "La Azotea" },
    { id: "3", nombre: "CATCH" },
    { id: "4", nombre: "Résonar" },
  ];

  it("encuentra un cliente aunque el detalle tenga más texto", () => {
    expect(clientesDelDetalle("Cliente: CATCH", clientes).map((c) => c.id)).toEqual(["3"]);
  });
  it("una transferencia puede pagar dos clientes", () => {
    expect(clientesDelDetalle("Boxescar + La Azotea (Américo Pereira)", clientes).map((c) => c.id)).toEqual(["1", "2"]);
  });
  it("no confunde un pedazo de palabra con un cliente", () => {
    expect(clientesDelDetalle("Catchup", clientes)).toEqual([]);
  });

  const equipo = [
    { id: "a", nombre: "Santiago Reinaldi" },
    { id: "b", nombre: "Ailen Heredia" },
    { id: "c", nombre: "Guillermo García" },
    { id: "d", nombre: "Lucía García" },
  ];
  it("alcanza con el apellido, sin importar tildes ni apodos", () => {
    expect(personaDelDetalle("Santi Reinaldi", equipo)?.id).toBe("a");
    expect(personaDelDetalle("Ailén Heredia", equipo)?.id).toBe("b");
  });
  it("si dos comparten apellido, decide el nombre; si no alcanza, nadie", () => {
    expect(personaDelDetalle("Guillermo García", equipo)?.id).toBe("c");
    expect(personaDelDetalle("García", equipo)).toBeNull();
  });
});

describe("planificarCobro", () => {
  const deuda = (periodo: string, saldo: number, extra = {}) => ({
    clienteId: "3",
    cliente: "CATCH",
    periodo,
    saldo,
    ...extra,
  });

  it("el abono justo deja el mes cobrado", () => {
    const r = planificarCobro([deuda("2026-11", 600000)], 600000);
    expect(r).toEqual({ acciones: [{ tipo: "cobrado", clienteId: "3", cliente: "CATCH", periodo: "2026-11", monto: 600000 }], sobrante: 0 });
  });

  it("una diferencia de redondeo o comisión también lo deja cobrado", () => {
    expect(planificarCobro([deuda("2026-11", 600000)], 594000).acciones[0].tipo).toBe("cobrado");
  });

  it("si paga menos, queda como entrega a cuenta", () => {
    const r = planificarCobro([deuda("2026-11", 500000)], 250000);
    expect(r.acciones).toEqual([{ tipo: "parcial", clienteId: "3", cliente: "CATCH", periodo: "2026-11", monto: 250000 }]);
  });

  it("primero salda lo más viejo: Nazar paga octubre y noviembre juntos", () => {
    const r = planificarCobro([deuda("2026-11", 500000), deuda("2026-10", 475000)], 975000);
    expect(r.acciones.map((a) => [a.periodo, a.tipo])).toEqual([
      ["2026-10", "cobrado"],
      ["2026-11", "cobrado"],
    ]);
    expect(r.sobrante).toBe(0);
  });

  it("lo que sobra se informa, no se inventa una deuda", () => {
    const r = planificarCobro([deuda("2026-11", 300000)], 450000);
    expect(r.sobrante).toBe(150000);
  });

  it("marca cuando la factura todavía no existe", () => {
    const r = planificarCobro([deuda("2026-11", 400000, { sinFactura: true })], 400000);
    expect(r.acciones[0]).toMatchObject({ tipo: "cobrado", sinFactura: true });
  });

  it("el mensaje para el dueño", () => {
    const r = planificarCobro([deuda("2026-10", 475000), deuda("2026-11", 500000)], 700000);
    expect(mensajeCobro(r.acciones, r.sobrante)).toBe("CATCH octubre cobrado · CATCH noviembre: entrega de $225.000");
  });
});
