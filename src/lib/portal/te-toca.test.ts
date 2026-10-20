import { describe, expect, it } from "vitest";
import { itemsTeToca, nombreParaCliente } from "./te-toca";

const nada = {
  piezasParaRevisar: 0,
  pausadas: [],
  faltaMaterial: false,
  faltanAccesos: false,
  abonoPendiente: null,
  elegirReunion: false,
  encuesta: false,
};

describe("itemsTeToca", () => {
  it("sin pendientes, vacío", () => {
    expect(itemsTeToca(nada)).toEqual([]);
  });

  it("lo que frena al equipo va primero y la encuesta al final", () => {
    const r = itemsTeToca({
      ...nada,
      encuesta: true,
      piezasParaRevisar: 3,
      abonoPendiente: "octubre",
      pausadas: [{ titulo: "Diseñar pieza: POST — Collage 26.09 · Résonar", bloqueo_detalle: null }],
    });
    expect(r.map((i) => i.clave)).toEqual(["pausa:Diseñar pieza: POST — Collage 26.09 · Résonar", "revisar", "abono", "encuesta"]);
    expect(r[0].texto).toBe("Te estamos esperando para seguir con «Collage 26.09»");
    expect(r[1].texto).toBe("Revisar 3 piezas");
    expect(r[2]).toMatchObject({ texto: "Abonar octubre", href: "#abono" });
  });

  it("si el equipo escribió qué falta, eso es lo que lee el cliente", () => {
    const r = itemsTeToca({ ...nada, pausadas: [{ titulo: "x", bloqueo_detalle: "  los videos del local  " }] });
    expect(r[0].texto).toBe("Te estamos esperando: los videos del local");
  });

  it("singular y anclas", () => {
    const r = itemsTeToca({ ...nada, piezasParaRevisar: 1, faltaMaterial: true, faltanAccesos: true, elegirReunion: true });
    expect(r.map((i) => [i.texto, i.href])).toEqual([
      ["Revisar 1 pieza", "#revisar"],
      ["Subir tus fotos y videos", "#material"],
      ["Cargar los accesos de tus redes", "#accesos"],
      ["Elegir el día de tu reunión del mes", "#reunion"],
    ]);
  });
});

it("la carta del mes va después del abono, con su link", () => {
  const r = itemsTeToca({ ...nada, abonoPendiente: "noviembre", encuesta: true, cartaDelMes: { mes: "noviembre", href: "/contrato/cliente/x?token=t" } });
  expect(r.map((i) => i.clave)).toEqual(["abono", "carta", "encuesta"]);
  expect(r[1]).toMatchObject({ texto: "Leer tu carta acuerdo de noviembre", href: "/contrato/cliente/x?token=t" });
});

describe("nombreParaCliente", () => {
  it("saca el prefijo interno y la cuenta", () => {
    expect(nombreParaCliente("Diseñar pieza: CARRUSEL — La música nos encuentra a todos · Résonar")).toBe("La música nos encuentra a todos");
    expect(nombreParaCliente("Logo final, paleta y tipografías")).toBe("Logo final, paleta y tipografías");
    expect(nombreParaCliente("Editar: reel de apertura")).toBe("reel de apertura");
  });
});
