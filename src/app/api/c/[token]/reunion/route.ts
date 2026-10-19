import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { agendarReunionPortal } from "@/lib/retencion/reunion-autoagenda-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/c/[token]/reunion — el cliente elige el horario de su reunión
 * mensual desde el portal (19/10/2026). Body: { inicio: ISO }.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const admin = createAdmin();
  const { data: tok } = await admin
    .from("client_portal_tokens")
    .select("cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();
  const t = tok as { cliente_id: string; revoked_at: string | null; expires_at: string | null } | null;
  if (!t || t.revoked_at || (t.expires_at && new Date(t.expires_at) < new Date())) {
    return NextResponse.json({ error: "El link no es válido." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { inicio?: string };
  if (!body.inicio) return NextResponse.json({ error: "Elegí un horario." }, { status: 400 });
  const r = await agendarReunionPortal(admin, t.cliente_id, hoyYmd(), body.inicio);
  return NextResponse.json(r, { status: "error" in r ? 409 : 200 });
}
