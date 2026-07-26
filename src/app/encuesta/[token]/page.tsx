import { notFound } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { currentPeriod } from "@/lib/finanzas";
import { SatisfactionForm } from "@/components/satisfaction-form";

export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Encuesta de satisfacción del cliente (pública, sin login). Usa el MISMO token
 * del portal: el equipo comparte el link del portal con /encuesta al final.
 */
export default async function EncuestaPage({ params }: { params: { token: string } }) {
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
    .select("nombre")
    .eq("id", t.cliente_id)
    .maybeSingle();
  const nombre = (client as { nombre?: string } | null)?.nombre ?? "";

  // ¿Ya respondió este mes? (si falta la migración, tratamos como "no respondió")
  const periodo = currentPeriod();
  const { data: prev } = await admin
    .from("client_satisfaction")
    .select("puntaje")
    .eq("cliente_id", t.cliente_id)
    .eq("periodo", periodo)
    .maybeSingle();
  const previo = (prev as { puntaje?: number } | null)?.puntaje ?? null;

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
        puntajePrevio={previo}
      />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Esta encuesta la ve solo el equipo de {AGENCY.brand}.
      </p>
    </main>
  );
}
