import { describe, it, expect } from "vitest";
import { buildSurveyMessage, surveyUrl } from "./encuesta";

describe("buildSurveyMessage", () => {
  const base = {
    clienteNombre: "Boxescar",
    periodo: "2026-07",
    url: "https://app.jd/encuesta/abc",
  };

  it("saluda por el nombre de pila del contacto", () => {
    const m = buildSurveyMessage({ ...base, contactoNombre: "Américo Pereira" });
    expect(m.startsWith("¡Hola Américo!")).toBe(true);
    expect(m).toContain("https://app.jd/encuesta/abc");
  });

  it("si no hay contacto, nombra a la cuenta", () => {
    const m = buildSurveyMessage(base);
    expect(m).toContain("Boxescar");
  });

  it("firma con quien la manda cuando se pasa", () => {
    const m = buildSurveyMessage({ ...base, deParte: "Luz" });
    expect(m.endsWith("Luz — JD Media")).toBe(true);
  });

  it("no firma si no hay quién", () => {
    expect(buildSurveyMessage(base)).not.toContain("— JD Media");
  });
});

describe("surveyUrl", () => {
  it("arma la URL sin duplicar la barra", () => {
    expect(surveyUrl("https://app.jd/", "tok")).toBe("https://app.jd/encuesta/tok");
    expect(surveyUrl("https://app.jd", "tok")).toBe("https://app.jd/encuesta/tok");
  });
});
