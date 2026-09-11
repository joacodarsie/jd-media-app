import { describe, it, expect, vi, beforeEach } from "vitest";

// El buscador real sale a internet; acá lo que se prueba es la rotación.
const buscar = vi.fn<(url: string) => Promise<string | null>>(async () => null);
vi.mock("./email-finder", async () => {
  const real = await vi.importActual<typeof import("./email-finder")>("./email-finder");
  return { ...real, buscarEmailDeSitio: (url: string) => buscar(url) };
});

import { completarEmails } from "./email-fill";

interface Fila {
  id: string;
  sitio_web: string;
  email: string | null;
  email_buscado_at: string | null;
}

/**
 * Supabase de mentira con la tabla en memoria. Alcanza para lo que importa:
 * que la tanda del día NO devuelva siempre los mismos contactos.
 */
function fakeAdmin(filas: Fila[], opts: { sinColumna?: boolean } = {}) {
  const admin = {
    from() {
      let orden: "buscado" | null = null;
      let limite = filas.length;
      let head = false;
      const q = {
        select(_cols: string, o?: { head?: boolean }) {
          head = !!o?.head;
          return q;
        },
        not: () => q,
        is: () => q,
        eq(col: string, val: string) {
          if (col === "id") q._targetId = val;
          return q;
        },
        limit(n: number) {
          limite = n;
          return q;
        },
        order(col: string) {
          if (col === "email_buscado_at") {
            if (opts.sinColumna) q._error = { code: "42703", message: "column does not exist" };
            orden = "buscado";
          }
          return q;
        },
        update(cambios: Partial<Fila>) {
          q._cambios = cambios;
          return q;
        },
        _targetId: undefined as string | undefined,
        _cambios: undefined as Partial<Fila> | undefined,
        _error: undefined as { code: string; message: string } | undefined,
        then(resolve: (r: unknown) => void) {
          if (q._error) return resolve({ data: null, error: q._error, count: null });
          if (q._cambios) {
            const f = filas.find((x) => x.id === q._targetId);
            if (f) Object.assign(f, q._cambios);
            return resolve({ data: null, error: null });
          }
          const pendientes = filas.filter((f) => f.email === null && f.sitio_web);
          if (head) return resolve({ data: null, error: null, count: pendientes.length });
          const ordenadas =
            orden === "buscado"
              ? [...pendientes].sort((a, b) =>
                  (a.email_buscado_at ?? "").localeCompare(b.email_buscado_at ?? "")
                )
              : pendientes; // sin order: siempre el mismo orden de inserción
          return resolve({ data: ordenadas.slice(0, limite), error: null });
        },
      };
      return q;
    },
  };
  return admin as unknown as Parameters<typeof completarEmails>[0];
}

function filas(n: number, prefijo = "sitio"): Fila[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    sitio_web: `https://${prefijo}${i}.com.ar`,
    email: null,
    email_buscado_at: null,
  }));
}

beforeEach(() => {
  buscar.mockReset();
  buscar.mockResolvedValue(null);
});

describe("completarEmails", () => {
  it("la segunda corrida mira contactos distintos", async () => {
    // El bug real: sin marca, el cron revisaba todos los días los mismos 40
    // sitios muertos y nunca llegaba a los otros 779 contactos.
    const datos = filas(10);
    const admin = fakeAdmin(datos);

    await completarEmails(admin, { limite: 4 });
    const primera = buscar.mock.calls.map(([u]) => u);
    buscar.mockClear();

    await completarEmails(admin, { limite: 4 });
    const segunda = buscar.mock.calls.map(([u]) => u);

    expect(primera).toHaveLength(4);
    expect(segunda).toHaveLength(4);
    expect(segunda.some((u) => primera.includes(u))).toBe(false);
  });

  it("marca como revisado también al que no dio email", async () => {
    const datos = filas(2);
    await completarEmails(fakeAdmin(datos), { limite: 2 });
    expect(datos.every((f) => f.email_buscado_at !== null)).toBe(true);
    expect(datos.every((f) => f.email === null)).toBe(true);
  });

  it("guarda el email cuando lo encuentra", async () => {
    const datos = filas(1);
    buscar.mockResolvedValue("  Info@Sitio0.com.AR ");
    const r = await completarEmails(fakeAdmin(datos), { limite: 1 });
    expect(r.encontrados).toBe(1);
    expect(datos[0].email).toBe("info@sitio0.com.ar");
  });

  it("saltea las fichas de portales sin bajarlas", async () => {
    const datos: Fila[] = [
      { id: "a", sitio_web: "https://www.facebook.com/negocio", email: null, email_buscado_at: null },
      { id: "b", sitio_web: "https://negocio.com.ar", email: null, email_buscado_at: null },
    ];
    const r = await completarEmails(fakeAdmin(datos), { limite: 2 });
    expect(r.salteados).toBe(1);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("https://negocio.com.ar");
    // Igual queda marcada, para que no vuelva a salir en la próxima tanda.
    expect(datos[0].email_buscado_at).not.toBeNull();
  });

  it("sigue funcionando si la 0160 todavía no se aplicó", async () => {
    const datos = filas(3);
    buscar.mockResolvedValue("hola@sitio.com");
    const r = await completarEmails(fakeAdmin(datos, { sinColumna: true }), { limite: 3 });
    expect(r.error).toBeUndefined();
    expect(r.encontrados).toBe(3);
  });
});
