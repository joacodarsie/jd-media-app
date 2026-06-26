import { describe, it, expect } from "vitest";
import {
  defaultPermisosForRole,
  defaultPermisosForRoles,
  hasRole,
} from "@/lib/role-defaults";

describe("defaultPermisosForRoles — une los defaults de varios roles", () => {
  it("un solo rol = sus defaults", () => {
    expect(defaultPermisosForRole("comercial")).toEqual({ clientes_credenciales: true });
  });

  it("CM (sin defaults) no tiene permisos", () => {
    expect(defaultPermisosForRole("community_manager")).toEqual({});
  });

  it("suma los features de los dos roles", () => {
    const p = defaultPermisosForRoles(["community_manager", "comercial"]);
    expect(p).toEqual({ clientes_credenciales: true });
  });

  it("coordinador + comercial = unión de ambos", () => {
    const p = defaultPermisosForRoles(["coordinador", "comercial"]);
    expect(p.global).toBe(true);
    expect(p.equipo_compensacion).toBe(true);
    expect(p.clientes_credenciales).toBe(true);
    expect(p.documentos_globales).toBe(true);
  });

  it("ignora null/undefined", () => {
    expect(defaultPermisosForRoles([null, "comercial", undefined])).toEqual({
      clientes_credenciales: true,
    });
  });
});

describe("hasRole — mira primario y secundario", () => {
  it("matchea el primario", () => {
    expect(hasRole({ rol: "comercial", rol_secundario: null }, "comercial")).toBe(true);
  });
  it("matchea el secundario", () => {
    expect(hasRole({ rol: "community_manager", rol_secundario: "comercial" }, "comercial")).toBe(true);
  });
  it("no matchea si no está en ninguno", () => {
    expect(hasRole({ rol: "community_manager", rol_secundario: "diseno" }, "comercial")).toBe(false);
  });
  it("sin secundario funciona", () => {
    expect(hasRole({ rol: "diseno" }, "comercial")).toBe(false);
  });
});
