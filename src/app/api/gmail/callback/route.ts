import { NextResponse } from "next/server";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { exchangeGmailCode, fetchGoogleEmail } from "@/lib/gmail";

/**
 * Callback OAuth de Gmail. Lo abre el mismo navegador del staff que inició la
 * conexión (sigue logueado en la app), por eso valida sesión + rol.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const back = (msg: string) =>
    NextResponse.redirect(new URL(`/reclutamiento?gmail=${encodeURIComponent(msg)}`, req.url));

  const me = await requireUser();
  if (!isStaff(me.rol)) return back("error:auth");
  if (error) return back(`error:${error}`);
  if (!code) return back("error:missing_code");

  try {
    const tokens = await exchangeGmailCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    if (!tokens.refresh_token) {
      // Sin refresh_token no podemos sincronizar después (Google solo lo manda
      // con prompt=consent la primera vez). Avisamos para reintentar.
      return back("error:sin_refresh");
    }
    const admin = createAdmin();
    const { error: upErr } = await admin.from("gmail_account").upsert(
      {
        id: 1,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
        created_by: me.id,
      },
      { onConflict: "id" }
    );
    if (upErr) throw upErr;
    return back(`ok:${email}`);
  } catch (e) {
    console.error("Gmail callback error:", e);
    return back("error:exchange");
  }
}
