import { describe, it, expect } from "vitest";
import {
  entregaArchivo,
  motivoParaNoCerrar,
  tieneArchivoFinal,
  AREAS_QUE_ENTREGAN_ARCHIVO,
  ARCHIVO_OBLIGATORIO_DESDE,
  type PiezaDeLaTarea,
} from "./archivo-final";

const pieza = (over: Partial<PiezaDeLaTarea> = {}): PiezaDeLaTarea => ({
  titulo: "Alarmas",
  tipo: "post",
  publish_media: [],
  asset_url: null,
  ...over,
});

/** Una tarea creada después de que el candado empezó a regir. */
const NUEVA = "2026-09-15T10:00:00Z";
/** Del trabajo que ya venía en curso cuando se prendió. */
const VIEJA = "2026-09-01T10:00:00Z";

const conArchivo = pieza({ publish_media: [{ path: "x/y.jpg", name: "y.jpg" }] });

describe("tieneArchivoFinal", () => {
  it("solo cuenta el archivo subido a la app", () => {
    expect(tieneArchivoFinal(conArchivo)).toBe(true);
    expect(tieneArchivoFinal(pieza())).toBe(false);
    expect(tieneArchivoFinal(pieza({ publish_media: null }))).toBe(false);
    expect(tieneArchivoFinal(null)).toBe(false);
  });

  it("un link de Drive no es el archivo: no se puede publicar solo", () => {
    expect(tieneArchivoFinal(pieza({ asset_url: "https://drive.google.com/x" }))).toBe(false);
  });
});

describe("entregaArchivo", () => {
  it("aplica a diseño y edición", () => {
    for (const area of AREAS_QUE_ENTREGAN_ARCHIVO) {
      expect(entregaArchivo({ area, creadaEn: NUEVA, publicationId: "p1" })).toBe(true);
    }
  });

  it("no le pide nada al CM ni a las demás áreas", () => {
    expect(entregaArchivo({ area: "Community Manager", creadaEn: NUEVA, publicationId: "p1" })).toBe(false);
    expect(entregaArchivo({ area: "Paid Media", creadaEn: NUEVA, publicationId: "p1" })).toBe(false);
    expect(entregaArchivo({ area: null, creadaEn: NUEVA, publicationId: "p1" })).toBe(false);
  });

  it("no aplica a una tarea suelta, sin pieza del calendario", () => {
    expect(entregaArchivo({ area: "Diseño", creadaEn: NUEVA, publicationId: null })).toBe(false);
  });
});

describe("motivoParaNoCerrar", () => {
  const tarea = { area: "Diseño", creadaEn: NUEVA, publicationId: "p1" };

  it("frena el cierre si falta el archivo", () => {
    const motivo = motivoParaNoCerrar(tarea, pieza(), "completada");
    expect(motivo).toContain("falta subir el archivo final");
    expect(motivo).toContain('"Alarmas"');
    expect(motivo).toContain("Subir archivo final");
  });

  it("deja cerrar cuando el archivo está", () => {
    expect(motivoParaNoCerrar(tarea, conArchivo, "completada")).toBeNull();
  });

  it("si dejó un link, se lo dice en vez de tratarlo de vago", () => {
    const motivo = motivoParaNoCerrar(tarea, pieza({ asset_url: "https://drive.google.com/x" }), "completada");
    expect(motivo).toContain("El link que dejaste sirve para verla");
  });

  it("no molesta al mover la tarea a en_progreso o en_revision", () => {
    expect(motivoParaNoCerrar(tarea, pieza(), "en_progreso")).toBeNull();
    expect(motivoParaNoCerrar(tarea, pieza(), "en_revision")).toBeNull();
  });

  it("archivar NO pide archivo: archivar es abandonar la pieza", () => {
    // Si no, una pieza cancelada dejaba una tarea muerta imposible de sacar.
    expect(motivoParaNoCerrar(tarea, pieza(), "archivada")).toBeNull();
  });

  it("al CM lo deja cerrar tranquilo", () => {
    const cm = { area: "Community Manager", creadaEn: NUEVA, publicationId: "p1" };
    expect(motivoParaNoCerrar(cm, pieza(), "completada")).toBeNull();
  });

  it("las tareas que ya venían en curso se cierran como siempre", () => {
    // El día que se prendió había 114 tareas de diseño/edición sin archivo:
    // trabarlas de golpe era levantarle un paredón al equipo.
    const vieja = { area: "Diseño", creadaEn: VIEJA, publicationId: "p1" };
    expect(motivoParaNoCerrar(vieja, pieza(), "completada")).toBeNull();
    expect(entregaArchivo(vieja)).toBe(false);
  });

  it("sin fecha de creación no le exige nada a nadie", () => {
    const sinFecha = { area: "Diseño", creadaEn: null, publicationId: "p1" };
    expect(motivoParaNoCerrar(sinFecha, pieza(), "completada")).toBeNull();
  });

  it("la fecha de corte es el día que se prendió", () => {
    expect(ARCHIVO_OBLIGATORIO_DESDE).toBe("2026-09-11");
  });

  it("una tarea sin pieza se cierra como siempre", () => {
    expect(motivoParaNoCerrar({ area: "Diseño", creadaEn: NUEVA, publicationId: null }, null, "completada")).toBeNull();
  });

  it("sin título, no dice comillas vacías", () => {
    const motivo = motivoParaNoCerrar(tarea, pieza({ titulo: "  " }), "completada");
    expect(motivo).toContain("archivo final de la pieza");
  });
});
