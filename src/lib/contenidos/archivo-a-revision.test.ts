import { describe, it, expect } from "vitest";
import { estadoAlPegarArchivo } from "./archivo-a-revision";

const LINK = "https://drive.google.com/file/d/abc";

describe("estadoAlPegarArchivo", () => {
  it("una pieza en producción pasa a revisión creativa al pegar el archivo", () => {
    for (const e of ["en_diseno", "guion", "edicion", "rechazado"]) {
      expect(estadoAlPegarArchivo(e, null, LINK)).toBe("revision_creativa");
    }
  });

  it("una idea no aprobada no avanza", () => {
    expect(estadoAlPegarArchivo("idea", null, LINK)).toBeNull();
  });

  it("lo que ya pasó por revisión no retrocede", () => {
    for (const e of ["revision_creativa", "revision_cliente", "aprobado", "publicado"]) {
      expect(estadoAlPegarArchivo(e, null, LINK)).toBeNull();
    }
  });

  it("borrar el link o guardar el mismo no mueve nada", () => {
    expect(estadoAlPegarArchivo("en_diseno", LINK, "")).toBeNull();
    expect(estadoAlPegarArchivo("en_diseno", LINK, "  ")).toBeNull();
    expect(estadoAlPegarArchivo("en_diseno", LINK, ` ${LINK} `)).toBeNull();
  });

  it("cambiar el link por uno nuevo (corrección) vuelve a mandarla a revisión", () => {
    expect(estadoAlPegarArchivo("rechazado", LINK, LINK + "2")).toBe("revision_creativa");
  });
});
