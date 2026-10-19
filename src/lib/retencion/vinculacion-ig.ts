/**
 * Cuentas sin medir (19/10/2026, pedido del dueño): «apenas se cierra un
 * cliente nuevo, que me avisen y me molesten mucho hasta que esté vinculado de
 * verdad». Vinculado de verdad = la plataforma trajo datos de su Instagram en
 * los últimos 3 días; tener el ID cargado no alcanza (12 cuentas lo tenían mal).
 */
export interface CuentaParaMedir {
  id: string;
  nombre: string;
  /** "YYYY-MM-DD" del alta. */
  fechaInicio: string | null;
  igUsername: string | null;
  /** Tiene gestión de redes o pauta activa. */
  necesitaInstagram: boolean;
}

export interface SinMedir {
  id: string;
  nombre: string;
  igUsername: string | null;
  /** Días desde el alta (0 si no hay fecha). */
  dias: number;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

export function cuentasSinMedir(cuentas: CuentaParaMedir[], conDatos: Set<string>, hoy: string): SinMedir[] {
  return cuentas
    .filter((c) => c.necesitaInstagram && !conDatos.has(c.id))
    .map((c) => ({ id: c.id, nombre: c.nombre, igUsername: c.igUsername, dias: c.fechaInicio ? Math.max(0, diasEntre(c.fechaInicio, hoy)) : 0 }))
    .sort((a, b) => b.dias - a.dias);
}

export const PREFIJO_AVISO_IG = "🔗";

/** El aviso del día, corto para el celular. */
export function avisoSinMedir(lista: SinMedir[]): string | null {
  if (!lista.length) return null;
  const nombres = lista.slice(0, 5).map((c) => c.nombre).join(", ");
  const resto = lista.length > 5 ? ` y ${lista.length - 5} más` : "";
  return `${PREFIJO_AVISO_IG} ${lista.length} cuenta${lista.length === 1 ? "" : "s"} sin medir Instagram: ${nombres}${resto}. Sin esto no hay datos reales para el cliente ni para el reporte.`;
}

/** El ID del Business de JD Media, para que el cliente lo agregue como socio. */
export const BUSINESS_JD = "570336019465694";

/**
 * Parte 1 — la página de Facebook vinculada al Instagram. A cargo de paid media
 * (Guille), que crea la página si falta y la vincula; la PM (Luz) colabora
 * apurando hasta que esté (decisión del dueño, 19/10/2026: antes era de la CM).
 */
export function tareaVincularPagina(c: SinMedir): { titulo: string; descripcion: string } {
  return {
    titulo: `🔗 Página de Facebook vinculada al Instagram · ${c.nombre}`,
    descripcion: [
      `**A cargo de paid media**, con la project manager de colaboradora para apurar. Sin la página vinculada, el Instagram de ${c.nombre}${c.igUsername ? ` (@${c.igUsername})` : ""} no se puede compartir con JD Media y la plataforma no mide nada.`,
      "",
      "**Paso a paso:**",
      "1. **¿Tiene página de Facebook?** Si no tiene, creala con el nombre y el logo de la marca.",
      "2. **Vinculala al Instagram:** desde la página de Facebook → **Configuración** → **Cuentas vinculadas** → **Instagram** → **Conectar cuenta** (con el usuario y la contraseña del Instagram, que están en la ficha del cliente → Credenciales, o se los pide la PM al cliente). También se puede desde la app de Instagram → Editar perfil → Página.",
      "3. **Chequeá:** en la página → Configuración → Cuentas vinculadas tiene que figurar el Instagram. Avisá acá y seguí con la tarea de compartir y conectar.",
      "",
      "La PM sigue esta tarea y apura hasta que esté. Se cierra sola cuando la plataforma trae los datos del Instagram.",
    ].join("\n"),
  };
}

/** Parte 2 — compartir con JD Media y conectar a la plataforma. A paid media. */
export function tareaVincular(c: SinMedir): { titulo: string; descripcion: string } {
  return {
    titulo: `🔗 Compartir y conectar el Instagram de ${c.nombre} con JD Media`,
    descripcion: [
      `**A cargo de paid media.** Con la página ya vinculada al Instagram (lo verifica la PM), falta que la plataforma pueda leer a ${c.nombre}${c.igUsername ? ` (@${c.igUsername})` : ""}.`,
      "",
      "**Paso a paso:**",
      `1. **El cliente comparte con JD Media:** desde su Business → Configuración → **Socios** → Agregar socio → ID de JD Media **${BUSINESS_JD}** → acceso total a la **página** y a la **cuenta de Instagram**. Si no sabe, se hace con él en una llamada de 10 minutos.`,
      "2. **Asignar al usuario del sistema:** en el Business de JD Media → Configuración → **Usuarios del sistema** → «jdmedia» → **···** → **Asignar activos** → **Páginas de Facebook**: tildar la del cliente con todos los permisos. Repetir en **Cuentas de Instagram**.",
      "3. **Conectar en la plataforma:** Clientes → **Conectar Instagram** → elegir la cuenta de la lista → Conectar (no se carga ningún número a mano).",
      "4. **Verificar:** en Resultados del cliente → «Actualizar ahora» tienen que aparecer los seguidores.",
      "",
      "Se cierra sola cuando llegan los datos. Mientras tanto, la plataforma avisa todos los días.",
    ].join("\n"),
  };
}
