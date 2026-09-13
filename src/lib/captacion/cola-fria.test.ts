import { describe, it, expect } from "vitest";
import {
  tieneWhatsapp,
  puntajeContacto,
  pendientes,
  diasDesdeIso,
  colaDelDia,
  diasDeCola,
  type ContactoFrio,
} from "./cola-fria";

const base: ContactoFrio = {
  id: "1",
  campaign_id: "c1",
  empresa: "Empresa",
  contacto_nombre: null,
  contacto_rol: null,
  telefono: null,
  instagram: null,
  sitio_web: null,
  estado: "nuevo",
  asignado_a: "u1",
  contactado_at: null,
  contactable: null,
};
const c = (over: Partial<ContactoFrio>): ContactoFrio => ({ ...base, ...over });

describe("tieneWhatsapp", () => {
  it("acepta un celular argentino con el 9 internacional", () => {
    expect(tieneWhatsapp("+54 9 351 538-5583")).toBe(true);
  });

  it("acepta el formato que trae Google Maps cuando el abonado no arranca con 4", () => {
    // Es la forma real en la que llegan los contactos de Places.
    expect(tieneWhatsapp("+54 351 538-5583")).toBe(true);
  });

  it("rechaza un fijo clásico de Córdoba", () => {
    expect(tieneWhatsapp("+54 351 423-4567")).toBe(false);
  });

  it("rechaza la falta de teléfono", () => {
    expect(tieneWhatsapp(null)).toBe(false);
    expect(tieneWhatsapp("")).toBe(false);
  });

  it("acepta un número de afuera: no sabemos leerlo pero es contactable", () => {
    expect(tieneWhatsapp("+34 957 83 72 97")).toBe(true);
  });
});

describe("puntajeContacto", () => {
  it("pone el celular muy por encima del fijo", () => {
    const cel = puntajeContacto(c({ telefono: "+54 9 351 538-5583" }));
    const fijo = puntajeContacto(c({ telefono: "+54 351 423-4567" }));
    expect(cel).toBeGreaterThan(fijo);
  });

  it("suma por tener el nombre de la persona", () => {
    const conNombre = puntajeContacto(c({ telefono: "+54 9 351 538-5583", contacto_nombre: "Fani" }));
    const sinNombre = puntajeContacto(c({ telefono: "+54 9 351 538-5583" }));
    expect(conNombre).toBeGreaterThan(sinNombre);
  });

  it("un contacto sin ningún dato de contacto vale cero", () => {
    expect(puntajeContacto(c({}))).toBe(0);
  });
});

describe("pendientes", () => {
  it("deja afuera los ya trabajados y los que no se pudieron contactar", () => {
    const r = pendientes([
      c({ id: "a" }),
      c({ id: "b", estado: "contactado" }),
      c({ id: "c", contactable: false }),
      c({ id: "d", estado: "descartado" }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("diasDesdeIso", () => {
  it("cuenta los días entre la fecha de contacto y hoy", () => {
    expect(diasDesdeIso("2026-09-10T12:00:00Z", "2026-09-13")).toBe(3);
  });

  it("devuelve null si nunca se contactó", () => {
    expect(diasDesdeIso(null, "2026-09-13")).toBeNull();
  });
});

describe("colaDelDia", () => {
  const hoy = "2026-09-13";

  it("solo trae los contactos de esa persona", () => {
    const r = colaDelDia({
      contactos: [c({ id: "mio" }), c({ id: "ajeno", asignado_a: "otro" }), c({ id: "nadie", asignado_a: null })],
      userId: "u1",
      meta: 20,
      hoy,
    });
    expect(r.cola.map((x) => x.id)).toEqual(["mio"]);
  });

  it("ordena los whatsappeables primero", () => {
    const r = colaDelDia({
      contactos: [
        c({ id: "fijo", empresa: "A", telefono: "+54 351 423-4567" }),
        c({ id: "cel", empresa: "B", telefono: "+54 9 351 538-5583" }),
        c({ id: "nada", empresa: "C" }),
      ],
      userId: "u1",
      meta: 20,
      hoy,
    });
    expect(r.cola.map((x) => x.id)).toEqual(["cel", "fijo", "nada"]);
  });

  it("cuenta lo hecho hoy y lo que falta para la meta", () => {
    const r = colaDelDia({
      contactos: [
        c({ id: "1", estado: "contactado", contactado_at: `${hoy}T10:00:00Z` }),
        c({ id: "2", estado: "contactado", contactado_at: `${hoy}T11:00:00Z` }),
        c({ id: "3" }),
      ],
      userId: "u1",
      meta: 5,
      hoy,
    });
    expect(r.hechosHoy).toBe(2);
    expect(r.faltanHoy).toBe(3);
  });

  it("no pide de más cuando ya cumplió la meta", () => {
    const contactos = Array.from({ length: 7 }, (_, i) =>
      c({ id: String(i), estado: "contactado", contactado_at: `${hoy}T10:00:00Z` })
    );
    const r = colaDelDia({ contactos, userId: "u1", meta: 5, hoy });
    expect(r.faltanHoy).toBe(0);
  });

  it("saca los seguimientos: contactados hace 3 días o más, el más viejo primero", () => {
    const r = colaDelDia({
      contactos: [
        c({ id: "ayer", estado: "contactado", contactado_at: "2026-09-12T10:00:00Z" }),
        c({ id: "hace3", estado: "contactado", contactado_at: "2026-09-10T10:00:00Z" }),
        c({ id: "hace9", estado: "contactado", contactado_at: "2026-09-04T10:00:00Z" }),
      ],
      userId: "u1",
      meta: 20,
      hoy,
    });
    expect(r.seguimientos.map((x) => x.id)).toEqual(["hace9", "hace3"]);
  });

  it("un interesado no es un seguimiento: ya contestó", () => {
    const r = colaDelDia({
      contactos: [c({ id: "i", estado: "interesado", contactado_at: "2026-09-04T10:00:00Z" })],
      userId: "u1",
      meta: 20,
      hoy,
    });
    expect(r.seguimientos).toHaveLength(0);
  });

  it("informa cuántos de los pendientes tienen WhatsApp", () => {
    const r = colaDelDia({
      contactos: [
        c({ id: "a", telefono: "+54 9 351 538-5583" }),
        c({ id: "b", telefono: "+54 351 423-4567" }),
      ],
      userId: "u1",
      meta: 20,
      hoy,
    });
    expect(r.pendientesTotal).toBe(2);
    expect(r.conWhatsapp).toBe(1);
  });
});

describe("diasDeCola", () => {
  it("dice cuántos días de trabajo quedan al ritmo de la meta", () => {
    expect(diasDeCola(100, 20)).toBe(5);
  });

  it("sin meta no hay ritmo que proyectar", () => {
    expect(diasDeCola(100, 0)).toBeNull();
  });
});
