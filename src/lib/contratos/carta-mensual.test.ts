import { describe, expect, it } from "vitest";
import { claveCartaMensual, mensajeCartaMensual, periodoCartaEnPortal, periodoSiguiente, plazosDelMes } from "./carta-mensual";

describe("carta acuerdo mensual", () => {
  it("el mes siguiente, también en diciembre", () => {
    expect(periodoSiguiente("2026-10-25")).toBe("2026-11");
    expect(periodoSiguiente("2026-12-25")).toBe("2027-01");
  });

  it("plazos con el último día real del mes", () => {
    const p = plazosDelMes("2026-11");
    expect(p.mes).toBe("noviembre");
    expect(p.segundaQuincena.sale).toBe("del 16 al 30 de noviembre");
    expect(p.primeraDelSiguiente.sale).toBe("del 1 al 15 de diciembre");
    expect(plazosDelMes("2027-02").segundaQuincena.sale).toBe("del 16 al 28 de febrero");
  });

  it("el mensaje trae link, abono, ventana de cobro y los plazos del material crudo", () => {
    const m = mensajeCartaMensual({ contacto: "Ramiro Pérez", marca: "Dintra", periodo: "2026-11", monto: 400000, moneda: "ARS", link: "https://x/carta" });
    expect(m).toContain("¡Hola Ramiro!");
    expect(m).toContain("vigente para noviembre: https://x/carta");
    expect(m).toContain("*ARS 400.000*");
    expect(m).toContain("del 1 al 5");
    expect(m).toContain("material crudo nos llega hasta el 7");
    expect(m).toContain("material crudo hasta el 22");
    expect(m).toContain("el abono no cambia");
    // Nada fuera del plano básico de Unicode (wa.me los rompe).
    expect([...m].every((ch) => ch.codePointAt(0)! <= 0xffff)).toBe(true);
  });

  it("sin contacto saluda a la marca; sin monto ni link no inventa", () => {
    const m = mensajeCartaMensual({ contacto: null, marca: "Wowitos", periodo: "2026-11", monto: 0, moneda: "ARS", link: null });
    expect(m).toContain("¡Hola Wowitos!");
    expect(m).toContain("vigente para noviembre.");
    expect(m).toContain("es el acordado");
  });

  it("en el portal se ve del 25 al 5", () => {
    expect(periodoCartaEnPortal("2026-10-24")).toBeNull();
    expect(periodoCartaEnPortal("2026-10-25")).toBe("2026-11");
    expect(periodoCartaEnPortal("2026-11-03")).toBe("2026-11");
    expect(periodoCartaEnPortal("2026-11-06")).toBeNull();
  });

  it("clave única por cuenta y mes", () => {
    expect(claveCartaMensual("abc", "2026-11")).toBe("carta:abc:2026-11");
  });
});
