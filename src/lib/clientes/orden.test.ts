import { describe, it, expect } from "vitest";
import { ordenarClientes, detalleFecha } from "./orden";

const lista = [
  { nombre: "Catch", fecha_inicio: "2026-09-15", fecha_inactivado: null },
  { nombre: "Amelia", fecha_inicio: "2026-06-01", fecha_inactivado: "2026-08-20T13:00:00Z" },
  { nombre: "Boxescar", fecha_inicio: null, fecha_activado: "2026-07-10T10:00:00Z", fecha_inactivado: "2026-09-02T10:00:00Z" },
  { nombre: "Dionisi", fecha_inicio: null, fecha_activado: null, created_at: null },
];
const nombres = (l: { nombre: string }[]) => l.map((c) => c.nombre);

describe("ordenarClientes", () => {
  it("por nombre", () => {
    expect(nombres(ordenarClientes(lista, "nombre"))).toEqual(["Amelia", "Boxescar", "Catch", "Dionisi"]);
  });

  it("más nuevos primero, usando la activación si falta la fecha de inicio; sin fecha al final", () => {
    expect(nombres(ordenarClientes(lista, "nuevos"))).toEqual(["Catch", "Boxescar", "Amelia", "Dionisi"]);
  });

  it("más antiguos primero; sin fecha al final", () => {
    expect(nombres(ordenarClientes(lista, "antiguos"))).toEqual(["Amelia", "Boxescar", "Catch", "Dionisi"]);
  });

  it("última baja primero; los que nunca se fueron después", () => {
    expect(nombres(ordenarClientes(lista, "baja"))).toEqual(["Boxescar", "Amelia", "Catch", "Dionisi"]);
  });

  it("no toca la lista original", () => {
    ordenarClientes(lista, "nuevos");
    expect(lista[0].nombre).toBe("Catch");
  });
});

describe("detalleFecha", () => {
  it("muestra la fecha que corresponde al orden", () => {
    expect(detalleFecha(lista[1], "nuevos")).toBe("entró el 1 jun 2026");
    expect(detalleFecha(lista[1], "baja")).toBe("se fue el 20 ago 2026");
    expect(detalleFecha(lista[0], "baja")).toBe("entró el 15 sep 2026");
    expect(detalleFecha(lista[1], "nombre")).toBeNull();
    expect(detalleFecha(lista[3], "nuevos")).toBeNull();
  });
});
