import { describe, expect, it } from "vitest";
import { autorDe } from "./message";
import { AGENCY } from "@/lib/agency";

describe("quién firma el mensaje", () => {
  it("firma quien manda la campaña", () => {
    expect(autorDe("Matías Moyano")).toBe("Matías Moyano");
  });

  it("sin nadie elegido firma el representante de la agencia", () => {
    expect(autorDe(null)).toBe(AGENCY.representante);
    expect(autorDe("   ")).toBe(AGENCY.representante);
  });
});
