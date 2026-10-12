import { describe, expect, it } from "vitest";
import {
  diasHabilesHastaHoy,
  ordenarTarjetas,
  porMeta,
  porTope,
  tarjetaComercial,
  tarjetaCuentaJd,
  tarjetaCoordGeneral,
  tarjetaPaidMedia,
  tarjetaDireccionCreativa,
  tarjetaPm,
} from "./coordinadores";

const p = { id: "x", nombre: "Persona" };
const limpio = { tareasVencidas: 0, pedidosAbiertos: 0, pedidosVencidos: 0 };

describe("escalas", () => {
  it("por tope: 0 verde, hasta el tope amarillo, más rojo", () => {
    expect(porTope(0, 3)).toBe("ok");
    expect(porTope(3, 3)).toBe("atento");
    expect(porTope(4, 3)).toBe("mal");
  });
  it("por meta: 100% verde, 60% amarillo, menos rojo; sin meta no cuenta", () => {
    expect(porMeta(120, 120)).toBe("ok");
    expect(porMeta(80, 120)).toBe("atento");
    expect(porMeta(30, 120)).toBe("mal");
    expect(porMeta(5, 0)).toBeNull();
  });
});

describe("tarjetas", () => {
  it("la PM toma el color del peor número", () => {
    const t = tarjetaPm(p, { vencidasEquipo: 182, sinRepartir: 0, cuentasEnRiesgo: 0, cuentasNuevas: 9 }, limpio);
    expect(t.estado).toBe("mal");
    expect(t.indicadores[0].valor).toBe("182");
  });

  it("dirección creativa: lo que pesa son las piezas fuera de las 24 h, no el total", () => {
    const ok = tarjetaDireccionCreativa(p, { paraAprobar: 8, fueraDeTiempo: 0, ideasUrgentes: 0 }, limpio);
    expect(ok.estado).toBe("ok");
    const mal = tarjetaDireccionCreativa(p, { paraAprobar: 21, fueraDeTiempo: 15, ideasUrgentes: 0 }, limpio);
    expect(mal.estado).toBe("mal");
    expect(mal.indicadores[0].detalle).toContain("15 pasaron");
  });

  it("comercial: la semana se mide contra los días hábiles que ya pasaron", () => {
    // Miércoles: 3 días × 120 = 360.
    const t = tarjetaComercial(
      p,
      { hoy: 32, semana: 300, metaDiaria: 120, diasHabilesSemana: 3, reunionesMes: 1 },
      limpio
    );
    expect(t.indicadores[0].valor).toBe("300 de 360");
    expect(t.estado).toBe("atento");
  });

  it("los informativos no pesan en el semáforo", () => {
    const t = tarjetaComercial(
      p,
      { hoy: 0, semana: 400, metaDiaria: 120, diasHabilesSemana: 3, reunionesMes: 0 },
      limpio
    );
    expect(t.estado).toBe("ok");
  });

  it("cuenta de JD Media: alcanza con el 80% de lo previsto", () => {
    expect(tarjetaCuentaJd(p, { publicadas: 8, previstasAHoy: 10, atrasadas: 0, diaDelMes: 12 }, limpio).estado).toBe("ok");
    expect(tarjetaCuentaJd(p, { publicadas: 2, previstasAHoy: 10, atrasadas: 0, diaDelMes: 12 }, limpio).estado).toBe("mal");
  });

  it("cuenta de JD Media: calendario vacío pasado el día 5 es rojo", () => {
    expect(tarjetaCuentaJd(p, { publicadas: 0, previstasAHoy: 0, atrasadas: 0, diaDelMes: 12 }, limpio).estado).toBe("mal");
    expect(tarjetaCuentaJd(p, { publicadas: 0, previstasAHoy: 0, atrasadas: 0, diaDelMes: 2 }, limpio).estado).toBe("ok");
  });

  it("un pedido de la dirección vencido ya pone amarillo; dos, rojo", () => {
    const uno = tarjetaCuentaJd(p, { publicadas: 0, previstasAHoy: 0, atrasadas: 0, diaDelMes: 2 }, { ...limpio, pedidosAbiertos: 3, pedidosVencidos: 1 });
    expect(uno.estado).toBe("atento");
    const dos = tarjetaCuentaJd(p, { publicadas: 0, previstasAHoy: 0, atrasadas: 0, diaDelMes: 2 }, { ...limpio, pedidosAbiertos: 3, pedidosVencidos: 2 });
    expect(dos.estado).toBe("mal");
  });

  it("lo que está peor va arriba", () => {
    const a = tarjetaCuentaJd({ id: "a", nombre: "A" }, { publicadas: 1, previstasAHoy: 1, atrasadas: 0, diaDelMes: 12 }, limpio);
    const b = tarjetaPm({ id: "b", nombre: "B" }, { vencidasEquipo: 99, sinRepartir: 0, cuentasEnRiesgo: 0, cuentasNuevas: 0 }, limpio);
    expect(ordenarTarjetas([a, b]).map((t) => t.personaId)).toEqual(["b", "a"]);
  });
});

describe("Leo y Guille", () => {
  it("cobros: antes del 5 no pesa; después, 3 o más sin marcar es rojo", () => {
    const antes = tarjetaCoordGeneral(p, { sinCobrar: 12, montoSinCobrar: 2975000, total: 25, diaDelMes: 3 }, limpio);
    expect(antes.estado).toBe("ok");
    const despues = tarjetaCoordGeneral(p, { sinCobrar: 12, montoSinCobrar: 2975000, total: 25, diaDelMes: 12 }, limpio);
    expect(despues.estado).toBe("mal");
    expect(despues.indicadores[0].detalle).toContain("2.975.000");
  });
  it("pauta: conectadas contra las cuentas que tienen pauta", () => {
    const t = tarjetaPaidMedia(p, { conPauta: 17, conectadas: 5, conCampanas: 4 }, limpio);
    expect(t.indicadores[0].valor).toBe("5 de 17");
    expect(t.estado).toBe("mal");
  });
});

describe("días hábiles", () => {
  it("cuenta hasta hoy en la semana; el finde vale la semana entera", () => {
    expect(diasHabilesHastaHoy("2026-10-12")).toBe(1); // lunes
    expect(diasHabilesHastaHoy("2026-10-14")).toBe(3); // miércoles
    expect(diasHabilesHastaHoy("2026-10-17")).toBe(5); // sábado
  });
});
