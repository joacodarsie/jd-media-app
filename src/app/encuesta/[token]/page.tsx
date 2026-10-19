import { notFound } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { currentPeriod } from "@/lib/finanzas";
import { SatisfactionForm } from "@/components/satisfaction-form";
import { puedeRecomendar } from "@/lib/referidos/referidos";
import { hoyYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Encuesta de satisfacción del cliente (pública, sin login). Usa el MISMO token
 * del portal: el equipo comparte el link del portal con /encuesta al final.
 */
export default async function EncuestaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { p?: string };
}) {
  const admin = createAdmin();

  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("id, cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();
  const t = tokenRow as {
    id: string;
    cliente_id: string;
    revoked_at: string | null;
    expires_at: string | null;
  } | null;
  if (!t || t.revoked_at) return notFound();
  if (t.expires_at && new Date(t.expires_at) < new Date()) return notFound();

  const { data: client } = await admin
    .from("clients")
    .select("nombre, ref_code, fecha_inicio")
    .eq("id", t.cliente_id)
    .maybeSingle();
  const cli = client as { nombre?: string; ref_code?: string | null; fecha_inicio?: string | null } | null;
  const nombre = cli?.nombre ?? "";
  // Al contento también se le cuenta lo de recomendar (si ya lleva 2 meses).
  const refCode = cli?.ref_code && puedeRecomendar(cli.fecha_inicio, hoyYmd()) ? cli.ref_code : null;

  // ¿Ya respondió este mes? (si falta la migración, tratamos como "no respondió")
  const periodo = currentPeriod();
  const { data: prev } = await admin
    .from("client_satisfaction")
    .select("puntaje")
    .eq("cliente_id", t.cliente_id)
    .eq("periodo", periodo)
    .maybeSingle();
  const previo = (prev as { puntaje?: number } | null)?.puntaje ?? null;

  // Desde el portal llega con la carita ya elegida (?p=1..5).
  const pEnUrl = Number(searchParams?.p);
  const elegido = Number.isInteger(pEnUrl) && pEnUrl >= 1 && pEnUrl <= 5 ? pEnUrl : null;

  const [anio, mes] = periodo.split("-");
  const mesLabel = `${MESES[Number(mes) - 1] ?? ""} ${anio}`;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <header className="mb-6 text-center">
        <p className="text-sm font-semibold text-primary">{AGENCY.brand}</p>
        <h1 className="mt-2 text-2xl font-bold">¿Cómo lo estamos haciendo?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {nombre ? <><b>{nombre}</b>: tu</> : "Tu"} opinión sobre {mesLabel}. Son 30
          segundos y nos sirve muchísimo para mejorar el mes que viene.
        </p>
      </header>

      <SatisfactionForm
        token={params.token}
        yaRespondio={previo != null}
        puntajePrevio={previo ?? elegido}
        refCode={refCode}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Esta encuesta la ve solo el equipo de {AGENCY.brand}.
      </p>
    </main>
  );
}
