import { describe, expect, it } from "vitest";
import { dondeEstamos, hitosRegulares, quincenaDeArranque, quincenasDesde } from "./ciclo";

const fechas = (inicio: string) => Object.fromEntries(hitosRegulares(inicio).map((h) => [h.clave, `${h.desde}→${h.hasta}`]));

describe("hitosRegulares", () => {
  it("la quincena del 16: todo pasa entre el 1 y el 15 del mismo mes", () => {
    expect(fechas("2026-11-16")).toEqual({
      calendario: "2026-11-01→2026-11-02",
      aprueba_director_calendario: "2026-11-03→2026-11-04",
      aprueba_cliente_calendario: "2026-11-05→2026-11-05",
      material: "2026-11-05→2026-11-07",
      produccion: "2026-11-05→2026-11-13",
      aprueba_director_piezas: "2026-11-14→2026-11-14",
      aprueba_cliente_piezas: "2026-11-15→2026-11-15",
      publica: "2026-11-16→2026-11-16",
    });
  });

  it("la quincena del 1: se prepara entre el 15 y el 30 del mes anterior, cruzando el año", () => {
    const f = fechas("2027-01-01");
    expect(f.calendario).toBe("2026-12-15→2026-12-17");
    expect(f.aprueba_director_calendario).toBe("2026-12-18→2026-12-19");
    expect(f.aprueba_cliente_calendario).toBe("2026-12-20→2026-12-20");
    expect(f.material).toBe("2026-12-20→2026-12-22");
    expect(f.aprueba_director_piezas).toBe("2026-12-29→2026-12-29");
    expect(f.aprueba_cliente_piezas).toBe("2026-12-30→2026-12-30");
  });

  it("en febrero el 29 y el 30 pasan a ser los dos últimos días", () => {
    const f = fechas("2027-03-01");
    expect(f.aprueba_director_piezas).toBe("2027-02-27→2027-02-27");
    expect(f.aprueba_cliente_piezas).toBe("2027-02-28→2027-02-28");
    expect(f.produccion).toBe("2027-02-20→2027-02-26");
  });
});

describe("arranque (regla de Luz)", () => {
  it("Global Business Lab entró el 7/10: publica desde el 22 y el primer calendario cubre hasta el 31", () => {
    const q = quincenaDeArranque("2026-10-07");
    expect([q.inicio, q.fin, q.arranque]).toEqual(["2026-10-22", "2026-10-31", true]);
    // Y entre el 15 y el 17 de octubre ya se presenta el de la primera quincena de noviembre.
    const sig = quincenasDesde("2026-10-07", "2026-11-15")[1];
    expect(sig.inicio).toBe("2026-11-01");
    expect(sig.hitos[0].desde).toBe("2026-10-15");
  });

  it("si el primer tramo queda de menos de 5 días, se estira a la quincena siguiente", () => {
    const q = quincenaDeArranque("2026-10-28"); // publica el 12/11 → hasta el 15 son 4 días
    expect([q.inicio, q.fin]).toEqual(["2026-11-12", "2026-11-30"]);
  });
});

describe("dondeEstamos", () => {
  it("GBL el 17/10: prepara el arranque, todavía no publica y al cliente no le toca nada hoy", () => {
    const d = dondeEstamos("2026-10-07", "2026-10-17");
    expect(d.publicando).toBeNull();
    expect(d.preparando.inicio).toBe("2026-10-22");
    expect(d.hito.clave).toBe("produccion");
    expect(d.alCliente).toBeNull();
    // Y en paralelo, hoy vence el calendario de la 1ª quincena de noviembre.
    expect(d.tambien.map((t) => [t.quincena.inicio, t.hito.clave, t.hito.hasta])).toEqual([["2026-11-01", "calendario", "2026-10-17"]]);
  });

  it("una cuenta en régimen el 5 de noviembre: publica la 1ª quincena y el cliente tiene que aprobar el calendario", () => {
    const d = dondeEstamos("2026-07-01", "2026-11-05");
    expect(d.publicando?.inicio).toBe("2026-11-01");
    expect(d.preparando.inicio).toBe("2026-11-16");
    expect(d.hito.clave).toBe("aprueba_cliente_calendario");
    expect(d.faltan).toBe(0);
    expect(d.alCliente?.clave).toBe("aprueba_cliente_calendario");
    expect(d.avance).toBeGreaterThan(0.2);
    expect(d.avance).toBeLessThan(0.4);
  });

  it("entre quincenas (el 10): producción, faltan 3 días", () => {
    const d = dondeEstamos("2026-07-01", "2026-11-10");
    expect(d.hito.clave).toBe("produccion");
    expect(d.faltan).toBe(3);
  });
});
