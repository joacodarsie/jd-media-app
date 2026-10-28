import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Qué versión está publicada. La usa VersionNueva para avisar a pestañas viejas. */
export function GET() {
  return NextResponse.json(
    { id: process.env.VERCEL_DEPLOYMENT_ID ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
