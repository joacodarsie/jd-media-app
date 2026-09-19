import { describe, it, expect } from "vitest";
import {
  eventoEsReunion,
  normalizar,
  reunionesDesdeCalendario,
  type EventoCalendario,
} from "./reunion-desde-calendario";

const ev = (over: Partial<EventoCalendario> = {}): EventoCalendario => ({
  id: "e1",
  summary: "Reunión mensual Magic",
  start: "2026-09-10T15:00:00Z",
  ...over,
});

const base = {
  eventos: [ev()],
  cuentas: [{ id: "c1", nombre: "Magic" }],
  yaRegistradas: [],
  periodo: "2026-09",
  ahora: "2026-09-19T12:00:00Z",
};

describe("eventoEsReunion", () => {
  it("reconoce el nombre de la cuenta aunque cambien acentos y mayúsculas", () => {
    expect(eventoEsReunion(ev({ summary: "REUNION MENSUAL RESONAR" }), "Résonar")).toBe(true);
  });

  it("no cuenta un evento que solo nombra a la cuenta", () => {
    expect(eventoEsReunion(ev({ summary: "Magic" }), "Magic")).toBe(false);
    expect(eventoEsReunion(ev({ summary: "Grabación Magic" }), "Magic")).toBe(false);
  });

  it("no cuenta un evento de otra cuenta", () => {
    expect(eventoEsReunion(ev({ summary: "Reunión mensual La Azotea" }), "Magic")).toBe(false);
  });

  it("un evento cancelado no cuenta", () => {
    expect(eventoEsReunion(ev({ status: "cancelled" }), "Magic")).toBe(false);
  });

  it("un nombre de cuenta muy corto no matchea nunca: daría falsos positivos", () => {
    expect(eventoEsReunion(ev({ summary: "Reunión JD semanal" }), "JD")).toBe(false);
  });

  it("normalizar saca acentos y espacios de más", () => {
    expect(normalizar("  Résonar   SA ")).toBe("resonar sa");
  });
});

describe("reunionesDesdeCalendario", () => {
  it("da por dada la reunión del mes con la fecha del evento", () => {
    const out = reunionesDesdeCalendario(base);
    expect(out).toEqual([
      { cliente_id: "c1", periodo: "2026-09", fecha: "2026-09-10", evento: "Reunión mensual Magic" },
    ]);
  });

  it("un evento que todavía no empezó no cuenta", () => {
    const out = reunionesDesdeCalendario({
      ...base,
      eventos: [ev({ start: "2026-09-25T15:00:00Z" })],
    });
    expect(out).toHaveLength(0);
  });

  it("un evento de otro mes no cuenta", () => {
    const out = reunionesDesdeCalendario({
      ...base,
      eventos: [ev({ start: "2026-08-10T15:00:00Z" })],
    });
    expect(out).toHaveLength(0);
  });

  it("no pisa lo que ya está registrado", () => {
    expect(reunionesDesdeCalendario({ ...base, yaRegistradas: ["c1"] })).toHaveLength(0);
  });

  it("con varias reuniones del mes vale la última", () => {
    const out = reunionesDesdeCalendario({
      ...base,
      eventos: [
        ev({ id: "a", start: "2026-09-03T15:00:00Z" }),
        ev({ id: "b", start: "2026-09-12T15:00:00Z" }),
      ],
    });
    expect(out[0].fecha).toBe("2026-09-12");
  });

  it("una cuenta sin evento no se inventa", () => {
    const out = reunionesDesdeCalendario({
      ...base,
      cuentas: [
        { id: "c1", nombre: "Magic" },
        { id: "c2", nombre: "La Azotea" },
      ],
    });
    expect(out.map((r) => r.cliente_id)).toEqual(["c1"]);
  });
});
