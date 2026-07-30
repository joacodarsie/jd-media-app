/**
 * Token firmado del link de baja. Va aparte de `cold-email.ts` porque usa
 * `node:crypto`: si viviera ahí, el editor del mail (componente cliente) no
 * podría importar el armado del mensaje y el build se rompe.
 *
 * Solo servidor.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { esEmailValido, normalizarEmail } from "./cold-email";

function firma(email: string, secreto: string): string {
  return createHmac("sha256", secreto).update(normalizarEmail(email)).digest("base64url");
}

export function tokenDeBaja(email: string, secreto: string): string {
  const e = Buffer.from(normalizarEmail(email)).toString("base64url");
  return `${e}.${firma(email, secreto)}`;
}

/** Devuelve el email si el token es legítimo, o null. */
export function emailDeToken(token: string, secreto: string): string | null {
  const [parte, mac] = token.split(".");
  if (!parte || !mac) return null;
  let email: string;
  try {
    email = Buffer.from(parte, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!esEmailValido(email)) return null;
  const esperado = firma(email, secreto);
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return normalizarEmail(email);
}
