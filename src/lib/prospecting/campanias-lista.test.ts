import { describe, expect, it } from "vitest";
import { filtrarCampanias, haceCuanto, ordenarCampanias, ultimoUso } from "./campanias-lista";

const camp = (id: string, nombre: string, rubro: string, created_at: string, uso: string, ubicacion: string | null = null) => ({
  id,
  nombre,
  rubro,
  ubicacion,
  created_at,
  ultimoUso: uso,
});

const lista = [
  camp("a", "Barberías Mendoza", "Barberías", "2026-09-01T00:00:00Z", "2026-10-04T10:00:00Z", "Mendoza"),
  camp("b", "Arquitectos Córdoba", "Arquitectura", "2026-10-03T00:00:00Z", "2026-10-03T00:00:00Z", "Córdoba"),
  camp("c", "Gimnasios Nueva Córdoba", "Gimnasios", "2026-08-01T00:00:00Z", "2026-09-10T00:00:00Z", "Córdoba"),
];
const ids = (l: { id: string }[]) => l.map((c) => c.id);

describe("ultimoUso", () => {
  it("toma la fecha más reciente entre la creación, la apertura y los contactos", () => {
    expect(ultimoUso("2026-09-01T00:00:00Z", [null, "2026-10-01T00:00:00Z", "2026-09-15T00:00:00Z"])).toBe(
      "2026-10-01T00:00:00Z"
    );
    expect(ultimoUso("2026-09-01T00:00:00Z", [])).toBe("2026-09-01T00:00:00Z");
  });
});

describe("ordenarCampanias", () => {
  it("usadas recientemente primero", () => {
    expect(ids(ordenarCampanias(lista, "uso"))).toEqual(["a", "b", "c"]);
  });
  it("más nuevas", () => {
    expect(ids(ordenarCampanias(lista, "nuevas"))).toEqual(["b", "a", "c"]);
  });
  it("por nombre y por rubro", () => {
    expect(ids(ordenarCampanias(lista, "nombre"))).toEqual(["b", "a", "c"]);
    expect(ids(ordenarCampanias(lista, "rubro"))).toEqual(["b", "a", "c"]);
  });
});

describe("filtrarCampanias", () => {
  it("busca por nombre, rubro o zona sin importar tildes", () => {
    expect(ids(filtrarCampanias(lista, "cordoba"))).toEqual(["b", "c"]);
    expect(ids(filtrarCampanias(lista, "barber"))).toEqual(["a"]);
    expect(ids(filtrarCampanias(lista, "  "))).toHaveLength(3);
  });
});

describe("haceCuanto", () => {
  const ahora = new Date("2026-10-05T12:00:00Z");
  it("en palabras", () => {
    expect(haceCuanto("2026-10-05T08:00:00Z", ahora)).toBe("hoy");
    expect(haceCuanto("2026-10-04T08:00:00Z", ahora)).toBe("ayer");
    expect(haceCuanto("2026-09-25T08:00:00Z", ahora)).toBe("hace 10 días");
    expect(haceCuanto("2026-07-01T08:00:00Z", ahora)).toBe("hace 3 meses");
  });
});
