/**
 * Detección de contactos repetidos en prospección.
 *
 * El problema real: "Sacar contactos" descartaba repetidos SOLO dentro de la
 * misma campaña, así que el mismo negocio volvía a aparecer si estaba cargado
 * en otra (el reabastecimiento automático sí miraba todas). Y como comparaba
 * el nombre tal cual, "Hotel del Lago" y "HOTEL DEL LAGO S.R.L." pasaban como
 * dos empresas distintas.
 *
 * Escribirle dos veces a la misma empresa —peor todavía, desde dos personas
 * distintas del equipo— es el error más caro de la prospección en frío.
 *
 * Puro y testeado: la comparación tiene que ser predecible.
 */

import { waDigits } from "./shared";

/** Formas jurídicas y ruido que no distinguen a una empresa de otra. */
const SUFIJOS = [
  "srl",
  "s r l",
  "sa",
  "s a",
  "sas",
  "s a s",
  "sociedad anonima",
  "sh",
  "s h",
  "ltda",
  "limitada",
  "inc",
  "corp",
  "cia",
  "y cia",
  "e hijos",
  "hnos",
  "hermanos",
];

/**
 * Clave con la que se comparan dos nombres de empresa: sin acentos, sin
 * puntuación, sin forma jurídica y sin artículos sueltos al principio.
 */
export function claveEmpresa(nombre: string | null | undefined): string {
  if (!nombre) return "";
  let s = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Los sufijos van al final casi siempre; se sacan de a uno por si hay dos.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const suf of SUFIJOS) {
      if (s.endsWith(` ${suf}`)) {
        s = s.slice(0, -(suf.length + 1)).trim();
        cambio = true;
      }
    }
  }

  // "el/la/los/las" al principio no distingue: "La Botineta" = "Botineta".
  s = s.replace(/^(el|la|los|las)\s+/, "");
  return s.trim();
}

/** Handle de Instagram comparable (sin @, sin URL, en minúsculas). */
export function claveInstagram(ig: string | null | undefined): string {
  if (!ig) return "";
  // Ojo: la URL puede venir sin protocolo ("instagram.com/tal"), que es como la
  // pega la gente. Si no se contempla, queda "instagram.com" como handle y todo
  // el mundo pasa a ser el mismo perfil.
  const limpio = ig
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .toLowerCase();
  return limpio.trim();
}

/**
 * Teléfono comparable: los últimos 10 dígitos (área + abonado).
 *
 * Se normaliza primero con `waDigits` para sacar el "15" y agregar el 9, y
 * recién ahí se recortan los últimos 10. Así "+54 9 351 386 5433",
 * "0351 15 386 5433" y "(351) 3865433" —que son el mismo teléfono escrito como
 * lo publica cada negocio— dan la misma clave.
 */
export function claveTelefono(tel: string | null | undefined): string {
  if (!tel) return "";
  const digitos = waDigits(tel) ?? tel.replace(/\D/g, "");
  if (digitos.length < 8) return "";
  return digitos.slice(-10);
}

export interface ContactoComparable {
  empresa?: string | null;
  telefono?: string | null;
  instagram?: string | null;
}

/**
 * Índice de lo que ya tenemos cargado. Se arma una vez con TODOS los contactos
 * (de todas las campañas) y después cada candidato se pregunta contra él.
 */
export class IndiceContactos {
  private empresas = new Set<string>();
  private telefonos = new Set<string>();
  private instagrams = new Set<string>();

  constructor(existentes: ContactoComparable[] = []) {
    for (const c of existentes) this.agregar(c);
  }

  agregar(c: ContactoComparable): void {
    const e = claveEmpresa(c.empresa);
    if (e) this.empresas.add(e);
    const t = claveTelefono(c.telefono);
    if (t) this.telefonos.add(t);
    const i = claveInstagram(c.instagram);
    if (i) this.instagrams.add(i);
  }

  /**
   * Por qué lo consideramos repetido, o null si es nuevo. El teléfono y el
   * Instagram mandan sobre el nombre: son el mismo negocio aunque se haya
   * cargado con otro nombre de fantasía.
   */
  motivoRepetido(c: ContactoComparable): "telefono" | "instagram" | "empresa" | null {
    const t = claveTelefono(c.telefono);
    if (t && this.telefonos.has(t)) return "telefono";
    const i = claveInstagram(c.instagram);
    if (i && this.instagrams.has(i)) return "instagram";
    const e = claveEmpresa(c.empresa);
    if (e && this.empresas.has(e)) return "empresa";
    return null;
  }

  esRepetido(c: ContactoComparable): boolean {
    return this.motivoRepetido(c) !== null;
  }

  get tamano(): number {
    return this.empresas.size;
  }

  /**
   * Nombres para pedirle a la IA que NO repita. Se recorta porque mandarle
   * cientos de nombres infla el prompt (y el costo) sin mejorar el resultado:
   * el filtro de verdad lo hace `esRepetido` sobre lo que devuelve.
   */
  nombresParaPrompt(prioritarios: string[], tope = 150): string[] {
    const out: string[] = [];
    const vistos = new Set<string>();
    for (const lista of [prioritarios, [...this.empresas]]) {
      for (const n of lista) {
        const k = claveEmpresa(n);
        if (!k || vistos.has(k)) continue;
        vistos.add(k);
        out.push(n);
        if (out.length >= tope) return out;
      }
    }
    return out;
  }
}
