/**
 * Chequeo de salud del token de Meta (System User). Es el punto único de falla de
 * Paid Media + Resultados de Instagram: si expira o se revoca, todo deja de traer
 * datos en silencio. Esto permite avisarlo (cron) y mostrarlo en la UI.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaTokenStatus {
  configured: boolean;
  ok: boolean;
  error?: string;
  scopes?: string[];
  expiresAt?: number | null; // unix segundos; 0/null = no expira
  daysToExpiry?: number | null;
  missing?: string[]; // permisos que faltan
}

// Permisos que la app necesita (ads + instagram orgánico).
export const REQUIRED_SCOPES = [
  "ads_read",
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
];

export function missingScopes(scopes?: string[]): string[] {
  if (!scopes || scopes.length === 0) return [];
  const have = new Set(scopes);
  return REQUIRED_SCOPES.filter((s) => !have.has(s));
}

/** Verifica el token con /debug_token (validez, permisos, expiración). */
export async function checkMetaToken(): Promise<MetaTokenStatus> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return { configured: false, ok: false, error: "No hay token de Meta configurado." };

  try {
    const url = `${GRAPH}/debug_token?input_token=${encodeURIComponent(
      token
    )}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as {
      error?: { message?: string };
      data?: {
        is_valid?: boolean;
        scopes?: string[];
        expires_at?: number;
      };
    };
    if (!res.ok || json.error) {
      return { configured: true, ok: false, error: json.error?.message ?? `Error ${res.status}` };
    }
    const d = json.data ?? {};
    if (!d.is_valid) {
      return {
        configured: true,
        ok: false,
        error: "El token ya no es válido (expiró o se revocó).",
        scopes: d.scopes,
        missing: missingScopes(d.scopes),
      };
    }
    const expiresAt = d.expires_at ?? 0;
    const days =
      expiresAt && expiresAt > 0
        ? Math.round((expiresAt * 1000 - Date.now()) / 86_400_000)
        : null;
    return {
      configured: true,
      ok: true,
      scopes: d.scopes,
      expiresAt: expiresAt || null,
      daysToExpiry: days,
      missing: missingScopes(d.scopes),
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : "Error de red al verificar el token.",
    };
  }
}
