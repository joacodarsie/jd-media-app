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
 */

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

const NOTA_SIN_CUENTA = "No tiene cuenta todavía: la crea JD Media.";

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
      notas: c.tiene ? `Cargado por el cliente desde su plataforma (${hoy}).` : NOTA_SIN_CUENTA,
    };
    const i = out.findIndex((x) => (x.servicio ?? "").trim().toLowerCase() === def.nombre.toLowerCase());
    if (i >= 0) {
      // Si el cliente deja la contraseña vacía, se conserva la que había.
      if (c.tiene && !password) nueva.password = out[i].password ?? "";
      out[i] = { ...out[i], ...nueva };
    } else out.push(nueva);
  }
  return out;
}

/** Qué redes tiene cargadas (sin mostrar nunca la contraseña de vuelta al portal). */
export function estadoDeRedes(actuales: Credencial[]): Record<Red, "cargada" | "sin_cuenta" | "falta"> {
  const out = {} as Record<Red, "cargada" | "sin_cuenta" | "falta">;
  for (const r of REDES) {
    const c = actuales.find((x) => (x.servicio ?? "").trim().toLowerCase() === r.nombre.toLowerCase());
    out[r.clave] = !c ? "falta" : c.notas === NOTA_SIN_CUENTA ? "sin_cuenta" : c.usuario || c.password ? "cargada" : "falta";
  }
  return out;
}
