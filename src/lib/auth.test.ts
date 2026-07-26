/**
 * Tests de los helpers de PERMISOS. Es el archivo donde un error es más caro
 * (alguien ve lo que no debe, o alguien no puede trabajar) y donde nadie te
 * avisa si se rompe. Solo se testean las funciones puras (sin base de datos).
 */
import { describe, it, expect, vi } from "vitest";

// auth.ts vive dentro de Next: usa `cache` de React, `redirect` de next/navigation
// y el cliente de Supabase con cookies. Nada de eso existe en vitest, así que lo
// mockeamos para poder testear las funciones PURAS de permisos.
vi.mock("react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react");
  return { ...actual, cache: (fn: unknown) => fn };
});
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
vi.mock("./supabase/server", () => ({ createClient: () => ({}) }));

import {
  isStaff,
  userInRoles,
  isStaffUser,
  canSeeAllClients,
  isOwner,
  userHas,
  hasFeatureStrict,
  canUseProspectingAi,
  canUseLeadsAi,
} from "./auth";
import { OWNER_EMAIL } from "./constants";
import type { AppUser } from "./types";

/** Usuario mínimo para los tests de features. */
const user = (over: Partial<AppUser> & Record<string, unknown> = {}) =>
  ({
    id: "u1",
    nombre: "Test",
    email: "test@jdmedia.com",
    rol: "community_manager",
    area: "Community Manager",
    rol_secundario: null,
    area_secundaria: null,
    avatar_url: null,
    activo: true,
    position_id: null,
    ...over,
  }) as unknown as AppUser;

describe("isStaff", () => {
  it("admin y coordinador son staff", () => {
    expect(isStaff("admin")).toBe(true);
    expect(isStaff("coordinador")).toBe(true);
  });

  it("el resto no lo es", () => {
    for (const r of ["community_manager", "diseno", "comercial", "paid_media", "prospecting"])
      expect(isStaff(r)).toBe(false);
  });

  it("coordinador_diseno NO es staff general", () => {
    // Coordina diseño, pero no ve finanzas ni todo lo de coordinación general.
    expect(isStaff("coordinador_diseno")).toBe(false);
  });
});

describe("userInRoles — roles dobles", () => {
  it("matchea por rol primario", () => {
    expect(userInRoles({ rol: "comercial" }, ["comercial"])).toBe(true);
  });

  it("matchea por rol SECUNDARIO (el caso de Guille: paid_media + prospecting)", () => {
    expect(
      userInRoles({ rol: "paid_media", rol_secundario: "prospecting" }, ["prospecting"])
    ).toBe(true);
  });

  it("da false si ninguno de los dos roles está en la lista", () => {
    expect(
      userInRoles({ rol: "paid_media", rol_secundario: "prospecting" }, ["comercial"])
    ).toBe(false);
  });

  it("tolera rol_secundario null/undefined", () => {
    expect(userInRoles({ rol: "diseno", rol_secundario: null }, ["diseno"])).toBe(true);
    expect(userInRoles({ rol: "diseno" }, ["comercial"])).toBe(false);
  });
});

describe("isStaffUser", () => {
  it("vale si el rol secundario es staff", () => {
    expect(isStaffUser({ rol: "diseno", rol_secundario: "coordinador" })).toBe(true);
  });

  it("no vale si ninguno es staff", () => {
    expect(isStaffUser({ rol: "diseno", rol_secundario: "audiovisual" })).toBe(false);
  });
});

describe("canSeeAllClients", () => {
  it("staff ve todas las cuentas", () => {
    expect(canSeeAllClients({ rol: "admin" })).toBe(true);
    expect(canSeeAllClients({ rol: "coordinador" })).toBe(true);
  });

  it("coordinación de diseño ve todas las cuentas (sin finanzas)", () => {
    expect(canSeeAllClients({ rol: "coordinador_diseno" })).toBe(true);
  });

  it("un CM NO ve todas las cuentas", () => {
    expect(canSeeAllClients({ rol: "community_manager" })).toBe(false);
  });

  it("vale también por rol secundario", () => {
    expect(canSeeAllClients({ rol: "diseno", rol_secundario: "coordinador_diseno" })).toBe(true);
  });
});

describe("isOwner — reserva de la IA cara al director", () => {
  it("true solo para el email del dueño", () => {
    expect(isOwner({ email: OWNER_EMAIL })).toBe(true);
  });

  it("es case-insensitive", () => {
    expect(isOwner({ email: OWNER_EMAIL.toUpperCase() })).toBe(true);
  });

  it("OTRO ADMIN no es owner (el caso de Leo)", () => {
    expect(isOwner({ email: "leo@jdmedia.com" })).toBe(false);
  });

  it("sin email es false", () => {
    expect(isOwner({ email: null })).toBe(false);
    expect(isOwner({})).toBe(false);
  });
});

describe("userHas — features por usuario", () => {
  it("admin tiene todas las features", () => {
    expect(userHas(user({ rol: "admin" }), "finanzas")).toBe(true);
    expect(userHas(user({ rol: "admin" }), "leads_ia")).toBe(true);
  });

  it("un no-admin solo tiene lo que le otorgaron", () => {
    const u = user({ rol: "comercial", permisos: { comercial: true } });
    expect(userHas(u, "comercial")).toBe(true);
    expect(userHas(u, "finanzas")).toBe(false);
  });

  it("sin permisos cargados, todo false", () => {
    expect(userHas(user({ rol: "diseno" }), "finanzas")).toBe(false);
  });

  it("un valor que no sea true estricto no otorga la feature", () => {
    const u = user({ rol: "diseno", permisos: { finanzas: "si" } });
    expect(userHas(u, "finanzas")).toBe(false);
  });
});

describe("hasFeatureStrict — sin el atajo de admin", () => {
  it("un admin SIN el permiso explícito no la tiene", () => {
    // Justamente lo que evita que ser admin habilite gasto de IA solo.
    expect(hasFeatureStrict(user({ rol: "admin" }), "contactos_ia")).toBe(false);
  });

  it("la tiene si está otorgada a mano", () => {
    const u = user({ rol: "coordinador", permisos: { contactos_ia: true } });
    expect(hasFeatureStrict(u, "contactos_ia")).toBe(true);
  });
});

describe("canUseProspectingAi — quién saca contactos con IA", () => {
  it("el director siempre puede", () => {
    expect(canUseProspectingAi(user({ rol: "admin", email: OWNER_EMAIL }))).toBe(true);
  });

  it("Guille puede con el permiso otorgado (aunque no sea el director)", () => {
    const guille = user({
      rol: "coordinador",
      email: "guille@jdmedia.com",
      permisos: { contactos_ia: true },
    });
    expect(canUseProspectingAi(guille)).toBe(true);
  });

  it("Leo (admin, sin el permiso) NO puede", () => {
    expect(canUseProspectingAi(user({ rol: "admin", email: "leo@jdmedia.com" }))).toBe(false);
  });
});

describe("canUseLeadsAi — el buscador de leads (el más caro) va aparte", () => {
  it("el director siempre puede", () => {
    expect(canUseLeadsAi(user({ rol: "admin", email: OWNER_EMAIL }))).toBe(true);
  });

  it("tener la IA de prospección NO alcanza para el buscador de leads", () => {
    const u = user({ rol: "coordinador", permisos: { contactos_ia: true } });
    expect(canUseProspectingAi(u)).toBe(true);
    expect(canUseLeadsAi(u)).toBe(false);
  });

  it("se habilita con leads_ia otorgado a mano", () => {
    const u = user({ rol: "coordinador", permisos: { leads_ia: true } });
    expect(canUseLeadsAi(u)).toBe(true);
  });
});
