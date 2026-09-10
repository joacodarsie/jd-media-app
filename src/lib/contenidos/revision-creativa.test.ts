import { describe, it, expect } from "vitest";
import {
  avisosDeRevisionCreativa,
  diasEnRevision,
  piezasTrabadas,
  DIAS_PARA_ESCALAR,
  type CuentaParaRevision,
  type PiezaEnRevision,
} from "./revision-creativa";

const HOY = "2026-09-10";
const CM = "user-cm";
const COORD = "user-coord";
const ADMINS = ["user-admin"];

const cuenta = (over: Partial<CuentaParaRevision> = {}): CuentaParaRevision => ({
  id: "cli-1",
  nombre: "Boxescar",
  estado: "activo",
  cm_id: CM,
  coordinador_id: COORD,
  ...over,
});

const pieza = (over: Partial<PiezaEnRevision> = {}): PiezaEnRevision => ({
  id: "p1",
  cliente_id: "cli-1",
  titulo: "Alarmas",
  estado: "revision_creativa",
  revision_creativa_at: "2026-09-09T12:00:00Z",
  fecha_publicacion: "2026-09-09T12:00:00Z",
  frenado_cliente: false,
  ...over,
});

describe("diasEnRevision", () => {
  it("cuenta desde que entró a revisión", () => {
    expect(diasEnRevision(pieza({ revision_creativa_at: "2026-08-21T10:00:00Z" }), HOY)).toBe(20);
  });

  it("sin la marca de la 0161, mide desde la fecha en que debía salir", () => {
    const p = pieza({ revision_creativa_at: null, fecha_publicacion: "2026-08-21T10:00:00Z" });
    expect(diasEnRevision(p, HOY)).toBe(20);
  });

  it("nunca da negativo", () => {
    expect(diasEnRevision(pieza({ revision_creativa_at: "2026-09-20T10:00:00Z" }), HOY)).toBe(0);
  });
});

describe("piezasTrabadas", () => {
  it("solo las que están en revisión creativa", () => {
    const ps = [pieza(), pieza({ id: "p2", estado: "idea" }), pieza({ id: "p3", estado: "publicado" })];
    expect(piezasTrabadas(ps, [cuenta()]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("descarta las de cuentas que ya no son clientes", () => {
    // Alonso y Power Collections tenían 44 piezas colgadas y ya se habían ido.
    const ps = [pieza(), pieza({ id: "p2", cliente_id: "cli-2" })];
    const cuentas = [cuenta(), cuenta({ id: "cli-2", nombre: "Alonso", estado: "perdido" })];
    expect(piezasTrabadas(ps, cuentas).map((p) => p.id)).toEqual(["p1"]);
  });

  it("descarta las que frenó el cliente", () => {
    expect(piezasTrabadas([pieza({ frenado_cliente: true })], [cuenta()])).toEqual([]);
  });
});

describe("avisosDeRevisionCreativa", () => {
  it("le avisa al CM de la cuenta", () => {
    const avisos = avisosDeRevisionCreativa([pieza()], [cuenta()], ADMINS, HOY);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].userId).toBe(CM);
    expect(avisos[0].escalado).toBe(false);
    expect(avisos[0].mensaje).toContain("Boxescar");
    expect(avisos[0].mensaje).toContain('"Alarmas"');
    expect(avisos[0].link).toBe("/contenidos?cliente=cli-1");
  });

  it("junta las piezas de una misma cuenta en un solo aviso", () => {
    const ps = [pieza(), pieza({ id: "p2", titulo: "Polarizados" })];
    const avisos = avisosDeRevisionCreativa(ps, [cuenta()], ADMINS, HOY);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("2 piezas terminadas esperan");
  });

  it("con una sola pieza recién entrada no dice 'la más vieja, hoy'", () => {
    const p = pieza({ revision_creativa_at: "2026-09-10T09:00:00Z" });
    const [aviso] = avisosDeRevisionCreativa([p], [cuenta()], ADMINS, HOY);
    expect(aviso.mensaje).toBe("🎨 Boxescar: \"Alarmas\" está lista y espera tu visto bueno.");
  });

  it("recorta los títulos que son un párrafo entero", () => {
    // Del calendario real: "POST SIMPLE — “La lluvia no es el problema…"
    const largo = "POST SIMPLE — La lluvia no es el problema. Es la que te avisa que ya había uno.";
    const [aviso] = avisosDeRevisionCreativa([pieza({ titulo: largo })], [cuenta()], ADMINS, HOY);
    expect(aviso.mensaje).toContain("…");
    expect(aviso.mensaje.length).toBeLessThan(120);
  });

  it("no escala mientras esté dentro del plazo", () => {
    const p = pieza({ revision_creativa_at: "2026-09-09T12:00:00Z" }); // 1 día
    const avisos = avisosDeRevisionCreativa([p], [cuenta()], ADMINS, HOY);
    expect(avisos.every((a) => !a.escalado)).toBe(true);
  });

  it("escala a coordinación y a los dueños cuando se pasa", () => {
    // El caso real: "Alarmas" llevaba 19 días esperando y nadie sabía.
    const p = pieza({ revision_creativa_at: "2026-08-21T12:00:00Z" });
    const avisos = avisosDeRevisionCreativa([p], [cuenta()], ADMINS, HOY);
    expect(avisos.map((a) => a.userId).sort()).toEqual([CM, "user-admin", COORD].sort());
    const escalado = avisos.find((a) => a.escalado);
    expect(escalado?.mensaje).toContain("hace 20 días");
    expect(escalado?.mensaje).toContain("Nadie la movió");
  });

  it("no le manda dos avisos a la misma persona", () => {
    // Guillermo es coordinador y CM de su cuenta a la vez.
    const p = pieza({ revision_creativa_at: "2026-08-21T12:00:00Z" });
    const avisos = avisosDeRevisionCreativa([p], [cuenta({ coordinador_id: CM })], ADMINS, HOY);
    expect(avisos.filter((a) => a.userId === CM)).toHaveLength(1);
  });

  it("si la cuenta no tiene CM, el aviso va a coordinación y no se pierde", () => {
    const avisos = avisosDeRevisionCreativa([pieza()], [cuenta({ cm_id: null })], ADMINS, HOY);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].userId).toBe(COORD);
  });

  it("mide la escalada por la pieza más vieja de la cuenta", () => {
    const ps = [
      pieza({ id: "vieja", revision_creativa_at: "2026-08-21T12:00:00Z" }),
      pieza({ id: "nueva", revision_creativa_at: "2026-09-10T12:00:00Z" }),
    ];
    const avisos = avisosDeRevisionCreativa(ps, [cuenta()], ADMINS, HOY);
    expect(avisos.some((a) => a.escalado)).toBe(true);
  });

  it("no dice nada si no hay nada trabado", () => {
    expect(avisosDeRevisionCreativa([], [cuenta()], ADMINS, HOY)).toEqual([]);
  });

  it("el plazo de escalada es de 3 días", () => {
    expect(DIAS_PARA_ESCALAR).toBe(3);
  });
});
