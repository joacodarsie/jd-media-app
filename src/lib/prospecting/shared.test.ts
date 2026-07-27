/**
 * Tests de `waDigits`: la normalización de teléfonos para wa.me. El caso crítico
 * es Argentina (el 9 después del 54 y el "15" local metido en el número): con
 * los dígitos crudos, wa.me abre un chat muerto y parece que "el número no
 * funciona en WhatsApp" cuando en realidad está mal formateado.
 */
import { describe, it, expect } from "vitest";
import {
  waDigits,
  intlWhatsappLink,
  mensajeElegido,
  personalizarMensaje,
} from "./shared";

describe("waDigits — celulares argentinos", () => {
  it("ya correcto (54 9 área número) pasa tal cual", () => {
    expect(waDigits("+54 9 351 331 9555")).toBe("5493513319555");
  });

  it("agrega el 9 si falta (formato publicado por los negocios)", () => {
    expect(waDigits("+54 351 331 9555")).toBe("5493513319555");
  });

  it("saca el 15 local y agrega el 9 (área de 3 dígitos, Córdoba)", () => {
    expect(waDigits("+54 351 15 331 9555")).toBe("5493513319555");
  });

  it("saca el 15 con área de 2 dígitos (Buenos Aires)", () => {
    expect(waDigits("+54 11 15 4321 8765")).toBe("5491143218765");
  });

  it("saca el 15 con área de 4 dígitos (interior)", () => {
    expect(waDigits("+54 3543 15 62 1122")).toBe("5493543621122");
  });

  it("formato local con 0 adelante se asume Argentina", () => {
    expect(waDigits("0351 15 331 9555")).toBe("5493513319555");
  });

  it("no toca un fijo nacional de 10 dígitos sin 15 (solo suma el 9)", () => {
    expect(waDigits("+54 351 422 7788")).toBe("5493514227788");
  });
});

describe("waDigits — otros países y bordes", () => {
  it("España pasa tal cual", () => {
    expect(waDigits("+34 612 345 678")).toBe("34612345678");
  });

  it("prefijo internacional 00 se limpia", () => {
    expect(waDigits("0034 612 345 678")).toBe("34612345678");
  });

  it("muy corto devuelve null", () => {
    expect(waDigits("12345")).toBeNull();
  });
});

describe("intlWhatsappLink", () => {
  it("arma el link con el número normalizado y el texto escapado", () => {
    const link = intlWhatsappLink("+54 351 15 331 9555", "Hola, ¿cómo están?");
    expect(link).toBe(
      `https://wa.me/5493513319555?text=${encodeURIComponent("Hola, ¿cómo están?")}`
    );
  });

  it("sin teléfono devuelve null", () => {
    expect(intlWhatsappLink(null, "hola")).toBeNull();
    expect(intlWhatsappLink("   ", "hola")).toBeNull();
  });
});

describe("mensajeElegido — cuál se usa para escribirle a un contacto", () => {
  const tpl = {
    primer_mensaje: "Uno",
    alternativa: "Dos",
    seguimiento_1: "Tres",
    seguimiento_2: "Cuatro",
  };

  it("sin elección usa el primer mensaje", () => {
    expect(mensajeElegido(tpl)?.texto).toBe("Uno");
  });

  it("respeta el bloque elegido a mano", () => {
    const r = mensajeElegido({ ...tpl, elegido: "alternativa" });
    expect(r?.texto).toBe("Dos");
    expect(r?.label).toBe("Alternativa (otro ángulo)");
  });

  it("si el elegido quedó vacío cae al siguiente con texto", () => {
    const r = mensajeElegido({ ...tpl, alternativa: "", elegido: "alternativa" });
    expect(r?.texto).toBe("Uno");
  });

  it("sin plantilla o toda vacía devuelve null", () => {
    expect(mensajeElegido(null)).toBeNull();
    expect(
      mensajeElegido({ primer_mensaje: "", alternativa: "", seguimiento_1: "", seguimiento_2: "" })
    ).toBeNull();
  });
});

describe("personalizarMensaje", () => {
  it("reemplaza empresa y nombre de pila", () => {
    expect(
      personalizarMensaje("Hola [NOMBRE], ¿cómo están en [EMPRESA]?", {
        empresa: "Boxescar",
        contacto: "Américo Pereira",
      })
    ).toBe("Hola Américo, ¿cómo están en Boxescar?");
  });

  it("sin persona saca el hueco sin dejar el saludo colgado", () => {
    expect(
      personalizarMensaje("Hola [NOMBRE], ¿cómo están en [EMPRESA]?", { empresa: "Magic" })
    ).toBe("Hola, ¿cómo están en Magic?");
  });

  it("reemplaza TODAS las apariciones de la empresa", () => {
    expect(
      personalizarMensaje("[EMPRESA] y [EMPRESA]", { empresa: "Filí" })
    ).toBe("Filí y Filí");
  });
});
