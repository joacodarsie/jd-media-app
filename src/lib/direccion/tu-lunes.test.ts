import { describe, expect, it } from "vitest";
import { textoLunes } from "./tu-lunes";

const base = {
  rojas: ["CATCH", "Résonar", "Amelia", "Magic"],
  regulares: 9,
  bien: 3,
  reunionesHechas: 2,
  reunionesAgendadas: 1,
  encuestas: { cantidad: 0, promedio: null, bajas: [] },
  web: { visitas: 120, whatsapp: 3, diagnosticos: 4, formularios: 1 },
  trabadas: 0,
  mejorRacha: null,
};

describe("Tu lunes", () => {
  it("resume la semana en una línea", () => {
    expect(textoLunes(base)).toBe(
      "☀️ Tu lunes: 🚦 4 en rojo (CATCH, Résonar, Amelia…), 9 regulares, 3 bien · 🗓️ 2 reuniones hechas la semana pasada, 1 agendadas · 🌐 web: 120 visitas, 3 WhatsApp, 4 diagnósticos, 1 formularios."
    );
  });
  it("suma encuestas, trabadas y racha cuando hay", () => {
    const t = textoLunes({
      ...base,
      rojas: [],
      encuestas: { cantidad: 2, promedio: 3.5, bajas: ["Magic"] },
      trabadas: 1,
      mejorRacha: { nombre: "Sofía", dias: 6 },
    });
    expect(t).toContain("🚦 ninguna cuenta en rojo");
    expect(t).toContain("📝 2 encuestas (promedio 3.5/5) ⚠️ ojo: Magic");
    expect(t).toContain("🧱 1 tarea trabada");
    expect(t).toContain("🔥 mejor racha: Sofía (6 días)");
  });
});
