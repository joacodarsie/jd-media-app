import { describe, it, expect } from "vitest";
import {
  META_DIARIA,
  avisoParaElDueno,
  avisoPersonal,
  diasEntre,
  lunesDe,
  resumirActividad,
  type ContactoActividad,
} from "./actividad";

const HOY = "2026-08-04"; // martes
const personas = [
  { id: "guille", nombre: "Guillermo García" },
  { id: "gonza", nombre: "Gonzalo Díaz Perrín" },
];

/** n contactos escritos por `quien` el día `dia`. */
function escritos(quien: string, dia: string, n: number, extra: Partial<ContactoActividad> = {}) {
  return Array.from({ length: n }, () => ({
    asignado_a: quien,
    contactado_at: `${dia}T14:00:00+00:00`,
    estado: "contactado",
    ...extra,
  }));
}

describe("lunesDe", () => {
  it("un martes devuelve el lunes anterior", () => {
    expect(lunesDe("2026-08-04")).toBe("2026-08-03");
  });
  it("un lunes se devuelve a sí mismo", () => {
    expect(lunesDe("2026-08-03")).toBe("2026-08-03");
  });
  it("un domingo cae en el lunes de esa misma semana", () => {
    expect(lunesDe("2026-08-09")).toBe("2026-08-03");
  });
});

describe("diasEntre", () => {
  it("cuenta los días sin que la zona horaria lo corra", () => {
    expect(diasEntre("2026-07-31", "2026-08-04")).toBe(4);
    expect(diasEntre("2026-08-04", "2026-08-04")).toBe(0);
  });
});

describe("resumirActividad", () => {
  it("cuenta hoy, la semana y el mes por persona", () => {
    const c = [
      ...escritos("guille", HOY, 3),
      ...escritos("guille", "2026-08-03", 5), // lunes de esta semana
      ...escritos("guille", "2026-07-28", 2), // mes pasado
      ...escritos("gonza", HOY, 1),
    ];
    const r = resumirActividad(c, personas, HOY);
    const g = r.filas.find((f) => f.id === "guille")!;
    expect(g.hoy).toBe(3);
    expect(g.semana).toBe(8);
    expect(g.mes).toBe(8); // los de julio no cuentan
    expect(r.totalHoy).toBe(4);
  });

  it("no cuenta los contactos que nadie contactó todavía", () => {
    const c: ContactoActividad[] = [
      { asignado_a: "guille", contactado_at: null, estado: "nuevo" },
      { asignado_a: null, contactado_at: `${HOY}T10:00:00+00:00`, estado: "contactado" },
    ];
    const r = resumirActividad(c, personas, HOY);
    expect(r.totalHoy).toBe(0);
    expect(r.nadieEscribioHoy).toBe(true);
  });

  it("marca como colgado al que hace 3 días o más que no escribe", () => {
    const c = [...escritos("guille", "2026-08-01", 4), ...escritos("gonza", HOY, 1)];
    const r = resumirActividad(c, personas, HOY);
    expect(r.colgados.map((f) => f.id)).toEqual(["guille"]);
    expect(r.filas.find((f) => f.id === "guille")!.diasSinEscribir).toBe(3);
  });

  it("el que nunca escribió también está colgado", () => {
    const r = resumirActividad(escritos("guille", HOY, 1), personas, HOY);
    const gonza = r.filas.find((f) => f.id === "gonza")!;
    expect(gonza.diasSinEscribir).toBeNull();
    expect(r.colgados.map((f) => f.id)).toContain("gonza");
  });

  it("cumpleHoy solo con la meta completa", () => {
    const r = resumirActividad(escritos("guille", HOY, META_DIARIA), personas, HOY);
    expect(r.filas.find((f) => f.id === "guille")!.cumpleHoy).toBe(true);
    const r2 = resumirActividad(escritos("guille", HOY, META_DIARIA - 1), personas, HOY);
    expect(r2.filas.find((f) => f.id === "guille")!.cumpleHoy).toBe(false);
  });

  it("cuenta interesados y reuniones, que es lo que importa de verdad", () => {
    const c = [
      ...escritos("guille", HOY, 2, { estado: "interesado" }),
      ...escritos("guille", HOY, 1, { estado: "reunion" }),
    ];
    const g = resumirActividad(c, personas, HOY).filas.find((f) => f.id === "guille")!;
    expect(g.interesados).toBe(2);
    expect(g.reuniones).toBe(1);
  });

  it("ordena por quién más escribió esta semana", () => {
    const c = [...escritos("gonza", HOY, 9), ...escritos("guille", HOY, 2)];
    expect(resumirActividad(c, personas, HOY).filas[0].id).toBe("gonza");
  });
});

describe("avisos", () => {
  it("felicita al que cumplió y le dice cuánto falta al que no", () => {
    const r = resumirActividad(escritos("guille", HOY, META_DIARIA), personas, HOY);
    expect(avisoPersonal(r.filas.find((f) => f.id === "guille")!)).toContain("Meta cumplida");
    const r2 = resumirActividad(escritos("guille", HOY, 5), personas, HOY);
    expect(avisoPersonal(r2.filas.find((f) => f.id === "guille")!)).toContain(
      `Te faltan ${META_DIARIA - 5}`
    );
  });

  it("al que nunca escribió le explica la meta, sin retarlo con días", () => {
    const r = resumirActividad([], personas, HOY);
    expect(avisoPersonal(r.filas[0])).toContain("todavía no escribiste");
  });

  it("el aviso del dueño avisa fuerte cuando no escribió nadie", () => {
    expect(avisoParaElDueno(resumirActividad([], personas, HOY))).toContain("no escribió nadie");
  });

  it("el aviso del dueño lista quién escribió y cuánto", () => {
    const c = [...escritos("guille", HOY, 4), ...escritos("gonza", HOY, 2)];
    const t = avisoParaElDueno(resumirActividad(c, personas, HOY));
    expect(t).toContain("Guillermo 4");
    expect(t).toContain("Gonzalo 2");
  });
});
