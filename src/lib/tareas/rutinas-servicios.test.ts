import { describe, expect, it } from "vitest";
import { rutinasDeServicios, servicioDeRutina, vencimientoServicio } from "./rutinas-servicios";

const cuentas = [
  { clienteId: "fr", nombre: "Freedom", tipo: "gestion_whatsapp" },
  { clienteId: "nz", nombre: "Nazar Hogar", tipo: "gestion_whatsapp" },
  { clienteId: "nz", nombre: "Nazar Hogar", tipo: "chatter" },
  { clienteId: "wa", nombre: "Warrior", tipo: "google_ads" },
];

describe("tareas del mes de los servicios aparte", () => {
  it("una por cuenta y servicio: WhatsApp y chatter a Santi, Google Ads a Guille", () => {
    const t = rutinasDeServicios("2026-11", "2026-11-01", cuentas, {
      gestion_whatsapp: "santi",
      chatter: "santi",
      google_ads: "guille",
    });
    expect(t.map((x) => [x.rutina_key, x.asignado_a_id, x.cliente_id])).toEqual([
      ["2026-11:wpp:fr", "santi", "fr"],
      ["2026-11:wpp:nz", "santi", "nz"],
      ["2026-11:chat:nz", "santi", "nz"],
      ["2026-11:gads:wa", "guille", "wa"],
    ]);
    expect(t[0].titulo).toBe("WhatsApp de Freedom: gestión del mes");
    expect(t.every((x) => x.fecha_limite === "2026-11-10")).toBe(true);
  });

  it("sin responsable para un servicio, no se crea su tarea", () => {
    const t = rutinasDeServicios("2026-11", "2026-11-01", cuentas, { gestion_whatsapp: "santi" });
    expect(t.map((x) => x.rutina_key)).toEqual(["2026-11:wpp:fr", "2026-11:wpp:nz"]);
  });

  it("el mes en que arranca, si el 10 ya pasó, vence en 3 días", () => {
    expect(vencimientoServicio("2026-10", "2026-10-12")).toBe("2026-10-15");
    expect(vencimientoServicio("2026-10", "2026-10-03")).toBe("2026-10-10");
    expect(vencimientoServicio("2026-11", "2026-10-30")).toBe("2026-11-10");
  });

  it("se reconoce el servicio por la clave", () => {
    expect(servicioDeRutina("2026-10:wpp:fr")).toBe("wpp");
    expect(servicioDeRutina("2026-10:gads:wa")).toBe("gads");
    expect(servicioDeRutina("2026-10:chat:nz")).toBe("chat");
    expect(servicioDeRutina("2026-10:cobrar")).toBeNull();
  });
});
