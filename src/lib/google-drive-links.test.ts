import { describe, it, expect } from "vitest";
import { extractDriveItemId, extractDriveFolderId } from "./google-drive";

describe("extractDriveItemId", () => {
  it("saca el id de un archivo suelto", () => {
    expect(
      extractDriveItemId("https://drive.google.com/file/d/1w6s7tDnhR7sdG6eTe/view?usp=drive_link")
    ).toBe("1w6s7tDnhR7sdG6eTe");
  });

  it("saca el id de una carpeta", () => {
    // El equipo pega carpetas tanto como archivos: si solo aguantáramos
    // archivos, la mitad de las piezas quedaría afuera por un detalle de formato.
    expect(extractDriveItemId("https://drive.google.com/drive/folders/1hA23qgsYsIRjbG")).toBe(
      "1hA23qgsYsIRjbG"
    );
    expect(
      extractDriveItemId("https://drive.google.com/drive/u/1/folders/1xpYbVPuaiFKM9aWbHB")
    ).toBe("1xpYbVPuaiFKM9aWbHB");
  });

  it("saca el id de la forma vieja con ?id=", () => {
    expect(extractDriveItemId("https://drive.google.com/open?id=1abcDEF_gh-23")).toBe(
      "1abcDEF_gh-23"
    );
  });

  it("aguanta espacios alrededor", () => {
    expect(extractDriveItemId("  https://drive.google.com/file/d/1abc/view  ")).toBe("1abc");
  });

  it("devuelve null con lo que no es un link de Drive", () => {
    expect(extractDriveItemId("https://instagram.com/p/ABC")).toBeNull();
    expect(extractDriveItemId("una nota cualquiera")).toBeNull();
    expect(extractDriveItemId("")).toBeNull();
    expect(extractDriveItemId(null)).toBeNull();
  });
});

describe("extractDriveFolderId", () => {
  it("solo acepta carpetas: la del cliente es una carpeta, no un archivo", () => {
    expect(extractDriveFolderId("https://drive.google.com/drive/folders/1zXVftffJwr")).toBe(
      "1zXVftffJwr"
    );
    expect(extractDriveFolderId("https://drive.google.com/file/d/1abc/view")).toBeNull();
  });
});
