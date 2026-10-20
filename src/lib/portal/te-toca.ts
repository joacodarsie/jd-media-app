/**
 * «Lo que te toca a vos» en el portal (20/10/2026). Todo lo que el equipo
 * espera del cliente, junto y arriba de todo: antes cada pendiente estaba en
 * su tarjeta, desparramado entre los reportes, y el cliente no veía las tareas
 * que el equipo había pausado esperándolo.
 *
 * Módulo PURO: recibe lo que ya calculó la página y arma la lista en orden de
 * urgencia (lo que frena al equipo primero, la encuesta al final).
 */

export interface PausadaPorCliente {
  titulo: string;
  bloqueo_detalle: string | null;
}

export interface EntradaTeToca {
  piezasParaRevisar: number;
  pausadas: PausadaPorCliente[];
  faltaMaterial: boolean;
  faltanAccesos: boolean;
  abonoPendiente: string | null; // el mes, si falta avisar el pago
  /** Del 25 al 5: la carta acuerdo vigente para el mes (lib/contratos/carta-mensual). */
  cartaDelMes?: { mes: string; href: string } | null;
  elegirReunion: boolean;
  encuesta: boolean;
}

export interface ItemTeToca {
  clave: string;
  texto: string;
  /** Ancla de la tarjeta donde se resuelve, si hay una. */
  href: string | null;
  urgente: boolean;
}

/** «Diseñar pieza: POST — Collage 26.09 · Résonar» → «Collage 26.09». */
export function nombreParaCliente(titulo: string): string {
  const sinCuenta = titulo.split(" · ")[0];
  const raya = sinCuenta.split(" — ");
  return (raya.length > 1 ? raya.slice(1).join(" — ") : sinCuenta.replace(/^[^:]{0,40}:\s*/, "")).trim() || titulo;
}

export function itemsTeToca(e: EntradaTeToca): ItemTeToca[] {
  const items: ItemTeToca[] = [];
  for (const p of e.pausadas.slice(0, 5)) {
    const detalle = p.bloqueo_detalle?.trim();
    items.push({
      clave: `pausa:${p.titulo}`,
      texto: detalle
        ? `Te estamos esperando: ${detalle}`
        : `Te estamos esperando para seguir con «${nombreParaCliente(p.titulo)}»`,
      href: null,
      urgente: true,
    });
  }
  if (e.piezasParaRevisar > 0)
    items.push({
      clave: "revisar",
      texto: e.piezasParaRevisar === 1 ? "Revisar 1 pieza" : `Revisar ${e.piezasParaRevisar} piezas`,
      href: "#revisar",
      urgente: true,
    });
  if (e.faltaMaterial) items.push({ clave: "material", texto: "Subir tus fotos y videos", href: "#material", urgente: true });
  if (e.faltanAccesos) items.push({ clave: "accesos", texto: "Cargar los accesos de tus redes", href: "#accesos", urgente: true });
  if (e.abonoPendiente) items.push({ clave: "abono", texto: `Abonar ${e.abonoPendiente}`, href: "#abono", urgente: false });
  if (e.cartaDelMes) items.push({ clave: "carta", texto: `Leer tu carta acuerdo de ${e.cartaDelMes.mes}`, href: e.cartaDelMes.href, urgente: false });
  if (e.elegirReunion) items.push({ clave: "reunion", texto: "Elegir el día de tu reunión del mes", href: "#reunion", urgente: false });
  if (e.encuesta) items.push({ clave: "encuesta", texto: "Contarnos cómo venimos (30 segundos)", href: "#encuesta", urgente: false });
  return items;
}
