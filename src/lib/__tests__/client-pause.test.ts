import { describe, expect, it } from "vitest";
import { isClientPausedFor } from "@/lib/client-pause";

describe("isClientPausedFor", () => {
  it("detecta el mes pausado", () => {
    expect(isClientPausedFor(["2026-08"], "2026-08")).toBe(true);
  });
  it("no pausa otros meses", () => {
    expect(isClientPausedFor(["2026-08"], "2026-07")).toBe(false);
    expect(isClientPausedFor(["2026-08"], "2026-09")).toBe(false);
  });
  it("soporta varios meses", () => {
    expect(isClientPausedFor(["2026-08", "2026-12"], "2026-12")).toBe(true);
  });
  it("vacío o null nunca pausa", () => {
    expect(isClientPausedFor([], "2026-08")).toBe(false);
    expect(isClientPausedFor(null, "2026-08")).toBe(false);
    expect(isClientPausedFor(undefined, "2026-08")).toBe(false);
  });
});
