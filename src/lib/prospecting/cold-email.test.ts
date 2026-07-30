import { describe, it, expect } from "vitest";
import {
  armarAsunto,
  armarCierre,
  armarEmail,
  diasParaCubrir,
  esEmailValido,
  filtrarDestinatarios,
  normalizarEmail,
  topeDelDia,
} from "./cold-email";
import { emailDeToken, tokenDeBaja } from "./cold-email-token";
import { dominioDe, extraerEmails } from "./email-finder";

const REMITENTE = {
  nombre: "Joaquín Darsie",
  agencia: "JD Media",
  direccion: "Córdoba, Argentina",
};

describe("esEmailValido", () => {
  it("acepta direcciones normales", () => {
    expect(esEmailValido("hola@empresa.com.ar")).toBe(true);
    expect(esEmailValido("  Info@Empresa.COM  ")).toBe(true);
  });
  it("rechaza lo que no es un mail", () => {
    expect(esEmailValido("hola@empresa")).toBe(false);
    expect(esEmailValido("sin-arroba.com")).toBe(false);
    expect(esEmailValido("a@b.c")).toBe(false);
  });
});

describe("armarAsunto", () => {
  it("reemplaza la empresa y no se pasa de largo", () => {
    expect(armarAsunto("Una idea para [EMPRESA]", "Magic")).toBe("Una idea para Magic");
    expect(armarAsunto("x".repeat(200), "Magic").length).toBe(120);
  });
});

describe("armarEmail", () => {
  const base = {
    asuntoPlantilla: "Una idea para [EMPRESA]",
    cuerpoPlantilla: "Hola [NOMBRE], vi el Instagram de [EMPRESA].\n\nTe dejo una idea.",
    empresa: "Magic",
    remitente: REMITENTE,
    bajaUrl: "https://app.test/baja/abc",
  };

  it("personaliza empresa y persona", () => {
    const m = armarEmail({ ...base, contacto: "Ana Pérez" });
    expect(m.asunto).toBe("Una idea para Magic");
    expect(m.texto).toContain("Hola Ana, vi el Instagram de Magic.");
  });

  it("sin persona no deja el hueco colgado", () => {
    const m = armarEmail({ ...base, contacto: null });
    expect(m.texto).toContain("Hola, vi el Instagram de Magic.");
    expect(m.texto).not.toContain("[NOMBRE]");
  });

  it("SIEMPRE lleva firma, baja y datos del remitente", () => {
    const m = armarEmail(base);
    for (const parte of [m.texto, m.html]) {
      expect(parte).toContain("https://app.test/baja/abc");
      expect(parte).toContain("JD Media");
      expect(parte).toContain("Córdoba, Argentina");
    }
  });

  it("escapa el HTML del cuerpo (una empresa con < o & no rompe el mail)", () => {
    const m = armarEmail({
      ...base,
      empresa: "Bar & Co <script>",
      cuerpoPlantilla: "Hola, vi [EMPRESA].",
    });
    expect(m.html).toContain("Bar &amp; Co &lt;script&gt;");
    expect(m.html).not.toContain("<script>");
  });
});

describe("armarCierre (oferta + links)", () => {
  it("pone la oferta con el código, que es lo que permite medir el canal", () => {
    const c = armarCierre({ oferta: "$50.000 de descuento el primer mes", codigo: "MAIL50" });
    expect(c).toContain("$50.000 de descuento el primer mes si me escribís mencionando MAIL50.");
  });

  it("sin código no inventa uno", () => {
    expect(armarCierre({ oferta: "Descuento" })).toBe("Descuento.");
  });

  it("normaliza el Instagram venga como venga", () => {
    for (const valor of ["jdmedia", "@jdmedia", "https://instagram.com/jdmedia/"]) {
      expect(armarCierre({ instagram: valor })).toContain("@jdmedia");
    }
  });

  it("arma la línea de contacto con lo que haya", () => {
    const c = armarCierre({ whatsapp: "351 123 4567", web: "jdmedia.com" });
    expect(c).toBe("WhatsApp: 351 123 4567 · Web: jdmedia.com");
  });

  it("vacío si no hay nada cargado", () => {
    expect(armarCierre(null)).toBe("");
    expect(armarCierre({})).toBe("");
  });

  it("el cierre entra en el mail completo", () => {
    const m = armarEmail({
      asuntoPlantilla: "Hola [EMPRESA]",
      cuerpoPlantilla: "Texto del mensaje.",
      empresa: "Magic",
      remitente: REMITENTE,
      bajaUrl: "https://app.test/baja/abc",
      cierre: { oferta: "$50.000 off", codigo: "MAIL50", whatsapp: "351 123" },
    });
    expect(m.texto).toContain("MAIL50");
    expect(m.texto).toContain("WhatsApp: 351 123");
    expect(m.html).toContain("MAIL50");
  });
});

describe("token de baja", () => {
  const S = "secreto-de-prueba";
  it("va y vuelve", () => {
    const t = tokenDeBaja("Hola@Empresa.com", S);
    expect(emailDeToken(t, S)).toBe("hola@empresa.com");
  });
  it("no se puede falsificar ni dar de baja a otro", () => {
    const t = tokenDeBaja("hola@empresa.com", S);
    expect(emailDeToken(t, "otro-secreto")).toBeNull();
    expect(emailDeToken("basura", S)).toBeNull();
    const [parte] = t.split(".");
    expect(emailDeToken(`${parte}.firmafalsa`, S)).toBeNull();
    // Cambiar el mail manteniendo la firma tampoco sirve.
    const otro = Buffer.from("victima@otra.com").toString("base64url");
    expect(emailDeToken(`${otro}.${t.split(".")[1]}`, S)).toBeNull();
  });
});

describe("filtrarDestinatarios", () => {
  const contactos = [
    { id: "1", empresa: "A", email: "a@a.com" },
    { id: "2", empresa: "B", email: null },
    { id: "3", empresa: "C", email: "no-es-mail" },
    { id: "4", empresa: "D", email: "D@D.com" },
    { id: "5", empresa: "E", email: "e@e.com", estado: "descartado" },
    { id: "6", empresa: "F", email: "a@a.com" },
  ];

  it("deja solo los mandables y sin repetir", () => {
    const r = filtrarDestinatarios(contactos);
    expect(r.map((c) => c.email)).toEqual(["a@a.com", "d@d.com"]);
  });

  it("respeta la lista de bajas y los ya enviados, sin importar mayúsculas", () => {
    const r = filtrarDestinatarios(contactos, {
      bajas: ["A@A.com"],
      yaEnviados: ["d@d.com"],
    });
    expect(r).toHaveLength(0);
  });
});

describe("topeDelDia (warm-up)", () => {
  it("arranca bajo y sube con el historial", () => {
    expect(topeDelDia(0)).toBe(25);
    expect(topeDelDia(60)).toBe(50);
    expect(topeDelDia(300)).toBe(100);
    // El escalón más alto (150) solo se alcanza si el usuario sube el tope:
    // por defecto está en 100 justamente para no dispararse solo.
    expect(topeDelDia(900)).toBe(100);
    expect(topeDelDia(900, 200)).toBe(150);
  });
  it("nunca supera el tope que puso el usuario", () => {
    expect(topeDelDia(900, 30)).toBe(30);
    expect(topeDelDia(0, 10)).toBe(10);
  });
  it("diasParaCubrir refleja la rampa, no una división", () => {
    // 100 contactos NO salen en 1 día: 25 + 25 + 50 = 3 días.
    expect(diasParaCubrir(100)).toBe(3);
    expect(diasParaCubrir(0)).toBe(0);
  });
});

describe("extraerEmails", () => {
  it("prefiere el mail del dominio propio antes que uno suelto", () => {
    const html = `<a href="mailto:juan@gmail.com">esc</a> contacto@miempresa.com`;
    expect(extraerEmails(html, "https://www.miempresa.com")[0]).toBe("contacto@miempresa.com");
  });

  it("descarta archivos, buzones automáticos y dominios de herramientas", () => {
    const html = `logo@2x.png noreply@miempresa.com a3f9c1e2b4d5a6b7@sentry.io
      soporte@wixpress.com hola@miempresa.com`;
    expect(extraerEmails(html, "https://miempresa.com")).toEqual(["hola@miempresa.com"]);
  });

  it("ordena los buzones comerciales primero", () => {
    const html = `prensa@e.com rrhh@e.com ventas@e.com`;
    expect(extraerEmails(html, "https://e.com")[0]).toBe("ventas@e.com");
  });

  it("no repite ni distingue mayúsculas", () => {
    expect(extraerEmails("Hola@E.com hola@e.com", "https://e.com")).toEqual(["hola@e.com"]);
  });

  it("devuelve vacío si no hay nada", () => {
    expect(extraerEmails("<p>sin mails</p>", "https://e.com")).toEqual([]);
  });
});

describe("dominioDe", () => {
  it("saca el www y el protocolo", () => {
    expect(dominioDe("https://www.Empresa.com.ar/contacto")).toBe("empresa.com.ar");
    expect(dominioDe("empresa.com")).toBe("empresa.com");
    expect(dominioDe("no es una url")).toBe("");
  });
});

describe("normalizarEmail", () => {
  it("limpia espacios y mayúsculas", () => {
    expect(normalizarEmail("  Hola@Empresa.COM ")).toBe("hola@empresa.com");
  });
});
