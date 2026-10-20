/**
 * Contraseñas de los clientes cifradas en la base (20/10/2026). Era el paso
 * acordado después de «accesos desde el portal»: hasta acá
 * `clients.credenciales` guardaba las contraseñas en texto plano.
 *
 * AES-256-GCM con la clave de `CREDENCIALES_KEY` (32 bytes en base64). Se
 * cifra solo el campo `password`; el resto (servicio, usuario, url) sigue
 * legible para buscar. Formato: `enc:v1:<iv>:<tag>:<datos>` en base64.
 *
 * Convive con lo viejo: un valor sin el prefijo se lee tal cual, y sin clave
 * configurada se guarda en texto plano como antes. Así el deploy no rompe nada
 * y la migración de lo existente se hace aparte.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIJO = "enc:v1:";

function clave(): Buffer | null {
  const k = process.env.CREDENCIALES_KEY;
  if (!k) return null;
  const b = Buffer.from(k, "base64");
  return b.length === 32 ? b : null;
}

export const estaCifrado = (v: unknown): boolean => typeof v === "string" && v.startsWith(PREFIJO);

export function cifrar(texto: string): string {
  const k = clave();
  if (!k || !texto || estaCifrado(texto)) return texto;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `${PREFIJO}${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${datos.toString("base64")}`;
}

/**
 * Devuelve el texto. Si está cifrado y no hay clave (o no es la correcta)
 * devuelve el valor cifrado tal cual: así, si alguien guarda la lista desde la
 * ficha, se vuelve a guardar igual y no se pierde la contraseña.
 */
export function descifrar(valor: string): string {
  if (!estaCifrado(valor)) return valor;
  const k = clave();
  if (!k) return valor;
  try {
    const [iv, tag, datos] = valor.slice(PREFIJO.length).split(":");
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(datos, "base64")), d.final()]).toString("utf8");
  } catch {
    return valor;
  }
}

type ConPassword = { password?: unknown };

export function cifrarCredenciales<T extends ConPassword>(lista: T[] | null | undefined): T[] {
  return (lista ?? []).map((c) => (typeof c?.password === "string" ? { ...c, password: cifrar(c.password) } : c));
}

export function descifrarCredenciales<T extends ConPassword>(lista: T[] | null | undefined): T[] {
  return (lista ?? []).map((c) => (typeof c?.password === "string" ? { ...c, password: descifrar(c.password) } : c));
}
