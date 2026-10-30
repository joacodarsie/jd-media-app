/**
 * El armador de presupuestos con IA de Comercial (30/10/2026).
 *
 * El vendedor carga la transcripción de la reunión, el contexto y el Instagram
 * o la web del cliente; la IA elige el armado (un pack de lista o uno a medida)
 * y escribe la propuesta. Lo que la IA NO decide es el precio de un pack a
 * medida: lo calcula este archivo con las tarifas reales para que la cuenta
 * deje al menos el margen mínimo (30%, el "mínimo real" que fijó el dueño).
 * Si la IA sugiere más, se respeta; si sugiere menos, gana el mínimo.
 *
 * El caso que lo motivó: Fragancias, con poco presupuesto, cerró un "pack a
 * medida" de 2 reels + 2 carruseles + 8 días de historias a $265.000, que
 * dejaba ~23%. Con esta regla sale a $300.000.
 *
 * Puro: no toca la base ni depende de React.
 */

import type { AgencyRates, PackParam, RatePack } from "@/lib/coordinacion";
import { costoDeItems, precioParaMargen } from "@/lib/finanzas/cotizador";
import { EXTRAS, type ExtraElegido } from "@/lib/propuestas/extras";
import type { CuentaPropuesta } from "@/lib/propuestas/inversion";

/** Lo menos que tiene que dejar una cuenta, en % del precio (mes 2 en adelante). */
export const MARGEN_MINIMO = 30;

/** Topes de un pack a medida: más que esto ya es un pack de lista o Personalizado. */
export const TOPE_MEDIDA = { reels: 12, posts: 12, dias_historias: 20 };

export interface VolumenMedida {
  reels: number;
  posts: number;
  dias_historias: number;
  /** El pack de lista incluye la gestión de pauta; a medida puede ir sin. */
  conPauta: boolean;
}

/**
 * La tarifa de CM y media buyer de un pack a medida: la del pack de lista más
 * chico que cubre su volumen. Si entra en el más chico, la de "Personalizado"
 * (la que el dueño fija para las cuentas a medida).
 */
export function tarifaParaVolumen(v: { reels: number; posts: number }, packs: PackParam[]): RatePack {
  const orden = [...packs].sort((a, b) => a.precio - b.precio);
  const cubre = orden.find((p) => p.reels >= v.reels && p.posts >= v.posts);
  if (!cubre) return orden[orden.length - 1]?.id ?? "Escala";
  return cubre.id === orden[0]?.id ? "Personalizado" : cubre.id;
}

/** El precio más bajo de un pack a medida que deja el margen mínimo. */
export function precioMinimoMedida(
  v: VolumenMedida,
  rates: AgencyRates,
  packs: PackParam[],
  margen = MARGEN_MINIMO,
): number | null {
  const tarifa = tarifaParaVolumen(v, packs);
  const costo = costoDeItems(
    {
      reels: v.reels,
      piezas: v.posts,
      cm: tarifa,
      mediaBuyer: v.conPauta ? tarifa : null,
      manualMarca: false,
      otros: 0,
    },
    rates,
  );
  return precioParaMargen(costo.recurrenteSinCoord, margen, rates);
}

/** "presencia" → "Presencia": el slug de la propuesta y el id de los parámetros. */
export function packPorSlug(slug: string | null | undefined, packs: PackParam[]): PackParam | null {
  const s = (slug ?? "").trim().toLowerCase();
  return packs.find((p) => p.id.toLowerCase() === s) ?? null;
}

/** Lo que devuelve la IA sobre el armado, sin validar. */
export interface ArmadoCrudo {
  tipo?: unknown;
  pack?: unknown;
  reels?: unknown;
  posts?: unknown;
  dias_historias?: unknown;
  con_pauta?: unknown;
  precio_sugerido?: unknown;
}

export interface ArmadoFinal {
  tipo: "pack" | "medida";
  /** Slug del catálogo de propuestas: el del pack, o "personalizado" si es a medida. */
  packSlug: string;
  nombre: string;
  precio: number;
  reels: number;
  posts: number;
  dias_historias: number;
  conPauta: boolean;
  /** Lo que se le aclara al vendedor si el armado se corrigió (precio subido, cambio a pack). */
  ajustes: string[];
}

const entero = (v: unknown, min: number, max: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min;
};

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

/**
 * El armado que se usa de verdad. Reglas:
 *  - Pack de lista: precio de lista, sin tocar.
 *  - A medida: volumen dentro de los topes y precio ≥ el del margen mínimo.
 *  - Si el pack a medida termina costando lo mismo o más que un pack de lista
 *    que le da igual o más volumen (con pauta), va el de lista: al cliente le
 *    conviene y no hay nada que explicar.
 */
export function resolverArmado(
  crudo: ArmadoCrudo | null | undefined,
  rates: AgencyRates,
  packs: PackParam[],
  margen = MARGEN_MINIMO,
): ArmadoFinal {
  const ajustes: string[] = [];
  const deLista = (p: PackParam): ArmadoFinal => ({
    tipo: "pack",
    packSlug: p.id.toLowerCase(),
    nombre: p.id,
    precio: p.precio,
    reels: p.reels,
    posts: p.posts,
    dias_historias: p.stories,
    conPauta: true,
    ajustes,
  });
  const masChico = [...packs].sort((a, b) => a.precio - b.precio)[0];

  const elegido = packPorSlug(typeof crudo?.pack === "string" ? crudo.pack : null, packs);
  if (crudo?.tipo !== "medida") {
    if (elegido) return deLista(elegido);
    if (masChico) {
      ajustes.push(`La IA no eligió un pack válido: va el ${masChico.id}.`);
      return deLista(masChico);
    }
  }

  const v: VolumenMedida = {
    reels: entero(crudo?.reels, 0, TOPE_MEDIDA.reels),
    posts: entero(crudo?.posts, 0, TOPE_MEDIDA.posts),
    dias_historias: entero(crudo?.dias_historias, 0, TOPE_MEDIDA.dias_historias),
    conPauta: crudo?.con_pauta !== false,
  };
  // Un pack sin contenido no es un pack: como mínimo, un reel.
  if (v.reels + v.posts === 0) v.reels = 1;

  const minimo = precioMinimoMedida(v, rates, packs, margen) ?? 0;
  const sugerido = Math.round(Number(crudo?.precio_sugerido));
  let precio = minimo;
  if (Number.isFinite(sugerido) && sugerido > 0) {
    if (sugerido < minimo) {
      ajustes.push(
        `La IA sugirió ${pesos(sugerido)}, pero con ese volumen la cuenta no llega al ${margen}% de margen: va ${pesos(minimo)}.`,
      );
    } else {
      precio = Math.ceil(sugerido / 5000) * 5000;
    }
  }

  const mejor = [...packs]
    .sort((a, b) => a.precio - b.precio)
    .find(
      (p) =>
        p.precio <= precio &&
        p.reels >= v.reels &&
        p.posts >= v.posts &&
        p.stories >= v.dias_historias,
    );
  if (mejor) {
    ajustes.push(
      `A medida salía ${pesos(precio)} y el pack ${mejor.id} da ese volumen o más por ${pesos(mejor.precio)}: va el pack.`,
    );
    return deLista(mejor);
  }

  return {
    tipo: "medida",
    packSlug: "personalizado",
    nombre: "A medida",
    precio,
    ...v,
    ajustes,
  };
}

/** La cuenta como la guarda la propuesta: el de lista solo con su slug; el a medida, con todo. */
export function cuentaDeArmado(a: ArmadoFinal, handle: string): CuentaPropuesta {
  const nota = a.tipo === "medida" && !a.conPauta ? "Sin gestión de pauta." : null;
  if (a.tipo === "pack") return { handle, packSlug: a.packSlug, nota };
  return {
    handle,
    packSlug: a.packSlug,
    nota,
    nombre: a.nombre,
    precio: a.precio,
    reels: a.reels,
    posts: a.posts,
    dias_historias: a.dias_historias,
  };
}

/** Los extras que eligió la IA, con el precio sugerido del catálogo. Los que no existen se ignoran. */
export function extrasDeIa(raw: unknown): ExtraElegido[] {
  if (!Array.isArray(raw)) return [];
  const slugs = new Set(raw.filter((x): x is string => typeof x === "string"));
  return EXTRAS.filter((e) => slugs.has(e.slug)).map((e) => ({ slug: e.slug, precio: e.precioSugerido }));
}

/**
 * Precios de referencia de packs a medida para el prompt: la IA los usa para
 * calzar el presupuesto que dijo el cliente, sin ver las tarifas del equipo.
 */
export function ejemplosMedida(rates: AgencyRates, packs: PackParam[]): string {
  const casos: [number, number, number][] = [
    [1, 2, 4],
    [2, 2, 8],
    [3, 3, 8],
    [2, 4, 8],
  ];
  const lineas: string[] = [];
  for (const [r, p, h] of casos) {
    for (const conPauta of [true, false]) {
      const precio = precioMinimoMedida({ reels: r, posts: p, dias_historias: h, conPauta }, rates, packs);
      if (precio == null) continue;
      lineas.push(
        `- ${r} reels + ${p} carruseles + ${h} días de historias, ${conPauta ? "con" : "sin"} gestión de pauta: desde ${pesos(precio)}/mes`,
      );
    }
  }
  return lineas.join("\n");
}

/** Lo que cobra el que cierra: 10% del abono el mes 1 y 5% por mes desde el 2. */
export function comisionVendedor(totalMensual: number, rates: AgencyRates) {
  return {
    mes1: Math.round(totalMensual * (rates.comision_cierre ?? 0)),
    mensual: Math.round(totalMensual * (rates.comision_cartera ?? 0)),
  };
}
