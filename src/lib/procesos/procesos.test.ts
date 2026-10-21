import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PROCESOS, procesosDe } from "./procesos";
import { ROLES } from "@/lib/equipo/roles";

const AREAS = new Set(ROLES.map((r) => r.area));

/** La carpeta de la ruta dentro de app/ (con o sin el grupo (app)). */
function existeRuta(href: string) {
  const ruta = href.split(/[?#]/)[0].replace(/^\//, "");
  const base = join(process.cwd(), "src", "app");
  return [join(base, "(app)", ruta, "page.tsx"), join(base, ruta, "page.tsx")].some(existsSync);
}

describe("procesos", () => {
  it("slugs únicos y que no pisan rutas fijas", () => {
    const slugs = PROCESOS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).not.toContain("como-trabajamos");
  });

  it("cada rol y cada «quién» es un área real (o el cliente)", () => {
    for (const p of PROCESOS) {
      for (const r of p.roles) expect(AREAS.has(r), `${p.slug}: ${r}`).toBe(true);
      for (const paso of p.pasos) if (paso.quien) expect(paso.quien === "cliente" || AREAS.has(paso.quien), `${p.slug}: ${paso.quien}`).toBe(true);
    }
  });

  it("cada «dónde» lleva a una pantalla que existe", () => {
    for (const p of PROCESOS) for (const paso of p.pasos) if (paso.donde) expect(existeRuta(paso.donde.href), `${p.slug}: ${paso.donde.href}`).toBe(true);
  });

  it("los roles operativos tienen procesos propios, antes que los de todos", () => {
    for (const area of ["Community Manager", "Diseño", "Edición Audiovisual", "Coordinación", "Coordinación de Diseño", "Comercial", "Coordinación de Paid Media", "Coordinación General"]) {
      const lista = procesosDe(area);
      expect(lista.length, area).toBeGreaterThan(4);
      expect(lista[0].roles.length, area).toBeLessThan(ROLES.length);
    }
  });
});
