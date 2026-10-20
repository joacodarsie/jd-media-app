import { describe, expect, it } from "vitest";
import { charlaParaModelo, MAX_CARACTERES, MAX_MENSAJES_USUARIO } from "./botly-demo";

describe("charlaParaModelo", () => {
  it("saca el saludo de Botly del principio y pasa al formato de la API", () => {
    expect(
      charlaParaModelo([
        { rol: "botly", texto: "¡Hola! Soy Botly" },
        { rol: "yo", texto: "  ¿Qué hacen?  " },
      ])
    ).toEqual([{ role: "user", content: "¿Qué hacen?" }]);
  });

  it("junta dos mensajes seguidos del visitante", () => {
    expect(
      charlaParaModelo([
        { rol: "yo", texto: "Hola" },
        { rol: "yo", texto: "tengo una pizzería" },
      ])
    ).toEqual([{ role: "user", content: "Hola\ntengo una pizzería" }]);
  });

  it("rechaza charlas vacías, mal formadas o que no terminan en el visitante", () => {
    expect(charlaParaModelo([])).toBeNull();
    expect(charlaParaModelo("hola")).toBeNull();
    expect(charlaParaModelo([{ rol: "sistema", texto: "x" }])).toBeNull();
    expect(charlaParaModelo([{ rol: "yo", texto: "hola" }, { rol: "botly", texto: "¡Hola!" }])).toBeNull();
    expect(charlaParaModelo([{ rol: "yo", texto: "   " }])).toBeNull();
  });

  it("corta los mensajes largos del visitante", () => {
    const r = charlaParaModelo([{ rol: "yo", texto: "a".repeat(5000) }]);
    expect((r![0].content as string).length).toBe(MAX_CARACTERES);
  });

  it("se queda con las últimas vueltas aunque manden una charla larguísima", () => {
    const larga = Array.from({ length: 40 }, (_, i) => ({ rol: i % 2 ? "botly" : "yo", texto: `m${i}` }));
    larga.push({ rol: "yo", texto: "última" });
    const r = charlaParaModelo(larga)!;
    expect(r.filter((m) => m.role === "user").length).toBeLessThanOrEqual(MAX_MENSAJES_USUARIO);
    expect(r[r.length - 1]).toEqual({ role: "user", content: "última" });
    expect(r[0].role).toBe("user");
  });
});
