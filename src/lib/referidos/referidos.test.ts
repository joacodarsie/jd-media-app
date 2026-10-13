import { describe, expect, it } from "vitest";
import {
  conceptoDescuento,
  descuentoReferido,
  estaGanado,
  linkReferido,
  linkWhatsappReferido,
  mensajeReferido,
  puedeRecomendar,
  clienteQueRecomendo,
  tareasContarReferidos,
} from "./referidos";

describe("referidos", () => {
  it("recomienda quien lleva 2 meses o más", () => {
    expect(puedeRecomendar("2026-08-14", "2026-10-13")).toBe(true);
    expect(puedeRecomendar("2026-08-20", "2026-10-13")).toBe(false);
    expect(puedeRecomendar(null, "2026-10-13")).toBe(false);
  });

  it("se gana cuando el recomendado pagó dos meses distintos", () => {
    expect(estaGanado([])).toBe(false);
    expect(estaGanado(["2026-10"])).toBe(false);
    // Dos servicios del mismo mes no cuentan como dos meses.
    expect(estaGanado(["2026-10", "2026-10"])).toBe(false);
    expect(estaGanado(["2026-10", "2026-11"])).toBe(true);
  });

  it("el descuento es el 10% del abono, redondeado a $100", () => {
    expect(descuentoReferido(350000)).toBe(35000);
    expect(descuentoReferido(475000)).toBe(47500);
    expect(descuentoReferido(333333)).toBe(33300);
    expect(descuentoReferido(0)).toBe(0);
  });

  it("link y mensaje con el código, sin emoji", () => {
    expect(linkReferido("ab12cd")).toBe("https://jdmedia.com.ar/?ref=ab12cd");
    expect(mensajeReferido("ab12cd")).toContain("10% de descuento en tu primer mes");
    expect(mensajeReferido("ab12cd")).not.toMatch(/[\u{1F000}-\u{1FFFF}]/u);
    expect(decodeURIComponent(linkWhatsappReferido("ab12cd"))).toContain("?ref=ab12cd");
    expect(conceptoDescuento("Nazar Hogar", "2026-12")).toBe("Descuento por recomendar a Nazar Hogar (10%) — 2026-12");
  });
});

describe("clienteQueRecomendo", () => {
  const cs = [
    { id: "1", nombre: "Nazar Hogar" },
    { id: "2", nombre: "Résonar" },
    { id: "3", nombre: "Magic" },
  ];
  it("por nombre, sin tildes ni mayúsculas", () => {
    expect(clienteQueRecomendo("resonar", cs)).toBe("2");
    expect(clienteQueRecomendo("Lo mandó Nazar Hogar", cs)).toBe("1");
  });
  it("si no es un cliente o es ambiguo, null", () => {
    expect(clienteQueRecomendo("Un amigo de Joaquín", cs)).toBeNull();
    expect(clienteQueRecomendo("Magic y Résonar", cs)).toBeNull();
    expect(clienteQueRecomendo("", cs)).toBeNull();
  });
});

describe("tareasContarReferidos", () => {
  it("una tarea por cuenta que cumplió entre 60 y 90 días", () => {
    const t = tareasContarReferidos(
      [
        { id: "a", nombre: "Nueva", fecha_inicio: "2026-09-20" },
        { id: "b", nombre: "Justa", fecha_inicio: "2026-08-14" },
        { id: "c", nombre: "Vieja", fecha_inicio: "2026-06-01" },
      ],
      "2026-10-13",
      "luz"
    );
    expect(t.map((x) => x.rutina_key)).toEqual(["ref:contar:b"]);
    expect(t[0].asignado_a_id).toBe("luz");
    expect(t[0].fecha_limite).toBe("2026-10-16");
  });
  it("sin PM no se crea nada", () => {
    expect(tareasContarReferidos([{ id: "b", nombre: "J", fecha_inicio: "2026-08-14" }], "2026-10-13", null)).toEqual([]);
  });
});
