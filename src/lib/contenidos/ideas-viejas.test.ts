import { describe, expect, it } from "vitest";
import { corteIdeasViejas, notaIdeaVieja } from "./ideas-viejas";

describe("ideas viejas a «Sin fecha»", () => {
  it("el corte es 14 días antes de hoy, cruzando el mes", () => {
    expect(corteIdeasViejas("2026-10-22")).toBe("2026-10-08");
    expect(corteIdeasViejas("2026-11-05")).toBe("2026-10-22");
  });

  it("la nota dice para cuándo era, sin pisar la anterior", () => {
    expect(notaIdeaVieja(null, "2026-07-17", "2026-10-22")).toBe("Era para el 17/07 y no salió: quedó guardada sin fecha (22/10).");
    expect(notaIdeaVieja("Cambiar el gancho", "2026-07-17", "2026-10-22")).toBe(
      "Cambiar el gancho\nEra para el 17/07 y no salió: quedó guardada sin fecha (22/10)."
    );
  });
});
