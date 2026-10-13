import { describe, expect, it } from "vitest";
import { cobroDelCliente, montoPrincipalPara, nombreServicio, ordenarFacturas } from "./cobro-cliente";

const nazar = [
  { id: "c", monto: 50000, fecha_cobro: null, concepto: "Nazar Hogar · chatter — 2026-10", created_at: "2026-10-01T09:00:03" },
  { id: "r", monto: 375000, fecha_cobro: null, concepto: "Nazar Hogar · gestion_redes (Presencia) — 2026-10", created_at: "2026-10-01T09:00:01", notas: "me paga el 10" },
  { id: "w", monto: 50000, fecha_cobro: null, concepto: "Nazar Hogar · gestion_whatsapp — 2026-10", created_at: "2026-10-01T09:00:02" },
];

describe("el cobro de un cliente con varios servicios", () => {
  it("suma todas las facturas: Nazar Hogar son $475.000, no $50.000", () => {
    const c = cobroDelCliente(nazar, new Map());
    expect(c.monto).toBe(475000);
    expect(c.cobradoEl).toBeNull();
    expect(c.principalId).toBe("r");
    expect(c.nota).toBe("me paga el 10");
    expect(c.cantidad).toBe(3);
  });

  it("la principal es la de mayor monto, sin importar el orden de creación", () => {
    expect(ordenarFacturas(nazar)[0].id).toBe("r");
  });

  it("si pagó todo, la fecha es la del último pago", () => {
    const pagas = nazar.map((f, i) => ({ ...f, fecha_cobro: `2026-10-0${i + 3}` }));
    const c = cobroDelCliente(pagas, new Map());
    expect(c.cobradoEl).toBe("2026-10-05");
    expect(c.pagos).toEqual([]);
  });

  it("si pagó un servicio aparte, cuenta como entrega del total (Freedom)", () => {
    const freedom = [
      { id: "r", monto: 375000, fecha_cobro: "2026-10-07", concepto: "Freedom · gestion_redes (Personalizado) — 2026-10" },
      { id: "w", monto: 75000, fecha_cobro: null, concepto: "Freedom · gestion_whatsapp — 2026-10" },
    ];
    const c = cobroDelCliente(freedom, new Map([["w", [{ id: "p1", monto: 10000, fecha: "2026-10-08", nota: null }]]]));
    expect(c.monto).toBe(450000);
    expect(c.cobradoEl).toBeNull();
    expect(c.pagos.map((p) => [p.id, p.monto])).toEqual([
      ["factura:r", 375000],
      ["p1", 10000],
    ]);
    expect(c.pagos[0].nota).toBe("gestion redes (Personalizado) (pagado aparte)");
  });

  it("una sola factura funciona como siempre", () => {
    const c = cobroDelCliente([{ id: "u", monto: 300000, fecha_cobro: "2026-10-07" }], new Map());
    expect(c.monto).toBe(300000);
    expect(c.cobradoEl).toBe("2026-10-07");
  });

  it("sin facturas: total 0 y sin principal", () => {
    expect(cobroDelCliente([], new Map())).toMatchObject({ monto: 0, principalId: null, cantidad: 0 });
  });
});

describe("editar el total sin tocar los otros servicios", () => {
  it("el ajuste va a la principal", () => {
    expect(montoPrincipalPara(nazar, 500000)).toBe(400000);
  });
  it("si el total no alcanza para cubrir los otros servicios, no se hace", () => {
    expect(montoPrincipalPara(nazar, 90000)).toBeNull();
  });
  it("con una sola factura, es el total", () => {
    expect(montoPrincipalPara([{ id: "u", monto: 1, fecha_cobro: null }], 350000)).toBe(350000);
  });
});

describe("nombre del servicio", () => {
  it("lo saca del concepto", () => {
    expect(nombreServicio("Nazar Hogar · gestion_whatsapp — 2026-10")).toBe("gestion whatsapp");
    expect(nombreServicio(null)).toBe("servicio");
  });
});
