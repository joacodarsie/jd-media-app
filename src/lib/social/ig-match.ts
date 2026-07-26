/**
 * Emparejar clientes con las cuentas de Instagram del Business Manager.
 *
 * Conectar el IG de cada cuenta a mano son 15 navegaciones; con esto es una
 * pantalla y un clic. La lógica es pura para poder testearla: entra la lista de
 * clientes sin conectar y las cuentas que ve el system user, sale una sugerencia
 * por cliente con el motivo (así el que aprueba entiende por qué se sugirió).
 */

export interface IgCuenta {
  igUserId: string;
  igUsername: string | null;
  pageName: string;
}

export interface ClienteSinIg {
  id: string;
  nombre: string;
  /** URL del perfil cargada en la ficha (la pista más confiable). */
  instagram_url: string | null;
}

export type MotivoMatch = "handle" | "nombre" | null;

export interface SugerenciaIg {
  clienteId: string;
  cuenta: IgCuenta | null;
  motivo: MotivoMatch;
}

/** Handle pelado de una URL/username de Instagram: "@Foo_1/" → "foo_1". */
export function handleDeUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  const m = /instagram\.com\/([^/?#]+)/i.exec(s);
  const raw = m ? m[1] : s.replace(/^@/, "");
  const handle = raw.split(/[/?#]/)[0].trim().toLowerCase();
  return handle || null;
}

/**
 * Nombre comparable: sin acentos, sin puntuación, sin palabras de relleno y sin
 * espacios. "Filí y Asociados - Abogados" → "filiasociadosabogados".
 */
export function normalizarNombre(v: string): string {
  const RELLENO = new Set([
    "el", "la", "los", "las", "de", "del", "y", "e", "&",
    "srl", "sa", "sas", "ok", "arg", "argentina", "oficial",
  ]);
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca los acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !RELLENO.has(p))
    .join("");
}

/**
 * Sugerencia por cliente. Prioridad:
 *  1. el handle de la ficha coincide EXACTO con el username de la cuenta;
 *  2. el nombre normalizado coincide con el username o el nombre de la página
 *     (exacto o uno contenido en el otro, con al menos 5 caracteres para no
 *     casar por casualidad).
 * Una cuenta ya sugerida no se vuelve a ofrecer a otro cliente.
 */
export function matchIgAccounts(
  clientes: ClienteSinIg[],
  cuentas: IgCuenta[]
): SugerenciaIg[] {
  const usadas = new Set<string>();
  const sugerencias: SugerenciaIg[] = clientes.map((c) => ({
    clienteId: c.id,
    cuenta: null,
    motivo: null,
  }));
  const porIndice = new Map(sugerencias.map((s, i) => [s.clienteId, i]));

  // Vuelta 1: handle exacto (la más confiable, se resuelve primero).
  for (const c of clientes) {
    const handle = handleDeUrl(c.instagram_url);
    if (!handle) continue;
    const hit = cuentas.find(
      (a) => !usadas.has(a.igUserId) && a.igUsername?.toLowerCase() === handle
    );
    if (hit) {
      usadas.add(hit.igUserId);
      const i = porIndice.get(c.id)!;
      sugerencias[i] = { clienteId: c.id, cuenta: hit, motivo: "handle" };
    }
  }

  // Vuelta 2: por nombre, solo para los que quedaron sin sugerencia.
  for (const c of clientes) {
    const i = porIndice.get(c.id)!;
    if (sugerencias[i].cuenta) continue;
    const nom = normalizarNombre(c.nombre);
    if (nom.length < 5) continue;
    const hit = cuentas.find((a) => {
      if (usadas.has(a.igUserId)) return false;
      const cands = [a.igUsername, a.pageName].filter(Boolean) as string[];
      return cands.some((v) => {
        const n = normalizarNombre(v);
        if (n.length < 5) return false;
        return n === nom || n.includes(nom) || nom.includes(n);
      });
    });
    if (hit) {
      usadas.add(hit.igUserId);
      sugerencias[i] = { clienteId: c.id, cuenta: hit, motivo: "nombre" };
    }
  }

  return sugerencias;
}
