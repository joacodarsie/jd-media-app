import { describe, expect, it } from "vitest";
import { esIdDeEmpresa } from "./ig-id";

describe("esIdDeEmpresa", () => {
  it("acepta el ID de empresa y rechaza el número corto del perfil", () => {
    expect(esIdDeEmpresa("17841444381839945")).toBe(true);
    expect(esIdDeEmpresa("44319567394")).toBe(false);
    expect(esIdDeEmpresa("")).toBe(false);
    expect(esIdDeEmpresa(null)).toBe(false);
  });
});
