/**
 * Accesos que carga el cliente desde su portal (17/10/2026, pedido de Luz).
 *
 * El cliente marca, red por red, si tiene la cuenta y deja usuario y
 * contraseña: el equipo necesita tenerlas abiertas. Se guardan en el mismo
 * lugar donde el equipo ya cargaba las credenciales (`clients.credenciales`).
 * Si el cliente NO tiene una cuenta, se le crea la tarea a quien corresponde:
 * Facebook a paid media, Instagram y TikTok a la community.
 *
 * Módulo PURO.
 *
 * Está atado al onboarding de la community (24/10/2026): las dos puntas leen
 * y escriben la misma fila por red (`esDeLaRed`), así lo que carga el cliente
 * marca solo el paso de la CM y lo que carga la CM ya no se le pide al cliente.
 */
import { esDeLaRed, NOTA_NO_TIENE } from "./redes-onboarding";

export type Red = "instagram" | "facebook" | "tiktok" | "meta_business";

export const REDES: { clave: Red; nombre: string; quienCrea: "cm" | "paid" }[] = [
  { clave: "instagram", nombre: "Instagram", quienCrea: "cm" },
  { clave: "facebook", nombre: "Facebook", quienCrea: "paid" },
  { clave: "tiktok", nombre: "TikTok", quienCrea: "cm" },
  { clave: "meta_business", nombre: "Meta Business Suite", quienCrea: "paid" },
];

export interface Credencial {
  servicio: string;
  usuario: string;
  password: string;
  url: string;
  notas: string;
}

export interface CargaDelCliente {
  red: Red;
  tiene: boolean;
  usuario?: string;
  password?: string;
}

export const NOTA_SIN_CUENTA = "No tiene cuenta todavía: la crea JD Media.";

/** La fila de esa red, la haya escrito el cliente o el equipo a mano («IG», el link…). */
function indiceDeRed(lista: Credencial[], red: Red): number {
  if (red === "meta_business") return lista.findIndex((x) => /business|bm/i.test(x.servicio ?? "") || (x.url ?? "").includes("business.facebook"));
  return lista.findIndex((x) => esDeLaRed(x, red));
}

export const CARGADO_POR_CLIENTE = "Cargado por el cliente desde su plataforma";

/** Une lo que cargó el cliente con lo que ya había (pisa la misma red, deja el resto). */
export function unirCredenciales(actuales: Credencial[], cargas: CargaDelCliente[], hoy: string): Credencial[] {
  const out = [...actuales];
  for (const c of cargas) {
    const def = REDES.find((r) => r.clave === c.red);
    if (!def) continue;
    const usuario = (c.usuario ?? "").trim().slice(0, 120);
    const password = (c.password ?? "").slice(0, 200);
    if (c.tiene && !usuario && !password) continue; // nada para guardar
    const nueva: Credencial = {
      servicio: def.nombre,
      usuario: c.tiene ? usuario : "",
      password: c.tiene ? password : "",
      url: "",
      notas: c.tiene ? `${CARGADO_POR_CLIENTE} (${hoy}).` : NOTA_SIN_CUENTA,
    };
    const i = indiceDeRed(out, c.red);
    if (i >= 0) {
      // Si el cliente deja la contraseña vacía, se conserva la que había.
      if (c.tiene && !password) nueva.password = out[i].password ?? "";
      // El link que ya había cargado la CM no se pierde.
      out[i] = { ...out[i], ...nueva, servicio: out[i].servicio || nueva.servicio, url: out[i].url ?? "" };
    } else out.push(nueva);
  }
  return out;
}

/** Qué redes tiene cargadas (sin mostrar nunca la contraseña de vuelta al portal). */
export function estadoDeRedes(actuales: Credencial[]): Record<Red, "cargada" | "sin_cuenta" | "falta"> {
  const out = {} as Record<Red, "cargada" | "sin_cuenta" | "falta">;
  for (const r of REDES) {
    const c = actuales[indiceDeRed(actuales, r.clave)];
    out[r.clave] = !c
      ? "falta"
      : c.usuario || c.password
        ? "cargada"
        : c.notas?.includes(NOTA_SIN_CUENTA) || c.notas?.includes(NOTA_NO_TIENE)
          ? "sin_cuenta"
          : "falta";
  }
  return out;
}
