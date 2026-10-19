import { describe, expect, it } from "vitest";
import { avisoSinMedir, cuentasSinMedir, tareaVincular } from "./vinculacion-ig";

const c = (id: string, o: Partial<{ fechaInicio: string | null; necesitaInstagram: boolean }> = {}) => ({
  id,
  nombre: id.toUpperCase(),
  fechaInicio: "2026-10-01",
  igUsername: null,
  necesitaInstagram: true,
  ...o,
});

describe("cuentas sin medir", () => {
  it("solo las que necesitan Instagram y no trajeron datos, la más vieja primero", () => {
    const r = cuentasSinMedir([c("a"), c("b", { fechaInicio: "2026-09-01" }), c("c"), c("d", { necesitaInstagram: false })], new Set(["c"]), "2026-10-19");
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
    expect(r[0].dias).toBe(48);
  });
  it("el aviso nombra hasta 5 y la tarea trae los pasos", () => {
    const lista = cuentasSinMedir(["a", "b", "c", "d", "e", "f"].map((x) => c(x)), new Set(), "2026-10-19");
    expect(avisoSinMedir(lista)).toMatch(/^🔗 6 cuentas sin medir Instagram: .* y 1 más\./);
    expect(avisoSinMedir([])).toBeNull();
    expect(tareaVincular(lista[0]).descripcion).toContain("Asignar activos");
  });
});
