import { NextResponse } from "next/server";
import { requireUser, isStaff } from "@/lib/auth";
import { gmailAuthUrl } from "@/lib/gmail";

/** Inicia el OAuth para conectar la casilla de Gmail de la agencia (staff). */
export async function GET(req: Request) {
  const me = await requireUser();
  if (!isStaff(me.rol)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  const state = Buffer.from(JSON.stringify({ u: me.id })).toString("base64url");
  return NextResponse.redirect(gmailAuthUrl(state));
}
