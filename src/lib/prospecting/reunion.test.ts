import { describe, it, expect } from "vitest";
import { avisosDeHoy, cuandoReunion, diaAr, horaAr, linkGoogleCalendar, tituloReunion } from "./reunion";

// 25/9/2026 15:00 en Argentina = 18:00 UTC.
const QUINCE_AR = "2026-09-25T18:00:00.000Z";

describe("reunión con un prospecto", () => {
  it("escribe la hora en Argentina aunque el server corra en UTC", () => {
    expect(horaAr(QUINCE_AR)).toBe("15:00");
    expect(cuandoReunion(QUINCE_AR)).toMatch(/25\/9, 15:00$/);
    expect(diaAr(QUINCE_AR)).toBe("2026-09-25");
    // 22:30 del 25 en Argentina ya es 26 en UTC: el día tiene que seguir siendo 25.
    expect(diaAr("2026-09-26T01:30:00.000Z")).toBe("2026-09-25");
  });

  it("arma el link de Google Calendar con el evento cargado", () => {
    const url = new URL(
      linkGoogleCalendar({
        titulo: tituloReunion("Point"),
        inicio: QUINCE_AR,
        fin: "2026-09-25T18:45:00.000Z",
        detalle: "Contacto: Ana",
      })
    );
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Reunión comercial · Point");
    expect(url.searchParams.get("dates")).toBe("20260925T180000Z/20260925T184500Z");
    expect(url.searchParams.get("details")).toBe("Contacto: Ana");
  });

  it("el aviso de la mañana junta las reuniones de hoy de cada persona", () => {
    const avisos = avisosDeHoy(
      [
        { titulo: "Reunión comercial · B", starts_at: "2026-09-25T20:00:00.000Z", asistentes: ["santi", "joaco"] },
        { titulo: "Reunión comercial · A", starts_at: QUINCE_AR, asistentes: ["santi"] },
        { titulo: "Mañana", starts_at: "2026-09-26T15:00:00.000Z", asistentes: ["santi"] },
      ],
      "2026-09-25"
    );
    expect(avisos.get("santi")).toBe(
      "Hoy tenés 2 reuniones: 15:00 Reunión comercial · A · 17:00 Reunión comercial · B"
    );
    expect(avisos.get("joaco")).toBe("Hoy tenés reunión: 17:00 Reunión comercial · B");
  });
});
