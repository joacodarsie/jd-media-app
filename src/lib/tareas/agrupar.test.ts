import { describe, it, expect } from "vitest";
import {
  agruparPorTicket,
  contarAgrupadas,
  madresQueFaltan,
  type TareaAgrupable,
} from "./agrupar";

const t = (
  id: string,
  over: Partial<TareaAgrupable> = {}
): TareaAgrupable => ({ id, titulo: id, parent_id: null, numero: null, ...over });

describe("agruparPorTicket", () => {
  it("una lista sin subtareas queda igual", () => {
    const r = agruparPorTicket([t("a"), t("b")]);
    expect(r.map((f) => f.tipo)).toEqual(["suelta", "suelta"]);
    expect(r.map((f) => f.tarea.id)).toEqual(["a", "b"]);
  });

  it("mete la subtarea adentro de su ticket y la saca de arriba", () => {
    const r = agruparPorTicket([t("madre"), t("hija", { parent_id: "madre" }), t("otra")]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ tipo: "ticket" });
    expect(r[0].tipo === "ticket" && r[0].subtareas.map((s) => s.id)).toEqual(["hija"]);
    expect(r[1].tarea.id).toBe("otra");
  });

  it("respeta el orden en que venía la lista", () => {
    const r = agruparPorTicket([t("z"), t("madre"), t("hija", { parent_id: "madre" }), t("a")]);
    expect(r.map((f) => f.tarea.id)).toEqual(["z", "madre", "a"]);
  });

  it("ordena el desglose por fecha y después por número", () => {
    const r = agruparPorTicket([
      t("m"),
      t("s3", { parent_id: "m", fecha_limite: "2026-09-20", numero: 3 }),
      t("s1", { parent_id: "m", fecha_limite: "2026-09-14", numero: 1 }),
      t("s2", { parent_id: "m", fecha_limite: "2026-09-20", numero: 2 }),
    ]);
    expect(r[0].tipo === "ticket" && r[0].subtareas.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("una subtarea sin fecha va al final del desglose", () => {
    const r = agruparPorTicket([
      t("m"),
      t("sinFecha", { parent_id: "m", fecha_limite: null }),
      t("conFecha", { parent_id: "m", fecha_limite: "2026-09-14" }),
    ]);
    expect(r[0].tipo === "ticket" && r[0].subtareas.map((s) => s.id)).toEqual([
      "conFecha",
      "sinFecha",
    ]);
  });

  it("🔑 la subtarea cuya madre NO está en la vista se muestra igual, no se pierde", () => {
    const r = agruparPorTicket([t("hija", { parent_id: "ausente" })]);
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe("suelta");
  });

  it("y trae el ticket al que pertenece para poder nombrarlo", () => {
    const r = agruparPorTicket([t("hija", { parent_id: "ausente" })], {
      ausente: { id: "ausente", numero: 822, titulo: "Onboarding 15 días" },
    });
    expect(r[0].tipo === "suelta" && r[0].madre?.numero).toBe(822);
  });

  it("sin dato de la madre la subtarea igual se muestra, solo que sin chip", () => {
    const r = agruparPorTicket([t("hija", { parent_id: "ausente" })]);
    expect(r[0].tipo === "suelta" && r[0].madre).toBeNull();
  });

  it("un ticket cuyas subtareas quedaron fuera del filtro se ve como fila normal", () => {
    const r = agruparPorTicket([t("madre")]);
    expect(r[0].tipo).toBe("suelta");
  });

  it("dos tickets no se mezclan el desglose", () => {
    const r = agruparPorTicket([
      t("m1"),
      t("m2"),
      t("a", { parent_id: "m1" }),
      t("b", { parent_id: "m2" }),
    ]);
    const ticket = (id: string) => r.find((f) => f.tarea.id === id)!;
    expect(ticket("m1").tipo === "ticket" && ticket("m1").subtareas.map((s) => s.id)).toEqual(["a"]);
    expect(ticket("m2").tipo === "ticket" && ticket("m2").subtareas.map((s) => s.id)).toEqual(["b"]);
  });

  it("ninguna tarea desaparece", () => {
    const entrada = [t("m"), t("a", { parent_id: "m" }), t("b", { parent_id: "m" }), t("x")];
    const r = agruparPorTicket(entrada);
    const vistas = r.flatMap((f) => (f.tipo === "ticket" ? [f.tarea, ...f.subtareas] : [f.tarea]));
    expect(vistas.map((v) => v.id).sort()).toEqual(["a", "b", "m", "x"]);
  });
});

describe("contarAgrupadas", () => {
  it("cuenta tickets, subtareas y sueltas", () => {
    const r = agruparPorTicket([t("m"), t("a", { parent_id: "m" }), t("x")]);
    expect(contarAgrupadas(r)).toEqual({ tickets: 1, subtareas: 1, sueltas: 1 });
  });
});

describe("madresQueFaltan", () => {
  it("pide solo las madres que no están en la lista", () => {
    const r = madresQueFaltan([
      t("m"),
      t("a", { parent_id: "m" }),
      t("b", { parent_id: "ausente" }),
    ]);
    expect(r).toEqual(["ausente"]);
  });

  it("no repite la misma madre dos veces", () => {
    const r = madresQueFaltan([
      t("a", { parent_id: "ausente" }),
      t("b", { parent_id: "ausente" }),
    ]);
    expect(r).toEqual(["ausente"]);
  });

  it("sin subtareas huérfanas no pide nada", () => {
    expect(madresQueFaltan([t("a"), t("b")])).toEqual([]);
  });
});
