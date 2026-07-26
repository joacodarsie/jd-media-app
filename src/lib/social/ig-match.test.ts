/**
 * Tests del emparejador de cuentas de Instagram. Lo importante: que NO invente
 * matches (conectar la cuenta equivocada le mostraría a un cliente los números
 * de otro) y que no ofrezca la misma cuenta a dos clientes.
 */
import { describe, it, expect } from "vitest";
import { handleDeUrl, normalizarNombre, matchIgAccounts } from "./ig-match";

const cuenta = (igUsername: string | null, pageName = "Página") => ({
  igUserId: `id-${igUsername ?? pageName}`,
  igUsername,
  pageName,
});

describe("handleDeUrl", () => {
  it("saca el handle de una URL con barra final", () => {
    expect(handleDeUrl("https://www.instagram.com/la.azotea_villaberna/")).toBe(
      "la.azotea_villaberna"
    );
  });
  it("saca el handle sin barra final y con query", () => {
    expect(handleDeUrl("https://instagram.com/desafiosansenuza?igsh=abc")).toBe(
      "desafiosansenuza"
    );
  });
  it("acepta un @handle pelado", () => {
    expect(handleDeUrl("@Boxescar")).toBe("boxescar");
  });
  it("devuelve null si no hay nada", () => {
    expect(handleDeUrl(null)).toBeNull();
    expect(handleDeUrl("   ")).toBeNull();
  });
});

describe("normalizarNombre", () => {
  it("saca acentos, puntuación y palabras de relleno", () => {
    expect(normalizarNombre("Filí y Asociados - Abogados")).toBe("filiasociadosabogados");
    expect(normalizarNombre("Résonar")).toBe("resonar");
    expect(normalizarNombre("Drop Producciones OK")).toBe("dropproducciones");
  });
});

describe("matchIgAccounts", () => {
  const clientes = [
    { id: "c1", nombre: "La Azotea", instagram_url: "https://www.instagram.com/la.azotea_villaberna/" },
    { id: "c2", nombre: "Medialunas Manantiales", instagram_url: null },
    { id: "c3", nombre: "Magic", instagram_url: null },
  ];

  it("empareja por handle exacto de la ficha", () => {
    const s = matchIgAccounts(clientes, [cuenta("la.azotea_villaberna")]);
    expect(s[0]).toMatchObject({ clienteId: "c1", motivo: "handle" });
    expect(s[0].cuenta?.igUsername).toBe("la.azotea_villaberna");
  });

  it("empareja por nombre cuando no hay handle cargado", () => {
    const s = matchIgAccounts(clientes, [cuenta("medialunasmanantiales")]);
    expect(s[1]).toMatchObject({ clienteId: "c2", motivo: "nombre" });
  });

  it("no sugiere nada si no se parece a ninguna", () => {
    const s = matchIgAccounts(clientes, [cuenta("otracosa_distinta")]);
    expect(s.every((x) => x.cuenta === null)).toBe(true);
  });

  it("nombres cortos no matchean por casualidad", () => {
    // "magic" tiene 5 letras pero no está en ninguna cuenta: no debe engancharse
    // con "magiclandia" al revés (la cuenta contiene al nombre) salvo que sea
    // realmente un prefijo/sufijo — este caso SÍ lo permitimos, así que usamos
    // un nombre que no aparece en absoluto.
    const s = matchIgAccounts([{ id: "x", nombre: "Ana", instagram_url: null }], [cuenta("anabelen")]);
    expect(s[0].cuenta).toBeNull();
  });

  it("no ofrece la misma cuenta a dos clientes", () => {
    const dos = [
      { id: "a", nombre: "Drop Producciones", instagram_url: null },
      { id: "b", nombre: "Drop Producciones", instagram_url: null },
    ];
    const s = matchIgAccounts(dos, [cuenta("drop.producciones.ok")]);
    expect(s.filter((x) => x.cuenta).length).toBe(1);
  });

  it("el handle gana sobre el nombre aunque el nombre matchee otra cuenta", () => {
    const uno = [{ id: "z", nombre: "Origen Studio", instagram_url: "https://instagram.com/cotaestudio_/" }];
    const s = matchIgAccounts(uno, [cuenta("origenstudio"), cuenta("cotaestudio_")]);
    expect(s[0].cuenta?.igUsername).toBe("cotaestudio_");
    expect(s[0].motivo).toBe("handle");
  });
});
