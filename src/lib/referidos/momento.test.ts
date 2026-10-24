import { describe, expect, it } from "vitest";
import { crecimientoSeguidores, logroDeLaCuenta, mensajeConLogro, posteoRecord, tareaPedirRecomendacion } from "./momento";

const p = (likes: number, fecha: string, comments = 0) => ({ like_count: likes, comments_count: comments, timestamp: `${fecha}T18:00:00+0000`, permalink: `https://instagram.com/p/${fecha}` });

describe("el momento justo para pedir una recomendación", () => {
  it("un posteo con el doble de interacción que el resto, reciente, es récord", () => {
    // Como Dionisi el 24/10: 285+9 contra ~82 de promedio.
    const l = posteoRecord([p(95, "2026-10-23", 5), p(285, "2026-10-21", 9), p(63, "2026-10-19"), p(78, "2026-10-16", 1), p(91, "2026-10-03")], "2026-10-24");
    expect(l?.clave).toBe("posteo_record");
    expect(l?.titulo).toBe("Tu posteo del 21/10 tuvo 3,5 veces más interacción que el resto");
    expect(l?.link).toBe("https://instagram.com/p/2026-10-21");
  });

  it("no es récord si es viejo, si es poco, o si no se despega", () => {
    expect(posteoRecord([p(10, "2026-10-21"), p(110, "2026-10-03"), p(15, "2026-10-05")], "2026-10-24")).toBeNull(); // hace 21 días
    expect(posteoRecord([p(15, "2026-10-21"), p(3, "2026-10-19"), p(2, "2026-10-13")], "2026-10-24")).toBeNull(); // menos de 30
    expect(posteoRecord([p(60, "2026-10-21"), p(50, "2026-10-19"), p(40, "2026-10-13")], "2026-10-24")).toBeNull(); // no duplica
    expect(posteoRecord([p(300, "2026-10-21"), p(10, "2026-10-19")], "2026-10-24")).toBeNull(); // pocos posteos
  });

  it("los seguidores cuentan desde +15% y +50", () => {
    expect(crecimientoSeguidores(546, 1226)?.titulo).toBe("680 seguidores nuevos desde que arrancamos (+125%)");
    expect(crecimientoSeguidores(7737, 7970)).toBeNull(); // +3%
    expect(crecimientoSeguidores(19, 22)).toBeNull(); // +3 personas
    expect(crecimientoSeguidores(null, 100)).toBeNull();
  });

  it("primero el posteo récord, si no el crecimiento", () => {
    expect(logroDeLaCuenta({ posts: [], seguidoresAntes: 546, seguidoresHoy: 1226, hoy: "2026-10-24" })?.clave).toBe("seguidores");
    expect(logroDeLaCuenta({ posts: [], seguidoresAntes: 7737, seguidoresHoy: 7970, hoy: "2026-10-24" })).toBeNull();
  });

  it("el mensaje lleva el logro y el link de referido; la tarea es una por mes", () => {
    const l = crecimientoSeguidores(546, 1226)!;
    expect(mensajeConLogro("RESO", l)).toBe(
      "Te recomiendo JD Media, la agencia que me maneja las redes: ya sumamos 680 seguidores nuevos (+125%). Con mi link tenés un 10% de descuento en tu primer mes: https://jdmedia.com.ar/?ref=RESO"
    );
    const t = tareaPedirRecomendacion({ id: "c1", nombre: "Résonar" }, l, "2026-10-24");
    expect(t.rutina_key).toBe("ref:momento:c1:2026-10");
    expect(t.titulo).toBe("Buen momento para pedirle una recomendación a Résonar");
  });
});
