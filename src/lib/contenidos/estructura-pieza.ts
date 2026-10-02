/**
 * El brief de un carrusel o un posteo, ordenado por slides.
 *
 * Por qué existe (2/10/2026): diseño se quejaba de que las ideas de carrusel
 * llegaban como un párrafo largo donde no se entendía qué iba en cada placa.
 * Brisa mostró cómo se las pasaban en otra agencia y es lo que se copia acá:
 *
 *   TÍTULO: 5 razones por las que tu tesis está frenada
 *
 *   SLIDES:
 *   1. No tenés tiempo. Fondo: reloj de arena casi sin tiempo.
 *   2. …
 *
 *   CIERRE: Te apoyamos en cualquiera de estas 5.
 *   CTA: Pedí tu presupuesto hoy
 *
 * Se guarda como texto en `publications.descripcion` (no hace falta migración):
 * así la tarea de diseño, que copia la descripción, también lo muestra ordenado,
 * y las piezas viejas en texto libre siguen andando igual.
 *
 * Puro, para probarlo sin base.
 */

export interface Slide {
  texto: string;
  fondo: string;
}

export interface EstructuraPieza {
  titulo: string;
  slides: Slide[];
  cierre: string;
  cta: string;
  /** Lo que no entra en lo anterior: concepto general, paleta, aclaraciones. */
  notas: string;
}

export const ESTRUCTURA_VACIA: EstructuraPieza = {
  titulo: "",
  slides: [{ texto: "", fondo: "" }],
  cierre: "",
  cta: "",
  notas: "",
};

/** Los tipos que se cargan por slides. */
export function usaSlides(tipo: string): boolean {
  return tipo === "carrusel" || tipo === "post";
}

const una = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();

/** Arma el texto que se guarda. Lo vacío no se escribe. */
export function armarDescripcion(e: EstructuraPieza): string {
  const partes: string[] = [];
  if (e.titulo.trim()) partes.push(`TÍTULO: ${una(e.titulo)}`);
  const slides = e.slides.filter((s) => s.texto.trim() || s.fondo.trim());
  if (slides.length) {
    const lineas = slides.map((s, i) => {
      const texto = una(s.texto).replace(/\.$/, "");
      const fondo = una(s.fondo);
      return `${i + 1}. ${texto}${fondo ? `${texto ? ". " : ""}Fondo: ${fondo}` : ""}`;
    });
    partes.push(`SLIDES:\n${lineas.join("\n")}`);
  }
  const final: string[] = [];
  if (e.cierre.trim()) final.push(`CIERRE: ${una(e.cierre)}`);
  if (e.cta.trim()) final.push(`CTA: ${una(e.cta)}`);
  if (final.length) partes.push(final.join("\n"));
  if (e.notas.trim()) partes.push(`NOTAS: ${e.notas.trim()}`);
  return partes.join("\n\n");
}

/**
 * Lee un texto armado con `armarDescripcion`. Devuelve null si no tiene ese
 * formato (piezas viejas en texto libre): ahí se muestra tal cual.
 */
export function leerDescripcion(texto: string | null | undefined): EstructuraPieza | null {
  if (!texto || !/^(SLIDES:\s*|T[ÍI]TULO:.*)$/m.test(texto)) return null;
  const e: EstructuraPieza = { titulo: "", slides: [], cierre: "", cta: "", notas: "" };
  let enSlides = false;
  let enNotas = false;
  const notas: string[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (enNotas) {
      notas.push(cruda);
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = linea.match(/^T[ÍI]TULO:\s*(.*)$/i))) {
      e.titulo = m[1];
      enSlides = false;
    } else if (/^SLIDES:\s*$/i.test(linea)) {
      enSlides = true;
    } else if ((m = linea.match(/^CIERRE:\s*(.*)$/i))) {
      e.cierre = m[1];
      enSlides = false;
    } else if ((m = linea.match(/^CTA:\s*(.*)$/i))) {
      e.cta = m[1];
      enSlides = false;
    } else if ((m = linea.match(/^NOTAS:\s*(.*)$/i))) {
      enNotas = true;
      notas.push(m[1]);
    } else if (enSlides && (m = linea.match(/^\d+[.)]\s*(.*)$/))) {
      const partes = m[1].split(/\.?\s*Fondo:\s*/i);
      e.slides.push({ texto: (partes[0] ?? "").trim(), fondo: partes.slice(1).join(" ").trim() });
    } else if (linea) {
      // Un renglón suelto: se guarda en notas para no perder nada.
      notas.push(linea);
    }
  }
  e.notas = notas.join("\n").trim();
  if (e.slides.length === 0) e.slides = [{ texto: "", fondo: "" }];
  return e;
}

/** Lo que devuelve la guía de IA para una pieza (ver contenidos/ai-actions). */
export interface SugerenciaParaBrief {
  hook?: string | null;
  slides: { texto: string; diseno: string }[];
  descripcion: string;
  cta?: string | null;
}

/**
 * El brief que se guarda a partir de la sugerencia de la IA. Carruseles y
 * posteos van por slides; el resto (reel, historia) como texto, igual que antes.
 */
export function descripcionDesdeSugerencia(s: SugerenciaParaBrief, tipo: string): string {
  if (usaSlides(tipo)) {
    return armarDescripcion({
      titulo: s.hook ?? "",
      slides: s.slides.map((sl) => ({ texto: sl.texto, fondo: sl.diseno })),
      cierre: "",
      cta: s.cta ?? "",
      notas: s.descripcion ?? "",
    });
  }
  return [s.descripcion, s.cta ? `CTA: ${s.cta}` : ""].filter(Boolean).join("\n\n");
}
